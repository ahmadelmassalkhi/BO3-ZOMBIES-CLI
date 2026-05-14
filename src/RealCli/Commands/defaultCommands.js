const CommandDiscovery = require('../../CommandDiscovery');
const RealCliCommand = require('./RealCliCommand');
const RealCliCommandServices = require('./RealCliCommandServices');

let cachedCommandClasses = null;

/**
 * @param {import('../../GameCli/GameCli')} gameCli Programmatic BO3 CLI.
 * @param {import('../RealCliCache')} cache Interactive cache view.
 * @param {() => void} clearScreen Clears the visible terminal.
 * @returns {ReadonlyArray<import('./RealCliCommand')>} Default interactive-only commands.
 */
module.exports = (gameCli, cache, clearScreen) => {
    const services = new RealCliCommandServices(gameCli, cache, clearScreen);
    if (!cachedCommandClasses) {
        cachedCommandClasses = CommandDiscovery.loadClasses({
            directory: __dirname,
            prefix: 'RealCliCommand',
            baseClass: RealCliCommand,
            exclude: [
                'RealCliCommandRegistry.js',
                'RealCliCommandServices.js',
            ],
        });
    }

    return Object.freeze(cachedCommandClasses
        .map((Command) => new Command(services))
        .sort((left, right) => left.name.localeCompare(right.name)));
};
