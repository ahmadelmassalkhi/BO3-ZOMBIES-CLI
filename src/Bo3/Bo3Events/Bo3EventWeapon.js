const Bo3Event = require('./Bo3Event');

const ACTIONS = Object.freeze({
    GIVE: 'give',
    TAKE: 'take',
});

const TOKENS = Object.freeze({
    RANDOM: 'random',
    DEFAULT: 'default',
    ALL: 'all',
});

/**
 * Gives or removes BO3 weapons.
 */
class Bo3EventWeapon extends Bo3Event {
    /**
     * @param {import('../Bo3')} bo3 BO3 runtime.
     * @param {string} [action=ACTIONS.GIVE] Weapon action.
     * @param {string} [weaponName=TOKENS.RANDOM] Weapon token/name.
     */
    constructor(bo3, action = ACTIONS.GIVE, weaponName = TOKENS.RANDOM) {
        const cleanAction = Bo3EventWeapon.#action(action);
        super(bo3, 'weapon', [
            cleanAction,
            Bo3EventWeapon.#weapon(cleanAction, weaponName),
        ]);
        Object.freeze(this);
    }

    static get actions() { return ACTIONS; }
    static get tokens() { return TOKENS; }

    static #action(action) {
        const cleaned = String(action ?? '').trim().toLowerCase();
        if (cleaned === ACTIONS.GIVE) return ACTIONS.GIVE;
        if (cleaned === ACTIONS.TAKE) return ACTIONS.TAKE;
        throw new TypeError('weapon.action must be give or take.');
    }

    static #weapon(action, weaponName) {
        if (action === ACTIONS.TAKE) {
            const token = Bo3Event.cleanToken(weaponName ?? TOKENS.DEFAULT);
            if (!token || token === TOKENS.DEFAULT) return TOKENS.DEFAULT;
            if (token === TOKENS.ALL) return TOKENS.ALL;
            throw new TypeError('weapon.take target must be default or all.');
        }

        const token = Bo3Event.cleanToken(weaponName ?? TOKENS.RANDOM);
        if (!token) return TOKENS.RANDOM;
        if (/\s/.test(token) || token !== token.toLowerCase()) {
            throw new TypeError('weapon.name must be one lowercase canonical token. Use get weapons.');
        }

        return token;
    }
}

module.exports = Bo3EventWeapon;

