const Bo3Event = require('./Bo3Event');
const Bo3EventPackAPunch = require('./Bo3EventPackAPunch');
const Bo3EventPerk = require('./Bo3EventPerk');
const Bo3EventPoints = require('./Bo3EventPoints');
const Bo3EventRound = require('./Bo3EventRound');
const Bo3EventWeapon = require('./Bo3EventWeapon');

const LOADOUTS = Object.freeze({
    GODMODE: 'godmode',
    PURGE: 'purge',
});

/**
 * Runs a named BO3 loadout made from smaller BO3 events.
 */
class Bo3EventLoadout extends Bo3Event {
    /**
     * @param {import('../Bo3')} bo3 BO3 runtime.
     * @param {string} [preset=LOADOUTS.GODMODE] Loadout preset name.
     */
    constructor(bo3, preset = LOADOUTS.GODMODE) {
        super(bo3, 'loadout');
        this.preset = Bo3EventLoadout.#preset(preset);
        this.events = Object.freeze(Bo3EventLoadout.#events(bo3, this.preset));
        Object.freeze(this);
    }

    static get loadouts() { return LOADOUTS; }

    /**
     * @returns {string[][]} BO3 records from the loadout's child events.
     */
    toRecords() {
        return this.events.flatMap((event) => event.toRecords());
    }

    static #preset(preset) {
        const selected = Bo3Event.text(preset, 'Bo3EventLoadout.preset').trim().toLowerCase();
        if (selected === LOADOUTS.GODMODE || selected === LOADOUTS.PURGE) return selected;
        throw new TypeError(`Bo3EventLoadout.preset must be "${LOADOUTS.GODMODE}" or "${LOADOUTS.PURGE}".`);
    }

    static #events(bo3, preset) {
        return preset === LOADOUTS.PURGE
            ? [
                new Bo3EventPerk(bo3, Bo3EventPerk.actions.TAKE, Bo3EventPerk.tokens.ALL),
                new Bo3EventWeapon(bo3, Bo3EventWeapon.actions.TAKE, Bo3EventWeapon.tokens.ALL),
                new Bo3EventRound(bo3, 50, true),
            ]
            : [
                new Bo3EventPerk(bo3, Bo3EventPerk.actions.GIVE, Bo3EventPerk.tokens.ALL),
                new Bo3EventWeapon(bo3, Bo3EventWeapon.actions.GIVE, Bo3EventWeapon.tokens.WONDERWEAPON),
                new Bo3EventPackAPunch(bo3, Bo3EventPackAPunch.tokens.ALL),
                new Bo3EventPoints(bo3, 100000),
            ];
    }
}

module.exports = Bo3EventLoadout;

