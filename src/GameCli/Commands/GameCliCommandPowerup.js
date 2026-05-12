const Bo3EventPowerup = require('../../Bo3/Bo3Events/Bo3EventPowerup');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandPowerup extends GameCliCommand {
    constructor() {
        super('powerup', 'powerup [powerup]', 'Gives a powerup.');
    }

    events(bo3, args) {
        return [new Bo3EventPowerup(bo3, this.tokenText(args, 'random'))];
    }
}

module.exports = GameCliCommandPowerup;

