const Bo3EventRound = require('../../Bo3/Bo3Events/Bo3EventRound');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandRound extends GameCliCommand {
    constructor() {
        super('round', 'round <+count|-count>', 'Adds or removes rounds.');
    }

    events(bo3, args) {
        if (args.length !== 1) throw new TypeError('round usage: round <+count|-count>.');

        const count = this.signedInt(args[0], 'round.count');
        return [new Bo3EventRound(bo3, Math.abs(count), count > 0)];
    }
}

module.exports = GameCliCommandRound;

