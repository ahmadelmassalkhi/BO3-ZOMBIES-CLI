const Bo3EventWeapon = require('../../Bo3/Bo3Events/Bo3EventWeapon');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandWeapon extends GameCliCommand {
    constructor() {
        super('weapon', 'weapon [give|take] [weapon]', 'Gives or takes weapons.');
    }

    events(bo3, args) {
        const action = GameCliCommandWeapon.#action(args[0]) ? args[0] : Bo3EventWeapon.actions.GIVE;
        const weaponArgs = GameCliCommandWeapon.#action(args[0]) ? args.slice(1) : args;
        const fallback = action === Bo3EventWeapon.actions.TAKE ? 'default' : 'random';
        return [new Bo3EventWeapon(bo3, action, this.tokenText(weaponArgs, fallback))];
    }

    static #action(value) {
        return ['give', 'add', '+', 'take', 'remove', '-'].includes(String(value || '').toLowerCase());
    }
}

module.exports = GameCliCommandWeapon;

