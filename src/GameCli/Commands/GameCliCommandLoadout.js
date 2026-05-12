const Bo3EventLoadout = require('../../Bo3/Bo3Events/Bo3EventLoadout');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandLoadout extends GameCliCommand {
    constructor() {
        super('loadout', 'loadout [godmode|purge]', 'Runs a built-in loadout.');
    }

    events(bo3, args) {
        if (args.length > 1) throw new TypeError('loadout usage: loadout [godmode|purge].');
        return [new Bo3EventLoadout(bo3, args[0] || 'godmode')];
    }
}

module.exports = GameCliCommandLoadout;

