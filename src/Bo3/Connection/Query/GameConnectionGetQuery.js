const DEFAULT_REQUEST_DVAR = 'stoe_get';
const DEFAULT_MARKER = ' STOE_GET:';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_POLL_MS = 75;
const MAX_REQUEST_ID_LEN = 12;

class GameConnectionGetQuery {
    /**
     * @param {object} options Query dependencies and timing.
     * @param {object} options.packetWriter Writer exposing write().
     * @param {object} options.statusProbe Probe exposing read().
     * @param {string} [options.requestDvar='stoe_get'] Query request DVAR.
     * @param {string} [options.responseMarker=' STOE_GET:'] A2S response marker.
     * @param {number} [options.timeoutMs=8000] Query timeout.
     * @param {number} [options.pollMs=75] Poll delay.
     */
    constructor(options = {}) {
        if (!options.packetWriter || typeof options.packetWriter.write !== 'function') throw new TypeError('[BO3 GET] packetWriter must expose write().');
        if (!options.statusProbe || typeof options.statusProbe.read !== 'function') throw new TypeError('[BO3 GET] statusProbe must expose read().');

        this.packetWriter = options.packetWriter;
        this.statusProbe = options.statusProbe;
        this.requestDvar = String(options.requestDvar || process.env.BO3_GET_DVAR || DEFAULT_REQUEST_DVAR);
        this.responseMarker = String(options.responseMarker || process.env.BO3_GET_MARKER || DEFAULT_MARKER);
        this.timeoutMs = this.#int(options.timeoutMs ?? process.env.BO3_GET_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
        this.pollMs = this.#int(options.pollMs ?? process.env.BO3_GET_POLL_MS, DEFAULT_POLL_MS);
        this.sequence = 0;
    }

    /**
     * @param {string} target Query target.
     * @param {string} [filter=''] Optional target filter.
     * @returns {Promise<object>} Live BO3 query result.
     */
    async get(target, filter = '') {
        target = this.#key(target, 'target');
        filter = this.#optionalKey(filter, 'filter');

        const id = this.#requestId();
        await this.packetWriter.write(this.requestDvar, [id, target, filter].filter(Boolean).join('|'));

        return this.#readResponse(id, target, filter);
    }

    async #readResponse(id, target, filter) {
        const chunks = new Map();
        const deadline = Date.now() + this.timeoutMs;
        let expectedTotal = 0;
        let status = '';

        while (Date.now() < deadline) {
            const chunk = this.#chunk(await this.statusProbe.read({ activeSession: true }), id);
            if (chunk) {
                chunks.set(chunk.part, chunk.payload);
                expectedTotal = chunk.total;
                status = chunk.status;
                if (chunks.size === expectedTotal) return this.#result(target, filter, status, chunks, expectedTotal);
            }

            await GameConnectionGetQuery.#delay(this.pollMs);
        }

        if (chunks.size) throw new Error(`[BO3 GET] Incomplete ${target} response; received ${chunks.size}/${expectedTotal} chunk(s).`);
        throw new Error(`[BO3 GET] Timed out waiting for ${target}.`);
    }

    #chunk(status, id) {
        const name = status && status.info && status.info.name ? status.info.name : '';
        const markerIndex = name.indexOf(this.responseMarker);
        if (markerIndex === -1) return null;

        const parts = name.slice(markerIndex + this.responseMarker.length).split('|');
        if (parts.length < 5 || parts[0] !== id) return null;

        const part = Number.parseInt(parts[2], 10);
        const total = Number.parseInt(parts[3], 10);
        if (!Number.isSafeInteger(part) || !Number.isSafeInteger(total) || part < 1 || total < 1 || part > total) return null;

        return {
            status: parts[1],
            part,
            total,
            payload: parts.slice(4).join('|'),
        };
    }

    #result(target, filter, status, chunks, total) {
        const payload = Array.from({ length: total }, (_, index) => chunks.get(index + 1) || '').join('');
        const separator = payload.indexOf(':');
        const label = separator === -1 ? target : payload.slice(0, separator);
        const value = separator === -1 ? payload : payload.slice(separator + 1);

        if (status !== 'ok') throw new Error(`[BO3 GET] ${value || `failed to read ${target}`}.`);

        const items = value && value !== 'empty'
            ? value.split(',').map((item) => item.trim()).filter(Boolean)
            : [];

        return {
            target: label || target,
            filter,
            items,
            raw: payload,
        };
    }

    #requestId() {
        this.sequence = (this.sequence + 1) % 1296;
        const time = Date.now().toString(36).slice(-7);
        const sequence = this.sequence.toString(36).padStart(2, '0');
        return `q${time}${sequence}`.slice(0, MAX_REQUEST_ID_LEN);
    }

    #key(value, label) {
        const text = String(value || '').trim().toLowerCase();
        if (!/^[a-z0-9_-]+$/.test(text)) throw new TypeError(`[BO3 GET] ${label} must be a simple token.`);
        return text;
    }

    #optionalKey(value, label) {
        if (value === undefined || value === null || value === '') return '';
        return this.#key(value, label);
    }

    #int(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }

    static #delay(ms) {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            if (timer.unref) timer.unref();
        });
    }
}

module.exports = GameConnectionGetQuery;
