const Bo3Event = require('./Bo3Event');

const MAX_PRINT_LEN = 190;

/**
 * Prints one BO3 report/message line.
 */
class Bo3EventPrint extends Bo3Event {
    /**
     * @param {import('../Bo3')} bo3 BO3 runtime.
     * @param {string} message Message to print.
     */
    constructor(bo3, message) {
        super(bo3, 'print');
        this.message = Bo3Event.text(message, 'Bo3EventPrint.message');
        Object.freeze(this);
    }

    /**
     * @returns {string[][]} BO3 print command record.
     */
    toRecords() {
        return [this.record([Bo3EventPrint.#message(this.message)])];
    }

    static #message(value) {
        const message = String(value ?? '')
            .replace(/[\0\r\n|]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return (message || '<empty>').slice(0, MAX_PRINT_LEN);
    }
}

module.exports = Bo3EventPrint;

