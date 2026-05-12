const Bo3Event = require('./Bo3Event');

const TOKENS = Object.freeze({
    RANDOM: 'random',
});

const POWERUPS = Object.freeze({
    BONFIRE_SALE: 'bonfire_sale',
    CARPENTER: 'carpenter',
    DOUBLE_POINTS: 'double_points',
    FIRE_SALE: 'fire_sale',
    FREE_PERK: 'free_perk',
    FULL_AMMO: 'full_ammo',
    INSTA_KILL: 'insta_kill',
    MINIGUN: 'minigun',
    NUKE: 'nuke',
    SHIELD_CHARGE: 'shield_charge',
    WW_GRENADE: 'ww_grenade',
});

const POWERUP_ALIASES = Object.freeze({
    maxammo: POWERUPS.FULL_AMMO,
    max_ammo: POWERUPS.FULL_AMMO,
    instakill: POWERUPS.INSTA_KILL,
    deathmachine: POWERUPS.MINIGUN,
    death_machine: POWERUPS.MINIGUN,
    doublepoints: POWERUPS.DOUBLE_POINTS,
    firesale: POWERUPS.FIRE_SALE,
    freeperk: POWERUPS.FREE_PERK,
    bonfiresale: POWERUPS.BONFIRE_SALE,
    shieldcharge: POWERUPS.SHIELD_CHARGE,
    widowswine: POWERUPS.WW_GRENADE,
    widows_wine: POWERUPS.WW_GRENADE,
    widowwine: POWERUPS.WW_GRENADE,
    widow_wine: POWERUPS.WW_GRENADE,
});

/**
 * Gives a BO3 powerup.
 */
class Bo3EventPowerup extends Bo3Event {
    /**
     * @param {import('../Bo3')} bo3 BO3 runtime.
     * @param {string} [powerupName=TOKENS.RANDOM] Powerup token/name.
     */
    constructor(bo3, powerupName = TOKENS.RANDOM) {
        super(bo3, 'powerup', [Bo3EventPowerup.#powerup(powerupName)]);
        Object.freeze(this);
    }

    static get tokens() { return TOKENS; }
    static get powerups() { return POWERUPS; }

    static #powerup(powerupName) {
        const cleaned = Bo3Event.cleanToken(powerupName ?? TOKENS.RANDOM)
            .toLowerCase()
            .replace(/[\s-]+/g, '_');

        if (!cleaned) return TOKENS.RANDOM;
        return POWERUP_ALIASES[cleaned] || cleaned;
    }
}

module.exports = Bo3EventPowerup;

