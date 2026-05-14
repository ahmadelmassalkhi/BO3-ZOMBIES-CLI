const Bo3EventWeapon = require('../../Bo3/Bo3Events/Bo3EventWeapon');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandWeapon extends GameCliCommand {
    constructor() {
        super('weapon', [
            'weapon',
            'weapon give',
            'weapon give <weapon>',
            'weapon take',
            'weapon take default',
            'weapon take all',
        ], 'Gives or takes weapons.', [
            'Use `get weapons` to list valid weapon names.',
            '`weapon` defaults to `weapon give`.',
            '`weapon give` defaults to random.',
            '`weapon take` defaults to default.',
        ]);
    }

    events(bo3, args) {
        if (args.length > 2) throw this.usageError('weapon accepts at most one action and one target.');
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

