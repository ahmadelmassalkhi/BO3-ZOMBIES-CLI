const Bo3EventPrint = require('../../Bo3/Bo3Events/Bo3EventPrint');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandPrint extends GameCliCommand {
    constructor() {
        super('print', 'print <message>', 'Prints one BO3 message.');
    }

    events(bo3, args) {
        if (!args.length) throw new TypeError('print.message must be provided.');
        return [new Bo3EventPrint(bo3, args.join(' '))];
    }
}

module.exports = GameCliCommandPrint;

