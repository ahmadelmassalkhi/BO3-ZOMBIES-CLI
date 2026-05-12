const Bo3EventPackAPunch = require('../../Bo3/Bo3Events/Bo3EventPackAPunch');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandPackAPunch extends GameCliCommand {
    constructor() {
        super('pap', 'pap [default|all]', 'Pack-a-Punches the held weapon or all weapons.', ['packapunch', 'pack-a-punch']);
    }

    events(bo3, args) {
        if (args.length > 1) throw new TypeError('pap usage: pap [default|all].');
        return [new Bo3EventPackAPunch(bo3, args[0] || 'default')];
    }
}

module.exports = GameCliCommandPackAPunch;

