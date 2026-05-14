const Bo3EventZombie = require('../../Bo3/Bo3Events/Bo3EventZombie');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandZombie extends GameCliCommand {
    constructor() {
        super('zombie', [
            'zombie',
            'zombie <count>',
            'zombie <count> <name>',
        ], 'Spawns zombies.', [
            'zombie defaults to zombie 1 Zombie.',
            'count must be the first argument when provided.',
        ]);
    }

    events(bo3, args) {
        if (args.length > 2) throw this.usageError('zombie usage: zombie [count] [name].');
        if (!args.length) return [new Bo3EventZombie(bo3)];

        if (!/^\d+$/.test(args[0])) throw this.usageError('zombie.count must be the first argument and must be a positive integer.');

        const count = Number.parseInt(args[0], 10);
        if (!Number.isSafeInteger(count) || count < 1) throw this.usageError('zombie.count must be a positive integer.');
        const name = args[1] || 'Zombie';
        return [new Bo3EventZombie(bo3, name, count)];
    }
}

module.exports = GameCliCommandZombie;

