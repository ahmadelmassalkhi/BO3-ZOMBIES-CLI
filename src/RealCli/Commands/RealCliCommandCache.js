const GameCliCommandCache = require('../../GameCli/Commands/Core/GameCliCommandCache');
const GameCliResponse = require('../../GameCli/GameCliResponse');
const RealCliCommand = require('./RealCliCommand');
const RealCliCommandServices = require('./RealCliCommandServices');

/**
 * Interactive cache command that includes both BO3 transport cache and shell queue.
 */
class RealCliCommandCache extends RealCliCommand {
    /**
     * @param {RealCliCommandServices} services RealCli command dependencies.
     */
    constructor(services) {
        super('cache');
        if (!(services instanceof RealCliCommandServices)) throw new TypeError('RealCliCommandCache.services must be a RealCliCommandServices.');

        this.#services = services;
        Object.freeze(this);
    }

    #services;

    /**
     * @param {string[]} tokens Lowercase cache command tokens.
     */
    run(tokens) {
        if (tokens.length === 2 && tokens[1] === 'help') {
            return this.#services.gameCli.preview('cache help');
        }

        try {
            const cache = GameCliCommandCache.parse(tokens);
            return cache.action === 'clear'
                ? GameCliResponse.cacheCleared(this.#services.cache.clear(cache.mode, cache.count))
                : GameCliResponse.cacheShown(this.#services.cache.snapshot());
        } catch (error) {
            return GameCliResponse.failure(error);
        }
    }
}

module.exports = RealCliCommandCache;
