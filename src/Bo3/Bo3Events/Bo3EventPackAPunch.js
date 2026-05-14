const Bo3Event = require('./Bo3Event');

const TOKENS = Object.freeze({
    DEFAULT: 'default',
    ALL: 'all',
});

/**
 * Pack-a-Punches the held weapon or all weapons.
 */
class Bo3EventPackAPunch extends Bo3Event {
    /**
     * @param {import('../Bo3')} bo3 BO3 runtime.
     * @param {string} [target=TOKENS.DEFAULT] Pack-a-Punch target.
     */
    constructor(bo3, target = TOKENS.DEFAULT) {
        const cleaned = Bo3EventPackAPunch.#target(target);
        super(bo3, 'pap', [cleaned]);
        Object.freeze(this);
    }

    static get tokens() { return TOKENS; }

    static #target(target) {
        const cleaned = Bo3Event.cleanToken(target ?? TOKENS.DEFAULT).toLowerCase();
        if (!cleaned || cleaned === TOKENS.DEFAULT) return TOKENS.DEFAULT;
        if (cleaned === TOKENS.ALL) return TOKENS.ALL;
        throw new TypeError('pap.target must be default or all.');
    }
}

module.exports = Bo3EventPackAPunch;

