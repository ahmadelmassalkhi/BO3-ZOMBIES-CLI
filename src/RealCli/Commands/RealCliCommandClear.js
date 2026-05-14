const GameCliResponse = require('../../GameCli/GameCliResponse');
const RealCliCommand = require('./RealCliCommand');
const RealCliCommandServices = require('./RealCliCommandServices');

/**
 * Interactive clear command for the visible terminal buffer.
 */
class RealCliCommandClear extends RealCliCommand {
    /**
     * @param {RealCliCommandServices} services RealCli command dependencies.
     */
    constructor(services) {
        super('clear', ['cls']);
        if (!(services instanceof RealCliCommandServices)) throw new TypeError('RealCliCommandClear.services must be a RealCliCommandServices.');

        this.#services = services;
        Object.freeze(this);
    }

    #services;

    /**
     * @param {string[]} tokens Lowercase clear command tokens.
     */
    run(tokens) {
        if (tokens.length === 2 && tokens[1] === 'help') {
            return this.#services.gameCli.preview('clear help');
        }

        if (tokens.length === 1) {
            this.#services.clearScreen();
            return GameCliResponse.success('', { status: 'cleared' });
        }

        return GameCliResponse.failure(new TypeError('clear usage: clear. Run: clear help.'));
    }
}

module.exports = RealCliCommandClear;
