const GameCli = require('../../GameCli/GameCli');
const RealCliCache = require('../RealCliCache');

/**
 * Exact dependency bundle passed to discovered RealCli commands.
 */
class RealCliCommandServices {
    /**
     * @param {GameCli} gameCli Programmatic BO3 CLI.
     * @param {RealCliCache} cache Interactive cache view.
     * @param {() => void} clearScreen Clears the visible terminal.
     */
    constructor(gameCli, cache, clearScreen) {
        if (!(gameCli instanceof GameCli)) throw new TypeError('RealCliCommandServices.gameCli must be a GameCli instance.');
        if (!(cache instanceof RealCliCache)) throw new TypeError('RealCliCommandServices.cache must be a RealCliCache.');
        if (typeof clearScreen !== 'function') throw new TypeError('RealCliCommandServices.clearScreen must be a function.');

        this.gameCli = gameCli;
        this.cache = cache;
        this.clearScreen = clearScreen;
        Object.freeze(this);
    }
}

module.exports = RealCliCommandServices;
