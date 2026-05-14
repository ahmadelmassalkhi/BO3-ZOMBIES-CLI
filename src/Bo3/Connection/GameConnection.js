const EventEmitter = require('events');
const GameConnectionOfficialDvarWriter = require('./Transport/DvarBridge/GameConnectionOfficialDvarWriter');
const GameConnectionOfficialA2SStatusProbe = require('./Transport/GameConnectionOfficialA2SStatusProbe');
const GameConnectionPacketProtocol = require('./PacketControl/GameConnectionPacketProtocol');
const GameConnectionReadinessGate = require('./GameConnectionReadinessGate');
const GameConnectionPacketQueue = require('./PacketControl/GameConnectionPacketQueue');
const GameConnectionReliablePacketSender = require('./Transport/Delivery/GameConnectionReliablePacketSender');
const GameConnectionPacketDeliveryWorker = require('./Transport/Delivery/GameConnectionPacketDeliveryWorker');
const GameConnectionGetQuery = require('./Query/GameConnectionGetQuery');
const GameConnectionReportReader = require('./Reports/GameConnectionReportReader');

const STOP_TIMEOUT_MS = 5000;
const ACTIVE_DELIVERY_GRACE_MS = 900;

/**
 * Main BO3 transport orchestrator.
 *
 * Owns packet queueing, readiness checks, packet writes, exact ACK handling,
 * retry timing, warmup, and shutdown coordination. It has no gameplay command
 * knowledge; callers give it command payloads and it delivers packets safely.
 */
class GameConnection extends EventEmitter {
    /**
     * @param {object} [options] Optional dependency and timing overrides.
     * @param {object} [options.transportOptions] Shared options for default transport components.
     * @param {object} [options.protocolOptions] Packet protocol options.
     * @param {object} [options.packetWriter] Writer exposing write(), warmup(), and stop().
     * @param {object} [options.commandWriter] Backward-compatible alias for packetWriter.
     * @param {object} [options.statusProbe] Probe exposing read() and stop().
     * @param {object} [options.packetProtocol] Packet protocol exposing createMany() and ackFrom().
     * @param {object} [options.packetQueue] FIFO queue exposing enqueue(), rejectAll(), peek(), and acknowledge().
     * @param {object} [options.sendQueue] Backward-compatible alias for packetQueue.
     * @param {object} [options.readiness] Readiness gate exposing wait() and check().
     * @param {object} [options.packetSender] Sender exposing send().
     * @param {object} [options.deliveryWorker] Delivery worker exposing start() and stop().
     * @param {object} [options.getQuery] GET query client exposing get().
     * @param {object} [options.reportReader] Report reader exposing prime() and collect().
     * @throws {TypeError} When an injected component is missing a required method.
     */
    constructor(options = {}) {
        super();

        const transport = options.transportOptions || {};
        const protocol = options.protocolOptions;
        const probeIntervalMs = this.#int(options.probeIntervalMs ?? process.env.BO3_BRIDGE_PROBE_INTERVAL_MS, 1000);

        this.running = false;
        this.probeIntervalMs = probeIntervalMs;
        this.idleDelayMs = this.#int(options.idleDelayMs ?? process.env.BO3_QUEUE_IDLE_DELAY_MS, 50);
        this.settleMs = this.#int(options.recoverySettleMs ?? process.env.BO3_RECOVERY_SETTLE_MS, 0);
        this.repeatCount = Math.max(1, this.#int(options.repeatCount ?? process.env.BO3_PACKET_REPEAT_COUNT, 1));
        this.repeatDelayMs = this.#int(options.repeatDelayMs ?? process.env.BO3_PACKET_REPEAT_DELAY_MS, 0);
        this.edgeDelayMs = this.#int(options.packetEdgeDelayMs ?? process.env.BO3_PACKET_EDGE_DELAY_MS, 20);
        this.ackPollMs = this.#int(options.ackPollMs ?? process.env.BO3_ACK_POLL_MS, 20);
        this.ackResendMs = this.#int(options.ackResendMs ?? process.env.BO3_ACK_RESEND_MS, 120);
        this.stopTimeoutMs = this.#int(options.stopTimeoutMs ?? process.env.BO3_CONNECTION_STOP_TIMEOUT_MS, STOP_TIMEOUT_MS);
        this.activeDeliveryGraceMs = this.#int(options.activeDeliveryGraceMs ?? process.env.BO3_ACTIVE_DELIVERY_GRACE_MS, ACTIVE_DELIVERY_GRACE_MS);
        this.cachedRequests = [];
        this.cachedFlushAnnounced = false;
        this.pendingState = null;
        this.queryActive = false;

        this.packetWriter = options.packetWriter || options.commandWriter || new GameConnectionOfficialDvarWriter(transport);
        this.statusProbe = options.statusProbe || new GameConnectionOfficialA2SStatusProbe(transport);
        this.packetProtocol = options.packetProtocol || new GameConnectionPacketProtocol(protocol);
        this.packetQueue = options.packetQueue || options.sendQueue || new GameConnectionPacketQueue();
        this.readiness = options.readiness || new GameConnectionReadinessGate({
            probe: this.statusProbe,
            isRunning: () => this.running,
            getQueueLength: () => this.packetQueue.length,
            probeIntervalMs,
            recoverySettleMs: this.settleMs,
            readyConfirmationsRequired: this.#int(options.readyConfirmationsRequired ?? process.env.BO3_BRIDGE_READY_CONFIRMATIONS, 1),
            readyConfirmationIntervalMs: this.#int(options.readyConfirmationIntervalMs ?? process.env.BO3_BRIDGE_READY_CONFIRMATION_INTERVAL_MS, 100),
        });
        this.packetSender = options.packetSender || new GameConnectionReliablePacketSender({
            packetWriter: this.packetWriter,
            statusProbe: this.statusProbe,
            packetProtocol: this.packetProtocol,
            readiness: this.readiness,
            isRunning: () => this.running,
            probeIntervalMs: this.probeIntervalMs,
            settleMs: this.settleMs,
            repeatCount: this.repeatCount,
            repeatDelayMs: this.repeatDelayMs,
            edgeDelayMs: this.edgeDelayMs,
            ackPollMs: this.ackPollMs,
            ackResendMs: this.ackResendMs,
        });
        this.deliveryWorker = options.deliveryWorker || new GameConnectionPacketDeliveryWorker({
            packetQueue: this.packetQueue,
            readiness: this.readiness,
            sender: this.packetSender,
            isRunning: () => this.running,
            canSend: () => this.#canSendPackets(),
            idleDelayMs: this.idleDelayMs,
            probeIntervalMs: this.probeIntervalMs,
        });
        this.getQuery = options.getQuery || new GameConnectionGetQuery({
            packetWriter: this.packetWriter,
            statusProbe: this.statusProbe,
            timeoutMs: options.getTimeoutMs,
            pollMs: options.getPollMs,
        });
        this.reportReader = options.reportReader || new GameConnectionReportReader({
            statusProbe: this.statusProbe,
            firstTimeoutMs: options.reportFirstTimeoutMs,
            quietMs: options.reportQuietMs,
            pollMs: options.reportPollMs,
        });
        this.#validateTransport();
    }

    /**
     * Starts the delivery worker.
     *
     * @returns {GameConnection} This connection.
     */
    start() {
        this.#startWorker();
        return this;
    }

    /**
     * Preloads the DVAR writer without sending gameplay payload packets.
     *
     * @returns {Promise<*>} Writer warmup result.
     */
    warmup() {
        const warmup = this.packetWriter.warmup ? this.packetWriter.warmup() : Promise.resolve();
        return Promise.resolve(warmup).then((result) => this.#primeReports().then(() => result));
    }

    /**
     * Reads current BO3 readiness/status from the configured status probe.
     *
     * @param {object} [options] Probe options.
     * @returns {Promise<object>} Status shape consumed by readiness and ACK parsing.
     */
    readStatus(options = {}) {
        return this.statusProbe.read(options);
    }

    /**
     * @param {string} target GET target.
     * @param {string} [filter=''] Optional target filter.
     * @returns {Promise<object>} Live query result.
     */
    async get(target, filter = '') {
        this.#startWorker();

        const request = this.#getRequestText(target, filter);
        const queueState = (this.queryActive || this.packetQueue.length || this.cachedRequests.length)
            ? this.#pendingQueueState()
            : await this.#queueState();

        if (queueState) {
            this.pendingState = queueState;
            this.#trackCachedQuery([request], target, filter, queueState);
            return GameConnection.#queuedResult(queueState, this.cache(), [request], 'query');
        }

        this.pendingState = null;
        return this.#runGetQuery(target, filter);
    }

    /**
     * Reads BO3 reports published after the latest seen report id.
     *
     * @returns {Promise<object[]>} New BO3 report objects.
     */
    reports() {
        return this.reportReader.collect();
    }

    /**
     * Clears cached work that has not entered the in-flight ACK slot.
     *
     * @param {'all'|'last'} [mode='all'] Clear mode.
     * @param {number} [count=1] Number of last cached requests to clear.
     * @returns {{ cleared: number, requests: string[], active: boolean }} Clear result.
     */
    clearCache(mode = 'all', count = 1) {
        if (!['all', 'last'].includes(mode)) throw new TypeError('[BO3 CONNECTION] cache clear mode must be all or last.');
        if (!Number.isInteger(count) || count < 1) throw new TypeError('[BO3 CONNECTION] cache clear count must be a positive integer.');

        const error = new Error('Cached BO3 commands cleared.');
        error.cacheCleared = true;

        const entries = this.#clearEntries(mode, count);
        const packets = this.packetQueue.clearCached(error, (packet) => {
            return entries.some((entry) => entry.packets && entry.packets.includes(packet));
        });
        const queryRequests = this.#clearCachedQueries(entries);
        const commandRequests = entries
            .filter((entry) => entry.kind === 'command')
            .flatMap((entry) => entry.requests);
        this.#removeClearedEntries(entries);
        if (!this.cachedRequests.length) this.#resetCacheState();
        const snapshot = this.cache();

        return {
            cleared: commandRequests.length + queryRequests.length,
            mode,
            requests: commandRequests.concat(queryRequests),
            active: snapshot.active,
            activeRequests: snapshot.activeRequests,
        };
    }

    /**
     * @returns {{ activeRequests: string[], requests: string[], active: boolean }} Current cached work.
     */
    cache() {
        const activeEntry = this.#activeCacheEntry();
        const activeRequests = activeEntry ? activeEntry.requests : [];

        return {
            requests: this.cachedRequests
                .filter((entry) => !entry.cleared && entry !== activeEntry && !entry.active)
                .flatMap((entry) => entry.requests),
            activeRequests,
            active: Boolean(activeRequests.length),
        };
    }

    /**
     * Stops transport work and rejects packets still waiting for ACK.
     *
     * @returns {Promise<void>}
     */
    async stop() {
        const error = new Error('BO3 connection stopped before queued packets were acknowledged.');
        this.running = false;
        this.packetQueue.rejectAll(error);

        await Promise.allSettled([
            this.#stopComponent('readiness gate', this.readiness),
            this.#stopComponent('packet delivery worker', this.deliveryWorker),
            this.#stopComponent('official dvar writer', this.packetWriter),
            this.#stopComponent('official status probe', this.statusProbe),
        ]);
    }

    /**
     * Queues one payload and resolves only after every packet is ACKed.
     *
     * @param {string|Array<unknown>|object} payload Payload accepted by GameConnectionPacketProtocol.
     * @param {string[]} [requestTexts] Human CLI requests represented by this payload.
     * @returns {Promise<object>} ACK result for one packet, or aggregate result for split packets.
     */
    async schedulePayload(payload, requestTexts = undefined) {
        this.#startWorker();

        const packets = this.packetProtocol.createMany(payload);
        const requests = this.#requests(requestTexts, packets);
        const queueState = (this.queryActive || this.packetQueue.length || this.cachedRequests.length)
            ? this.#pendingQueueState()
            : await this.#queueState();
        const delivery = this.#enqueuePackets(packets);

        if (queueState) {
            this.pendingState = queueState;
            this.#trackCachedCommands(requests, delivery, queueState, packets);
            return GameConnection.#queuedResult(queueState, this.cache(), requests, 'command');
        }

        this.pendingState = null;
        const quickDelivery = await this.#quickDelivery(delivery);
        if (quickDelivery.delivered) return this.#delivered(quickDelivery.result);

        const paused = { reason: 'paused', map: quickDelivery.map || '', detail: 'Live match detected, but gameplay is not accepting commands yet.' };
        this.pendingState = paused;
        this.#trackCachedCommands(requests, delivery, paused, packets);
        return GameConnection.#queuedResult(paused, this.cache(), requests, 'command');
    }

    #enqueuePackets(packets) {
        const deliveries = packets.map((packet) => this.packetQueue.enqueue(packet));
        return packets.length === 1
            ? deliveries[0]
            : Promise.all(deliveries).then((results) => ({ accepted: true, packets: results }));
    }

    async #quickDelivery(delivery) {
        let timer = null;
        const timeout = new Promise((resolve) => {
            timer = setTimeout(() => resolve({ delivered: false }), this.activeDeliveryGraceMs);
        });

        return Promise.race([
            Promise.resolve(delivery).then((result) => ({ delivered: true, result })),
            timeout,
        ]).finally(() => {
            if (timer) clearTimeout(timer);
        });
    }

    async #delivered(delivery) {
        const reports = await this.#readReports();
        return {
            queued: false,
            delivery,
            reports,
        };
    }

    async #queueState() {
        const status = await this.readStatus({ gameplay: true, activeSession: true });
        const map = GameConnection.#map(status);
        if (status.state === 'active') return null;

        if (!status.reachable) {
            return {
                reason: 'inactive',
                map,
                detail: 'No live match detected.',
            };
        }

        return {
            reason: 'paused',
            map,
            detail: 'Live match detected, but gameplay appears paused.',
        };
    }

    #trackCachedCommands(requests, delivery, state, packets) {
        const entry = { kind: 'command', requests, packets, reason: state.reason, active: false, cleared: false };
        this.cachedRequests.push(entry);

        Promise.resolve(delivery)
            .then((result) => this.#cachedDelivered(entry, result))
            .catch((error) => this.#cachedFailed(entry, error));
    }

    #trackCachedQuery(requests, target, filter, state) {
        const entry = { kind: 'query', requests, packets: [], reason: state.reason, active: false, cleared: false };
        this.cachedRequests.push(entry);
        void this.#runCachedQuery(entry, target, filter);
    }

    async #runCachedQuery(entry, target, filter) {
        let ownsQuery = false;
        try {
            await this.#waitForCachedQuery(entry);
            if (entry.cleared || !this.running) return;

            entry.active = true;
            this.queryActive = true;
            ownsQuery = true;
            await this.#announceCachedFlush();

            const result = await this.getQuery.get(target, filter);
            this.#removeCachedRequest(entry);
            this.emit('notice', { type: 'queryResult', result });
            if (!this.cachedRequests.length) this.#resetCacheState();
        } catch (error) {
            this.#cachedFailed(entry, error);
        } finally {
            if (ownsQuery) this.queryActive = false;
        }
    }

    async #waitForCachedQuery(entry) {
        while (this.running && !entry.cleared) {
            if (this.cachedRequests[0] !== entry) { await GameConnection.#delay(this.idleDelayMs); continue; }
            if (this.queryActive || this.packetQueue.length) { await GameConnection.#delay(this.idleDelayMs); continue; }

            const state = await this.#queueState();
            if (!state) return;
            await GameConnection.#delay(this.probeIntervalMs);
        }
    }

    async #cachedDelivered(entry, delivery) {
        entry.active = true;
        await this.#announceCachedFlush();
        const reports = await this.#readReports();
        this.#removeCachedRequest(entry);
        if (reports.length) this.emit('notice', { type: 'reports', reports });
        if (!this.cachedRequests.length) this.#resetCacheState();
        return delivery;
    }

    #cachedFailed(entry, error) {
        this.#removeCachedRequest(entry);
        if (error && error.cacheCleared) {
            if (!this.cachedRequests.length) this.#resetCacheState();
            return;
        }

        this.emit('notice', {
            type: 'cachedError',
            message: error && error.message ? error.message : String(error),
        });
        if (!this.cachedRequests.length) this.#resetCacheState();
    }

    async #announceCachedFlush() {
        if (this.cachedFlushAnnounced) return;
        this.cachedFlushAnnounced = true;

        const status = await this.readStatus({ gameplay: true, activeSession: true }).catch(() => null);
        this.emit('notice', {
            type: 'cachedFlush',
            map: GameConnection.#map(status),
            gameplayRecovered: this.cachedRequests.some((request) => request.reason === 'inactive' || request.reason === 'paused'),
            requests: this.cachedRequests.flatMap((request) => request.requests),
        });
    }

    #resetCacheState() {
        this.cachedFlushAnnounced = false;
        this.pendingState = null;
    }

    #removeCachedRequest(entry) {
        const index = this.cachedRequests.indexOf(entry);
        if (index !== -1) this.cachedRequests.splice(index, 1);
    }

    #requestText(payload) {
        return String(payload || '').split('|').filter(Boolean).join(' ');
    }

    #requests(requestTexts, packets) {
        if (requestTexts === undefined) return packets.map((packet) => this.#requestText(packet.payload));
        if (!Array.isArray(requestTexts) || !requestTexts.every((request) => typeof request === 'string' && request.trim())) {
            throw new TypeError('[BO3 CONNECTION] request texts must be non-empty strings.');
        }

        return requestTexts.map((request) => request.trim());
    }

    #getRequestText(target, filter) {
        return ['get', target, filter].filter(Boolean).join(' ');
    }

    #clearCachedQueries(entries) {
        const cleared = [];
        for (const entry of entries) {
            if (entry.kind === 'query') {
                cleared.push(...entry.requests);
            }
        }
        return cleared;
    }

    #clearEntries(mode, count) {
        const activeEntry = this.#activeCacheEntry();
        const pending = this.cachedRequests.filter((entry) => !entry.cleared && !entry.active && entry !== activeEntry);
        const entries = mode === 'all' ? pending : pending.slice(-count);

        for (const entry of entries) entry.cleared = true;
        return entries;
    }

    #removeClearedEntries(entries) {
        if (!entries.length) return;
        this.cachedRequests = this.cachedRequests.filter((entry) => !entries.includes(entry));
    }

    #activeCacheEntry() {
        return this.cachedRequests.find((entry, index) => {
            if (entry.cleared) return false;
            if (entry.active) return true;
            return index === 0 && entry.kind === 'command' && this.packetQueue.hasActive;
        }) || null;
    }

    async #emitReports() {
        const reports = await this.#readReports();
        if (reports.length) this.emit('notice', { type: 'reports', reports });
    }

    async #readReports() {
        try {
            return await this.reports();
        } catch (error) {
            console.warn('[BO3 REPORT] read warning:', error && error.message ? error.message : String(error));
            return [];
        }
    }

    static #queuedResult(state, cache, addedRequests, kind) {
        return {
            queued: true,
            kind,
            reason: state.reason,
            map: state.map,
            detail: state.detail,
            activeRequests: cache.activeRequests,
            requests: cache.requests,
            addedRequests,
            reports: [],
        };
    }

    static #busyState(detail = 'waiting for current command') {
        return {
            reason: 'busy',
            map: '',
            detail,
        };
    }

    #pendingQueueState() {
        if (this.queryActive) return GameConnection.#busyState('waiting for current command');
        if (this.pendingState) return this.pendingState;
        if (this.packetQueue.hasActive) return GameConnection.#busyState('waiting for BO3 ACK');
        return GameConnection.#busyState();
    }

    #canSendPackets() {
        if (this.queryActive) return false;
        return !this.cachedRequests.length || this.cachedRequests[0].kind === 'command';
    }

    async #runGetQuery(target, filter) {
        this.queryActive = true;
        try {
            return await this.getQuery.get(target, filter);
        } finally {
            this.queryActive = false;
        }
    }

    static #map(status) {
        return String(status && status.info && status.info.server_map ? status.info.server_map : '').trim();
    }

    /**
     * Starts the worker lazily on first scheduled payload.
     */
    #startWorker() {
        if (this.running) return;
        this.running = true;
        this.deliveryWorker.start();
    }

    /**
     * Validates injected transports once so failures are immediate and readable.
     */
    #validateTransport() {
        this.#requireMethod(this.packetWriter, 'write', 'official dvar writer');
        this.#requireMethod(this.statusProbe, 'read', 'official status probe');
        this.#requireMethod(this.packetProtocol, 'createMany', 'packet protocol');
        this.#requireMethod(this.packetProtocol, 'ackFrom', 'packet protocol');
        this.#requireMethod(this.packetQueue, 'enqueue', 'packet queue');
        this.#requireMethod(this.packetQueue, 'rejectAll', 'packet queue');
        this.#requireMethod(this.readiness, 'wait', 'readiness gate');
        this.#requireMethod(this.readiness, 'check', 'readiness gate');
        this.#requireMethod(this.packetSender, 'send', 'packet sender');
        this.#requireMethod(this.deliveryWorker, 'start', 'packet delivery worker');
        this.#requireMethod(this.deliveryWorker, 'stop', 'packet delivery worker');
        this.#requireMethod(this.getQuery, 'get', 'get query');
        this.#requireMethod(this.reportReader, 'prime', 'report reader');
        this.#requireMethod(this.reportReader, 'collect', 'report reader');
    }

    /**
     * Best-effort stale report guard; report read failures must not block startup.
     *
     * @returns {Promise<void>}
     */
    async #primeReports() {
        try {
            await this.reportReader.prime();
        } catch (error) {
            console.warn('[BO3 REPORT] prime warning:', error && error.message ? error.message : String(error));
        }
    }

    /**
     * Requires one method on an injected component.
     *
     * @param {*} target Component to inspect.
     * @param {string} method Required method name.
     * @param {string} label Component label for errors.
     * @throws {TypeError} When method is missing.
     */
    #requireMethod(target, method, label) {
        if (!target || typeof target[method] !== 'function') {
            throw new TypeError(`[BO3 CONNECTION] Invalid ${label}: missing ${method}().`);
        }
    }

    /**
     * Calls stop() on a transport component and logs shutdown issues without masking the caller.
     *
     * @param {string} label Component label for logs.
     * @param {object} component Component with optional stop().
     */
    async #stopComponent(label, component) {
        if (!component || typeof component.stop !== 'function') return;

        try {
            await this.#bounded(Promise.resolve(component.stop()), this.stopTimeoutMs, `${label} stop`);
        } catch (error) {
            console.warn(`[BO3 CONNECTION] ${label} stop warning: ${error.message}`);
        }
    }

    /**
     * @param {Promise<*>} promise Stop promise to bound.
     * @param {number} timeoutMs Max wait time.
     * @param {string} label Operation label for timeout errors.
     * @returns {Promise<*>} Promise result or timeout rejection.
     */
    #bounded(promise, timeoutMs, label) {
        let timer = null;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
            if (timer.unref) timer.unref();
        });

        return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
            if (timer) clearTimeout(timer);
        });
    }

    /**
     * @param {*} value Raw integer-like value.
     * @param {number} fallback Fallback when value is invalid.
     * @returns {number} Non-negative integer.
     */
    #int(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }

    static #delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = GameConnection;
