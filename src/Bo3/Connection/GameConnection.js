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

/**
 * Main BO3 transport orchestrator.
 *
 * Owns packet queueing, readiness checks, packet writes, exact ACK handling,
 * retry timing, warmup, and shutdown coordination. It has no gameplay command
 * knowledge; callers give it command payloads and it delivers packets safely.
 */
class GameConnection {
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
    get(target, filter = '') {
        return this.getQuery.get(target, filter);
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
     * @returns {Promise<object>} ACK result for one packet, or aggregate result for split packets.
     */
    async schedulePayload(payload) {
        this.#startWorker();

        const packets = this.packetProtocol.createMany(payload);
        if (packets.length > 1) console.log(`[BO3 CONNECTION] payload split into ${packets.length} safe packet(s).`);

        const deliveries = packets.map((packet) => {
            console.log(`[BO3 CONNECTION] payload enqueued : "${packet.payload}"`);
            return this.packetQueue.enqueue(packet).then((result) => {
                console.log(`[BO3 CONNECTION] payload acknowledged : "${packet.payload}"`);
                return result;
            });
        });

        return packets.length === 1
            ? deliveries[0]
            : Promise.all(deliveries).then((results) => ({ accepted: true, packets: results }));
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
}

module.exports = GameConnection;
