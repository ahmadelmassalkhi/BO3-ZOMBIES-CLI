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

const PERKS = Object.freeze({
    JUGGERNOG: 'juggernog',
    QUICK_REVIVE: 'quickrevive',
    SPEED_COLA: 'fastreload',
    DOUBLE_TAP_2: 'doubletap2',
    STAMIN_UP: 'staminup',
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
    static get perks() { return PERKS; }

    static #action(action) {
        const cleaned = String(action ?? '').trim().toLowerCase();
        return cleaned === ACTIONS.TAKE || cleaned === 'remove' || cleaned === '-'
            ? ACTIONS.TAKE
            : ACTIONS.GIVE;
    }

    static #perk(action, perkName) {
        const fallback = action === ACTIONS.TAKE ? TOKENS.LAST : TOKENS.RANDOM;
        const cleaned = Bo3Event.cleanToken(perkName ?? fallback).toLowerCase();
        return cleaned || fallback;
    }
}

module.exports = Bo3EventPerk;

