const Bo3EventPerk = require('../../Bo3/Bo3Events/Bo3EventPerk');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandPerk extends GameCliCommand {
    constructor() {
        super('perk', 'perk [give|take] [perk]', 'Gives or takes perks.');
    }

    events(bo3, args) {
        const action = GameCliCommandPerk.#action(args[0]) ? args[0] : Bo3EventPerk.actions.GIVE;
        const perkArgs = GameCliCommandPerk.#action(args[0]) ? args.slice(1) : args;
        return [new Bo3EventPerk(bo3, action, this.tokenText(perkArgs, action === Bo3EventPerk.actions.TAKE ? 'last' : 'random'))];
    }

    static #action(value) {
        return ['give', 'add', '+', 'take', 'remove', '-'].includes(String(value || '').toLowerCase());
    }
}

module.exports = GameCliCommandPerk;

