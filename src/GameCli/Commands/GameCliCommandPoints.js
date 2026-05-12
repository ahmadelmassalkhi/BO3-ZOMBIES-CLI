const Bo3EventPoints = require('../../Bo3/Bo3Events/Bo3EventPoints');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandPoints extends GameCliCommand {
    constructor() {
        super('points', 'points <+amount|-amount>', 'Adds or removes points.');
    }

    events(bo3, args) {
        if (args.length !== 1) throw new TypeError('points usage: points <+amount|-amount>.');

        const amount = this.signedInt(args[0], 'points.amount');
        return [new Bo3EventPoints(bo3, Math.abs(amount), amount > 0)];
    }
}

module.exports = GameCliCommandPoints;

