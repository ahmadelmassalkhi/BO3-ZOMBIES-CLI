const Bo3Event = require('./Bo3Event');

const ACTIONS = Object.freeze({
    GIVE: 'give',
    TAKE: 'take',
});

const TOKENS = Object.freeze({
    RANDOM: 'random',
    LAST: 'last',
    ALL: 'all',
});

/**
 * Gives or removes BO3 perks.
 */
class Bo3EventPerk extends Bo3Event {
    /**
     * @param {import('../Bo3')} bo3 BO3 runtime.
     * @param {string} [action=ACTIONS.GIVE] Perk action.
     * @param {string} [perkName=TOKENS.RANDOM] Perk token/name.
     */
    constructor(bo3, action = ACTIONS.GIVE, perkName = TOKENS.RANDOM) {
        const cleanAction = Bo3EventPerk.#action(action);
        super(bo3, 'perk', [
            cleanAction,
            Bo3EventPerk.#perk(cleanAction, perkName),
        ]);
        Object.freeze(this);
    }

    static get actions() { return ACTIONS; }
    static get tokens() { return TOKENS; }

    static #action(action) {
        const cleaned = String(action ?? '').trim().toLowerCase();
        if (cleaned === ACTIONS.GIVE) return ACTIONS.GIVE;
        if (cleaned === ACTIONS.TAKE) return ACTIONS.TAKE;
        throw new TypeError('perk.action must be give or take.');
    }

    static #perk(action, perkName) {
        const fallback = action === ACTIONS.TAKE ? TOKENS.LAST : TOKENS.RANDOM;
        const token = Bo3Event.cleanToken(perkName ?? fallback);
        if (!token) return fallback;
        if (/\s/.test(token) || token !== token.toLowerCase()) {
            throw new TypeError('perk.name must be one lowercase canonical token. Use get perks.');
        }

        return token;
    }
}

module.exports = Bo3EventPerk;

