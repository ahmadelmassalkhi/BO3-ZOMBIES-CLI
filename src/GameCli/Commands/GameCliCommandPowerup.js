const Bo3EventPowerup = require('../../Bo3/Bo3Events/Bo3EventPowerup');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandPowerup extends GameCliCommand {
    constructor() {
        super('powerup', [
            'powerup',
            'powerup <powerup>',
        ], 'Gives a powerup.', [
            'Use get powerups to list valid powerup names.',
            'powerup defaults to random.',
            'powerup does not take give or take.',
        ]);
    }

    events(bo3, args) {
        if (args.length > 1) throw this.usageError('powerup usage: powerup [powerup].');
        if (GameCliCommandPowerup.#action(args[0])) throw this.usageError('powerup does not take an action.');

        const powerup = args[0] ? this.canonicalToken(args[0], 'powerup.name') : 'random';
        return [new Bo3EventPowerup(bo3, powerup)];
    }

    static #action(value) {
        return ['give', 'add', '+', 'take', 'remove', '-'].includes(String(value || '').toLowerCase());
    }
}

module.exports = GameCliCommandPowerup;

