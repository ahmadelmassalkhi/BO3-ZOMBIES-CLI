const Bo3EventPackAPunch = require('../../Bo3/Bo3Events/Bo3EventPackAPunch');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandPackAPunch extends GameCliCommand {
    constructor() {
        super('pap', [
            'pap',
            'pap default',
            'pap all',
        ], 'Pack-a-Punches the held weapon or all weapons.', [
            'pap defaults to pap default.',
        ]);
    }

    events(bo3, args) {
        if (args.length > 1) throw this.usageError('pap usage: pap [default|all].');
        if (args[0] && args[0] !== 'default' && args[0] !== 'all') throw this.usageError('pap target must be default or all.');
        return [new Bo3EventPackAPunch(bo3, args[0] || 'default')];
    }
}

module.exports = GameCliCommandPackAPunch;

