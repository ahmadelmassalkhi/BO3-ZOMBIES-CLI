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
        const cleaned = Bo3Event.cleanToken(target ?? TOKENS.DEFAULT).toLowerCase();
        super(bo3, 'pap', [cleaned === TOKENS.ALL ? TOKENS.ALL : TOKENS.DEFAULT]);
        Object.freeze(this);
    }

    static get tokens() { return TOKENS; }
}

module.exports = Bo3EventPackAPunch;

