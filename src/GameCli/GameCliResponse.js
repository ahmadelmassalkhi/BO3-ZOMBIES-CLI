/**
 * Stable response returned by GameCli.
 *
 * This is the machine-safe contract. Human coloring and JSON/text output are
 * handled by the real CLI wrapper, not by the command engine.
 */
class GameCliResponse {
    /**
     * @param {boolean} ok Whether the command succeeded.
     * @param {string} text Plain response text.
     * @param {string[][]} records BO3 records sent for this command.
     * @param {*} data Optional machine-readable result.
     * @param {object|null} error Optional machine-readable error.
     */
    constructor(ok, text, records = [], data = null, error = null) {
        if (typeof ok !== 'boolean') throw new TypeError('GameCliResponse.ok must be a boolean.');
        if (typeof text !== 'string') throw new TypeError('GameCliResponse.text must be a string.');
        if (!Array.isArray(records)) throw new TypeError('GameCliResponse.records must be an array.');

        this.ok = ok;
        this.text = text;
        this.records = Object.freeze(records.map((record) => Object.freeze([...record])));
        this.data = data;
        this.error = error;
        Object.freeze(this);
    }

    /**
     * @param {string} text Plain response text.
     * @param {object} [options] Response details.
     * @returns {GameCliResponse} Success response.
     */
    static success(text, options = {}) {
        const data = Object.prototype.hasOwnProperty.call(options, 'data') ? options.data : null;
        return new GameCliResponse(true, text, options.records || [], data);
    }

    /**
     * @param {*} error Error-like value.
     * @returns {GameCliResponse} Failure response.
     */
    static failure(error) {
        const text = error && error.message ? error.message : String(error);
        return new GameCliResponse(false, text, [], null, {
            name: error && error.name ? error.name : 'Error',
            message: text,
        });
    }

    /**
     * @returns {object} JSON-safe response shape for process integrations.
     */
    toJSON() {
        return {
            ok: this.ok,
            text: this.text,
            records: this.records,
            data: this.data,
            error: this.error,
        };
    }
}

module.exports = GameCliResponse;
