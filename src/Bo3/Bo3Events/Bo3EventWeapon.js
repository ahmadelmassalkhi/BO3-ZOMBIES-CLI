const Bo3Event = require('./Bo3Event');

const ACTIONS = Object.freeze({
    GIVE: 'give',
    TAKE: 'take',
});

const TOKENS = Object.freeze({
    RANDOM: 'random',
    DEFAULT: 'default',
    ALL: 'all',
    WONDERWEAPON: 'wonderweapon',
});

const WEAPONS = Object.freeze({
    PISTOL_STANDARD: 'pistol_standard',
    BOUNCING_BETTY: 'bouncingbetty',
    CYMBAL_MONKEY: 'cymbal_monkey',
    FRAG_GRENADE: 'frag_grenade',
    KNIFE: 'knife',
    BOWIE_KNIFE: 'bowie_knife',
    RAY_GUN: 'ray_gun',
    RAY_GUN_UPGRADED: 'ray_gun_upgraded',
    RAYGUN_MARK2: 'raygun_mark2',
    RAYGUN_MARK2_UPGRADED: 'raygun_mark2_upgraded',
    TESLA_GUN: 'tesla_gun',
    TESLA_GUN_UPGRADED: 'tesla_gun_upgraded',
    AR_ACCURATE: 'ar_accurate',
    AR_CQB: 'ar_cqb',
    AR_DAMAGE: 'ar_damage',
    AR_LONGBURST: 'ar_longburst',
    AR_MARKSMAN: 'ar_marksman',
    AR_STANDARD: 'ar_standard',
    AR_FAMAS: 'ar_famas',
    AR_GARAND: 'ar_garand',
    AR_PEACEKEEPER: 'ar_peacekeeper',
    LMG_CQB: 'lmg_cqb',
    LMG_HEAVY: 'lmg_heavy',
    LMG_LIGHT: 'lmg_light',
    LMG_SLOWFIRE: 'lmg_slowfire',
    PISTOL_BURST: 'pistol_burst',
    PISTOL_FULLAUTO: 'pistol_fullauto',
    PISTOL_REVOLVER38: 'pistol_revolver38',
    PISTOL_ENERGY: 'pistol_energy',
    SHOTGUN_FULLAUTO: 'shotgun_fullauto',
    SHOTGUN_PRECISION: 'shotgun_precision',
    SHOTGUN_PUMP: 'shotgun_pump',
    SHOTGUN_SEMIAUTO: 'shotgun_semiauto',
    SHOTGUN_ENERGY: 'shotgun_energy',
    LAUNCHER_STANDARD: 'launcher_standard',
    LAUNCHER_MULTI: 'launcher_multi',
    SMG_BURST: 'smg_burst',
    SMG_CAPACITY: 'smg_capacity',
    SMG_FASTFIRE: 'smg_fastfire',
    SMG_STANDARD: 'smg_standard',
    SMG_VERSATILE: 'smg_versatile',
    SMG_STEN: 'smg_sten',
    SMG_MP40: 'smg_mp40',
    SMG_PPSH: 'smg_ppsh',
    SMG_THOMPSON: 'smg_thompson',
    SNIPER_FASTBOLT: 'sniper_fastbolt',
    SNIPER_FASTSEMI: 'sniper_fastsemi',
    SNIPER_POWERBOLT: 'sniper_powerbolt',
    ZOD_RIOTSHIELD: 'zod_riotshield',
    HERO_GRAVITYSPIKES_MELEE: 'hero_gravityspikes_melee',
    OCTOBOMB: 'octobomb',
    RAYGUN_MARK3: 'raygun_mark3',
    RAYGUN_MARK3_UPGRADED: 'raygun_mark3_upgraded',
    SPECIAL_CROSSBOW_DW: 'special_crossbow_dw',
    THUNDERGUN: 'thundergun',
    THUNDERGUN_UPGRADED: 'thundergun_upgraded',
});

const WEAPON_ALIASES = Object.freeze({
    raygun: WEAPONS.RAY_GUN,
    ray_gun: WEAPONS.RAY_GUN,
    portersx2raygun: WEAPONS.RAY_GUN_UPGRADED,
    porters_x2_ray_gun: WEAPONS.RAY_GUN_UPGRADED,
    raygunmark2: WEAPONS.RAYGUN_MARK2,
    raygun_mark2: WEAPONS.RAYGUN_MARK2,
    ray_gun_mark2: WEAPONS.RAYGUN_MARK2,
    raygunmark2upgraded: WEAPONS.RAYGUN_MARK2_UPGRADED,
    raygun_mark2_upgraded: WEAPONS.RAYGUN_MARK2_UPGRADED,
    ray_gun_mark2_upgraded: WEAPONS.RAYGUN_MARK2_UPGRADED,
    raygunmark3: WEAPONS.RAYGUN_MARK3,
    raygun_mark3: WEAPONS.RAYGUN_MARK3,
    ray_gun_mark3: WEAPONS.RAYGUN_MARK3,
    raygunmark3upgraded: WEAPONS.RAYGUN_MARK3_UPGRADED,
    raygun_mark3_upgraded: WEAPONS.RAYGUN_MARK3_UPGRADED,
    ray_gun_mark3_upgraded: WEAPONS.RAYGUN_MARK3_UPGRADED,
    thundergun: WEAPONS.THUNDERGUN,
    zeuscannon: WEAPONS.THUNDERGUN_UPGRADED,
    zeus_cannon: WEAPONS.THUNDERGUN_UPGRADED,
    teslagun: WEAPONS.TESLA_GUN,
    tesla_gun: WEAPONS.TESLA_GUN,
    wonder: TOKENS.WONDERWEAPON,
    wonderweapon: TOKENS.WONDERWEAPON,
    wonder_weapon: TOKENS.WONDERWEAPON,
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
    static get weapons() { return WEAPONS; }

    static #action(action) {
        const cleaned = String(action ?? '').trim().toLowerCase();
        if (cleaned === ACTIONS.TAKE || cleaned === 'remove' || cleaned === '-') return ACTIONS.TAKE;
        if (cleaned === 'pap' || cleaned === 'upgrade') {
            throw new Error('Pack-a-Punch is a standalone command. Use pap.');
        }
        return ACTIONS.GIVE;
    }

    static #weapon(action, weaponName) {
        if (action === ACTIONS.TAKE) {
            const cleaned = Bo3Event.cleanToken(weaponName ?? TOKENS.DEFAULT).toLowerCase();
            return cleaned === TOKENS.ALL ? TOKENS.ALL : TOKENS.DEFAULT;
        }

        const cleaned = Bo3Event.cleanToken(weaponName ?? TOKENS.RANDOM).toLowerCase();
        if (!cleaned) return TOKENS.RANDOM;
        return WEAPON_ALIASES[cleaned] || cleaned;
    }
}

module.exports = Bo3EventWeapon;

