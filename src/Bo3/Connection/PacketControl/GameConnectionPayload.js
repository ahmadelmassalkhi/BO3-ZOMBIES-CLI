const FIELD_SEPARATOR = '|';
const DEFAULT_PAYLOAD = '<empty>';
const DEFAULT_MAX_LENGTH = 320;
const MIN_MAX_LENGTH = 64;

/**
 * Normalized payload records for BO3 connection packets.
 *
 * Accepts command-like objects, token arrays, raw strings, nested payloads, and
 * record objects, then emits packet-safe chunks without changing record order.
 */
class GameConnectionPayload {
    /**
     * @param {number|string|undefined} value Raw max length value.
     * @param {number} fallback Fallback max length.
     * @returns {number} Safe max payload length.
     */
    static #maxLength(value, fallback = DEFAULT_MAX_LENGTH) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed >= MIN_MAX_LENGTH ? parsed : fallback;
    }

    /**
     * @param {{ maxLength?: number }} [options] Raw payload options.
     * @returns {{ maxLength: number }} Frozen normalized options.
     */
    static #options(options = {}) {
        return Object.freeze({
            maxLength: GameConnectionPayload.#maxLength(options.maxLength ?? process.env.BO3_PACKET_MAX_PAYLOAD_LEN),
        });
    }

    /**
     * @param {string|Array<unknown>|GameConnectionPayload|object} [value] Payload source.
     * @param {{ maxLength?: number }} [options] Chunking options.
     */
    constructor(value = [], options = {}) {
        // Normalize once so later packet creation is read-only and deterministic.
        this.maxLength = GameConnectionPayload.#options(options).maxLength;
        this.records = GameConnectionPayload.#records(value).map((record) => Object.freeze(record.slice()));
        Object.freeze(this.records);
        Object.freeze(this);
    }

    /**
     * @returns {string} Payload text joined with BO3 field separators.
     */
    toString() {
        // Join generic records exactly as the mod receiver expects: type|field|field...
        return this.records.length
            ? this.records.map((record) => record.join(FIELD_SEPARATOR)).join(FIELD_SEPARATOR)
            : DEFAULT_PAYLOAD;
    }

    /**
     * @returns {string[]} Packet-safe payload chunks.
     */
    chunks() {
        const chunks = [];
        let current = [];

        for (const record of this.records) {
            // Trim a single huge record before deciding which packet chunk owns it.
            const fitted = this.#fitRecord(record);
            if (!fitted.length) continue;

            const next = current.concat(fitted).join(FIELD_SEPARATOR);
            if (current.length && next.length > this.maxLength) {
                // Preserve record order while starting a fresh chunk at the limit.
                chunks.push(current.join(FIELD_SEPARATOR));
                current = fitted.slice();
            } else {
                current = current.concat(fitted);
            }
        }

        if (current.length) chunks.push(current.join(FIELD_SEPARATOR));
        return chunks.length ? chunks : [DEFAULT_PAYLOAD];
    }

    /**
     * @param {string[]} tokens One command record.
     * @returns {string[]} Record fitted to the max packet length.
     */
    #fitRecord(tokens) {
        const clean = GameConnectionPayload.#cleanTokens(tokens);
        let text = clean.join(FIELD_SEPARATOR);
        if (text.length <= this.maxLength) return clean;
        if (clean.length < 2) return [clean[0].slice(0, this.maxLength) || DEFAULT_PAYLOAD];

        while (text.length > this.maxLength) {
            let target = 1;
            for (let index = 2; index < clean.length; index += 1) {
                if (clean[index].length > clean[target].length) target = index;
            }

            // Shrink only fields, never the record type, so the mod still knows the operation.
            if (clean[target].length < 1) return [clean[0].slice(0, this.maxLength) || DEFAULT_PAYLOAD];
            clean[target] = clean[target].slice(0, Math.max(0, clean[target].length - (text.length - this.maxLength)));
            text = clean.join(FIELD_SEPARATOR);
        }

        return clean;
    }

    /**
     * @param {string|Array<unknown>|GameConnectionPayload|object} value Payload source.
     * @returns {string[][]} Clean payload records.
     */
    static #records(value) {
        if (value instanceof GameConnectionPayload) return value.records.map((record) => record.slice());
        if (value && typeof value.toRecords === 'function') return GameConnectionPayload.#records(value.toRecords());
        if (value && typeof value.toTokens === 'function') return [GameConnectionPayload.#cleanTokens(value.toTokens())].filter((record) => record.length);
        if (!Array.isArray(value)) return GameConnectionPayload.#parseString(value);
        if (value.length && value.every((item) => item === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof item))) {
            return [GameConnectionPayload.#cleanTokens(value)].filter((record) => record.length);
        }

        const records = [];
        for (const item of value) {
            // Accept record-like objects, raw token arrays, nested payloads, and typed packet records.
            if (item instanceof GameConnectionPayload) {
                records.push(...GameConnectionPayload.#records(item));
            } else if (Array.isArray(item)) {
                const record = GameConnectionPayload.#cleanTokens(item);
                if (record.length) records.push(record);
            } else if (item && typeof item.toRecords === 'function') {
                records.push(...GameConnectionPayload.#records(item.toRecords()));
            } else if (item && typeof item.toTokens === 'function') {
                const record = GameConnectionPayload.#cleanTokens(item.toTokens());
                if (record.length) records.push(record);
            } else if (item && typeof item === 'object') {
                const fields = Array.isArray(item.fields) ? item.fields : [];
                const type = item.record || item.type;
                const record = GameConnectionPayload.#cleanTokens([type, ...fields]);
                if (record.length) records.push(record);
            } else {
                records.push(...GameConnectionPayload.#parseString(item));
            }
        }

        return records.length ? records : [[DEFAULT_PAYLOAD]];
    }

    /**
     * @param {string} value Raw payload text.
     * @returns {string[][]} Parsed payload records.
     */
    static #parseString(value) {
        const cleanPayload = String(value || '')
            .replace(/[\0\r\n]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanPayload) return [[DEFAULT_PAYLOAD]];

        const record = GameConnectionPayload.#cleanTokens(cleanPayload.split(FIELD_SEPARATOR));
        return record.length ? [record] : [[DEFAULT_PAYLOAD]];
    }

    /**
     * @param {Array<unknown>} tokens Raw record tokens.
     * @returns {string[]} Clean tokens, or [] when record type is empty.
     */
    static #cleanTokens(tokens) {
        const clean = tokens.map((token) => GameConnectionPayload.#cleanToken(token));
        return clean[0] ? clean : [];
    }

    /**
     * @param {unknown} value Raw token.
     * @returns {string} Packet-safe token.
     */
    static #cleanToken(value) {
        return String(value ?? '')
            .replace(/[\0\r\n|]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

module.exports = GameConnectionPayload;
