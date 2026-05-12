const Bo3Event = require('./Bo3Event');

/**
 * Adds or removes BO3 points.
 */
class Bo3EventPoints extends Bo3Event {
    /**
     * @param {import('../Bo3')} bo3 BO3 runtime.
     * @param {number} points Positive point amount.
     * @param {boolean} [add=true] True to add points, false to subtract points.
     */
    constructor(bo3, points, add = true) {
        Bo3Event.positiveInt(points, 'Bo3EventPoints.points');
        Bo3Event.boolean(add, 'Bo3EventPoints.add');
        super(bo3, 'points');
        this.points = points;
        this.add = add;
        Object.freeze(this);
    }

    /**
     * @returns {string[][]} BO3 points command record.
     */
    toRecords() {
        return [this.record([String(this.points), this.add ? 'add' : 'subtract'])];
    }
}

module.exports = Bo3EventPoints;

