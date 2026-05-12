const Bo3Event = require('./Bo3Event');

/**
 * Spawns BO3 zombies.
 */
class Bo3EventZombie extends Bo3Event {
    /**
     * @param {import('../Bo3')} bo3 BO3 runtime.
     * @param {string} [name='Zombie'] Zombie name.
     * @param {number} [count=1] Zombie count.
     */
    constructor(bo3, name = 'Zombie', count = 1) {
        Bo3Event.text(name, 'Bo3EventZombie.name');
        Bo3Event.positiveInt(count, 'Bo3EventZombie.count');
        super(bo3, 'zombie');
        this.name = name;
        this.count = count;
        Object.freeze(this);
    }

    /**
     * @returns {string[][]} BO3 zombie command record.
     */
    toRecords() {
        return [this.record([
            Bo3Event.cleanToken(this.name) || 'Zombie',
            String(Bo3Event.cleanPositiveCount(this.count)),
        ])];
    }
}

module.exports = Bo3EventZombie;

