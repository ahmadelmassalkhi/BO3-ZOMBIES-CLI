const GameCli = require('../GameCli/GameCli');

/**
 * Merges BO3 transport cache with commands still waiting in the interactive shell.
 */
class RealCliCache {
    /**
     * @param {GameCli} gameCli Programmatic BO3 CLI.
     * @param {import('./RealCliCommandQueue')} commandQueue Interactive command queue.
     */
    constructor(gameCli, commandQueue) {
        if (!(gameCli instanceof GameCli)) throw new TypeError('RealCliCache.gameCli must be a GameCli instance.');
        if (!commandQueue || typeof commandQueue.pendingRequests !== 'function' || typeof commandQueue.activeRequests !== 'function') {
            throw new TypeError('RealCliCache.commandQueue must be a RealCliCommandQueue.');
        }

        this.#gameCli = gameCli;
        this.#commandQueue = commandQueue;
        Object.freeze(this);
    }

    #gameCli;
    #commandQueue;

    /**
     * @returns {{activeRequests: string[], requests: string[], active: boolean}} Full interactive + BO3 cache snapshot.
     */
    snapshot() {
        const bo3 = this.#gameCli.showCache().data || {};
        const activeRequests = RealCliCache.#requests(bo3.activeRequests);
        const shellActiveRequests = this.#commandQueue.activeRequests();
        const active = activeRequests.length ? activeRequests : shellActiveRequests;
        const requests = RealCliCache.#requests(bo3.requests).concat(this.#commandQueue.pendingRequests());

        return {
            activeRequests: active,
            requests,
            active: Boolean(active.length),
        };
    }

    /**
     * Clears queued commands without canceling a command already sent to BO3.
     *
     * @param {'all'|'last'} [mode='all'] Clear mode.
     * @param {number} [count=1] Number of last pending commands to clear.
     * @returns {{cleared: number, requests: string[], activeRequests: string[], active: boolean}} Clear result.
     */
    clear(mode = 'all', count = 1) {
        const shellCleared = this.#commandQueue.clear(mode, count);
        const remaining = mode === 'last' ? Math.max(0, count - shellCleared.length) : count;
        const bo3 = remaining > 0
            ? (this.#gameCli.clearCache(mode, remaining).data || {})
            : (this.#gameCli.showCache().data || {});
        const activeRequests = RealCliCache.#requests(bo3.activeRequests);
        const active = activeRequests.length ? activeRequests : this.#commandQueue.activeRequests();

        return {
            cleared: shellCleared.length + (bo3.cleared || 0),
            requests: RealCliCache.#requests(bo3.requests).concat(shellCleared),
            activeRequests: active,
            active: Boolean(active.length),
        };
    }

    static #requests(value) {
        return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : [];
    }
}

module.exports = RealCliCache;
