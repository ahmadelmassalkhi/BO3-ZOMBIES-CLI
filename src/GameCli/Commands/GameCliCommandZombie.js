const Bo3EventZombie = require('../../Bo3/Bo3Events/Bo3EventZombie');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandZombie extends GameCliCommand {
    constructor() {
        super('zombie', 'zombie [name] [count]', 'Spawns zombies.');
    }

    events(bo3, args) {
        if (!args.length) return [new Bo3EventZombie(bo3)];

        const last = args[args.length - 1];
        const hasCount = /^\d+$/.test(last);
        const count = hasCount ? this.positiveInt(last, 'zombie.count') : 1;
        const nameParts = hasCount ? args.slice(0, -1) : args;
        const name = nameParts.length ? nameParts.join(' ') : 'Zombie';
        return [new Bo3EventZombie(bo3, name, count)];
    }
}

module.exports = GameCliCommandZombie;

