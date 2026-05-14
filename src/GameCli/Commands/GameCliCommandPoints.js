const Bo3EventPoints = require('../../Bo3/Bo3Events/Bo3EventPoints');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandPoints extends GameCliCommand {
    constructor() {
        super('points', [
            'points +<amount>',
            'points -<amount>',
        ], 'Adds or removes points.', [
            'amount must be a non-zero integer.',
        ]);
    }

    events(bo3, args) {
        if (args.length !== 1) throw this.usageError('points usage: points <+amount|-amount>.');
        if (!/^[+-]\d+$/.test(args[0])) throw this.usageError('points.amount must start with + or -.');

        const amount = Number.parseInt(args[0], 10);
        if (!Number.isSafeInteger(amount) || amount === 0) throw this.usageError('points.amount must not be zero.');
        return [new Bo3EventPoints(bo3, Math.abs(amount), amount > 0)];
    }
}

module.exports = GameCliCommandPoints;

