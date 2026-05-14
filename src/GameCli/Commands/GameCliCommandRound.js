const Bo3EventRound = require('../../Bo3/Bo3Events/Bo3EventRound');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandRound extends GameCliCommand {
    constructor() {
        super('round', [
            'round +<count>',
            'round -<count>',
        ], 'Adds or removes rounds.', [
            'count must be a non-zero integer.',
        ]);
    }

    events(bo3, args) {
        if (args.length !== 1) throw this.usageError('round usage: round <+count|-count>.');
        if (!/^[+-]\d+$/.test(args[0])) throw this.usageError('round.count must start with + or -.');

        const count = Number.parseInt(args[0], 10);
        if (!Number.isSafeInteger(count) || count === 0) throw this.usageError('round.count must not be zero.');
        return [new Bo3EventRound(bo3, Math.abs(count), count > 0)];
    }
}

module.exports = GameCliCommandRound;

