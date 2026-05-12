const Bo3Event = require('./Bo3Event');

/**
 * Changes the BO3 round number.
 */
class Bo3EventRound extends Bo3Event {
    /**
     * @param {import('../Bo3')} bo3 BO3 runtime.
     * @param {number} [count=1] Round count.
     * @param {boolean} [up=true] True to add rounds, false to remove rounds.
     */
    constructor(bo3, count = 1, up = true) {
        Bo3Event.positiveInt(count, 'Bo3EventRound.count');
        Bo3Event.boolean(up, 'Bo3EventRound.up');
        super(bo3, 'round');
        this.count = count;
        this.up = up;
        Object.freeze(this);
    }

    /**
     * @returns {string[][]} BO3 round command record.
     */
    toRecords() {
        return [this.record([String(this.count), this.up ? 'up' : 'down'])];
    }
}

module.exports = Bo3EventRound;

