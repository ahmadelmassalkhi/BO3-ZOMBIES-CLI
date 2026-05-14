const Bo3EventWeapon = require('../../Bo3/Bo3Events/Bo3EventWeapon');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandWeapon extends GameCliCommand {
    constructor() {
        super('weapon', 'weapon [give [weapon]|take [default|all]]', 'Gives or takes weapons.');
    }

    events(bo3, args) {
        if (args.length > 2) throw this.usageError('weapon usage: weapon [give|take] [weapon].');
        const action = args.length ? GameCliCommandWeapon.#action(args[0]) : Bo3EventWeapon.actions.GIVE;
        if (!action) throw this.usageError('weapon.action must be give or take.');

        const weaponArgs = args.length ? args.slice(1) : [];
        const cleanAction = action;
        const fallback = cleanAction === Bo3EventWeapon.actions.TAKE ? 'default' : 'random';
        const weapon = weaponArgs[0] ? this.canonicalToken(weaponArgs[0], 'weapon.name') : fallback;
        if (cleanAction === Bo3EventWeapon.actions.TAKE && weapon !== 'default' && weapon !== 'all') {
            throw this.usageError('weapon.take target must be default or all.');
        }

        return [new Bo3EventWeapon(bo3, cleanAction, weapon)];
    }

    static #action(value) {
        const action = String(value || '').toLowerCase();
        if (action === 'give' || action === 'take') return action;
        return undefined;
    }
}

module.exports = GameCliCommandWeapon;

