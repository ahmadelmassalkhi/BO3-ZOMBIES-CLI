const Bo3 = require('../Bo3');

/**
 * Base class for BO3 command events.
 *
 * A BO3 event converts constructor data into one or more BO3 command records.
 */
class Bo3Event {
    #fields;

    /**
     * @param {Bo3} bo3 BO3 runtime that owns the connection.
     * @param {string} type BO3 command type.
     * @param {string[]} [fields=[]] Static command fields.
     */
    constructor(bo3, type, fields = []) {
        if (!(bo3 instanceof Bo3)) throw new TypeError('Bo3Event.bo3 must be a Bo3 instance.');
        if (!Array.isArray(fields)) throw new TypeError('Bo3Event.fields must be an array.');

        this.bo3 = bo3;
        this.type = Bo3Event.text(type, 'Bo3Event.type');
        this.#fields = Object.freeze(fields.map((field) => Bo3Event.cleanToken(field)));
    }

    /**
     * @returns {Promise<object>|undefined} BO3 send result.
     */
    execute() {
        const records = this.toRecords();
        if (!records.length) return undefined;
        return this.bo3.sendRecords(records, this.type);
    }

    /**
     * @returns {string[][]} BO3 command records.
     */
    toRecords() {
        return [this.record()];
    }

    /**
     * @param {string[]} [fields] Command fields.
     * @returns {string[]} BO3 command tokens.
     */
    record(fields = this.#fields) {
        if (!Array.isArray(fields)) throw new TypeError('Bo3Event.fields must be an array.');
        return [this.type, ...fields.map((field) => Bo3Event.cleanToken(field))];
    }

    /**
     * @param {*} value Raw command token.
     * @returns {string} BO3-safe token.
     */
    static cleanToken(value) {
        return String(value ?? '')
            .replace(/[\0\r\n|]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * @param {*} value Raw count value.
     * @returns {number} Positive count, defaulting to one.
     */
    static cleanPositiveCount(value) {
        const count = Number.parseInt(value, 10);
        return Number.isFinite(count) && count > 0 ? count : 1;
    }

    /**
     * @param {*} value Value to validate.
     * @param {string} label Error label.
     * @returns {number} Valid positive integer.
     */
    static positiveInt(value, label) {
        if (!Number.isInteger(value) || value < 1) throw new TypeError(`${label} must be a positive integer.`);
        return value;
    }

    /**
     * @param {*} value Value to validate.
     * @param {string} label Error label.
     * @returns {boolean} Valid boolean.
     */
    static boolean(value, label) {
        if (typeof value !== 'boolean') throw new TypeError(`${label} must be a boolean.`);
        return value;
    }

    /**
     * @param {*} value Value to validate.
     * @param {string} label Error label.
     * @returns {string} Valid non-empty string.
     */
    static text(value, label) {
        if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
        return value;
    }
}

module.exports = Bo3Event;

