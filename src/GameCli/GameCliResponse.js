/**
 * Stable response returned by GameCli.
 *
 * This is the machine-safe contract. Human coloring and JSON/text output are
 * handled by the real CLI wrapper, not by the command engine.
 */
class GameCliResponse {
    /**
     * @param {'sent'|'preview'|'help'|'canceled'|'error'} status Response status.
     * @param {string} text Plain response text.
     * @param {string[][]} records BO3 records sent for this command.
     * @param {*} data Optional machine-readable result.
     * @param {object|null} error Optional machine-readable error.
     */
    constructor(status, text, records = [], data = null, error = null) {
        if (!['sent', 'preview', 'help', 'canceled', 'error'].includes(status)) throw new TypeError('GameCliResponse.status is invalid.');
        if (typeof text !== 'string') throw new TypeError('GameCliResponse.text must be a string.');
        if (!Array.isArray(records)) throw new TypeError('GameCliResponse.records must be an array.');

        this.status = status;
        this.ok = status !== 'error';
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
        return new GameCliResponse(options.status || 'sent', text, options.records || [], data);
    }

    /**
     * @param {number} recordCount Number of sent BO3 records.
     * @param {string[][]} records Sent BO3 records.
     * @param {*} data Send result.
     * @returns {GameCliResponse} Sent response.
     */
    static sent(recordCount, records, data) {
        return new GameCliResponse('sent', `sent ${recordCount} BO3 record(s).`, records, data);
    }

    /**
     * @param {number} recordCount Number of previewed BO3 records.
     * @param {string[][]} records Previewed BO3 records.
     * @returns {GameCliResponse} Preview response.
     */
    static preview(recordCount, records) {
        return new GameCliResponse('preview', `previewed ${recordCount} BO3 record(s).`, records);
    }

    /**
     * @param {string} text Help text.
     * @returns {GameCliResponse} Help response.
     */
    static help(text) {
        return new GameCliResponse('help', text);
    }

    /**
     * @param {string} [text='canceled current command.'] Cancellation text.
     * @returns {GameCliResponse} Canceled response.
     */
    static canceled(text = 'canceled current command.') {
        return new GameCliResponse('canceled', text);
    }

    /**
     * @param {*} error Error-like value.
     * @returns {GameCliResponse} Failure response.
     */
    static failure(error) {
        const text = error && error.message ? error.message : String(error);
        return new GameCliResponse('error', text, [], null, {
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
            status: this.status,
            text: this.text,
            records: this.records,
            data: this.data,
            error: this.error,
        };
    }
}

module.exports = GameCliResponse;
