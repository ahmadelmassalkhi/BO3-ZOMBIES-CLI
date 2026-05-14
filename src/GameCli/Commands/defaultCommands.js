const CommandDiscovery = require('../../CommandDiscovery');
const GameCliCommand = require('./GameCliCommand');

let cachedCommands = null;

/**
 * @returns {ReadonlyArray<GameCliCommand>} Discovered gameplay commands.
 */
module.exports = () => {
    if (!cachedCommands) {
        cachedCommands = CommandDiscovery.load({
            directory: __dirname,
            prefix: 'GameCliCommand',
            baseClass: GameCliCommand,
        });
    }

    return cachedCommands;
};
