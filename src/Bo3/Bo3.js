const EventEmitter = require('events');
const GameConnection = require('./Connection/GameConnection');

const STOPPED_BEFORE_ACK = 'BO3 connection stopped before queued packets were acknowledged.';

/**
 * BO3 Zombies runtime.
 *
 * Owns the BO3 connection and sends already-built BO3 command records. It does
 * not parse CLI text and it does not know TikTok, presets, or any app layer.
 */
class Bo3 extends EventEmitter {
    #connection;
    #started;
    #stopping;
    #stopVersion;
    #ready;

    constructor() {
        super();
        this.#connection = null;
        this.#started = false;
        this.#stopping = false;
        this.#stopVersion = 0;
        this.#ready = Promise.resolve();
    }

    /**
     * @returns {Bo3} This BO3 runtime.
     */
    start() {
        if (this.#started) return this;

        this.#stopping = false;
        this.#started = true;
        try {
            this.#gameConnection().start();
        } catch (error) {
            this.#started = false;
            throw error;
        }

        this.#ready = this.#gameConnection().warmup()
            .then(() => console.log('[BO3] Official DVAR bridge warmed.'))
            .catch((error) => console.warn('[BO3] Official DVAR bridge warmup deferred:', error));

        return this;
    }

    /**
     * @returns {Promise<void>} Startup warmup/log completion.
     */
    ready() {
        return this.#ready;
    }

    /**
     * @returns {Promise<void>} Stop result.
     */
    stop() {
        this.#stopping = true;
        this.#stopVersion += 1;
        this.#started = false;
        this.#ready = Promise.resolve();
        return this.#connection ? this.#connection.stop() : Promise.resolve();
    }

    /**
     * @param {string[][]} records BO3 command records.
     * @param {string} [label='cli command'] Log/error label.
     * @param {string[]} [requests] Human CLI requests represented by these records.
     * @returns {Promise<object|undefined>} Connection send result.
     */
    sendRecords(records, label = 'cli command', requests = undefined) {
        const stopVersion = this.#stopVersion;
        this.start();
        return Promise.resolve()
            .then(() => this.#gameConnection().schedulePayload(records, requests))
            .catch((error) => {
                if (this.#stopping || this.#stopVersion !== stopVersion) {
                    if (error && error.message === STOPPED_BEFORE_ACK) return undefined;
                }

                console.error(`[BO3] Failed to send ${label}:`, error);
                throw error;
            });
    }

    /**
     * @param {string} target GET target.
     * @param {string} [filter=''] Optional target filter.
     * @returns {Promise<object>} Live BO3 query result.
     */
    get(target, filter = '') {
        this.start();
        return this.#ready.then(() => this.#gameConnection().get(target, filter));
    }

    /**
     * Clears cached BO3 packets that are not already in-flight.
     *
     * @param {'all'|'last'} [mode='all'] Clear mode.
     * @param {number} [count=1] Number of last cached requests to clear.
     * @returns {{ cleared: number, requests: string[], activeRequests: string[], active: boolean }} Clear result.
     */
    clearCache(mode = 'all', count = 1) {
        return this.#connection
            ? this.#connection.clearCache(mode, count)
            : { cleared: 0, requests: [], activeRequests: [], active: false };
    }

    /**
     * @returns {{ activeRequests: string[], requests: string[], active: boolean }} Current cached BO3 work.
     */
    cache() {
        return this.#connection
            ? this.#connection.cache()
            : { activeRequests: [], requests: [], active: false };
    }

    #gameConnection() {
        if (!this.#connection) {
            this.#connection = new GameConnection();
            this.#connection.on('notice', (notice) => this.emit('notice', notice));
        }

        return this.#connection;
    }
}

module.exports = Bo3;
