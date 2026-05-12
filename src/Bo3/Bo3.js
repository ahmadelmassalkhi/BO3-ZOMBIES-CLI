const GameConnection = require('./Connection/GameConnection');

const STOPPED_BEFORE_ACK = 'BO3 connection stopped before queued packets were acknowledged.';

/**
 * BO3 Zombies runtime.
 *
 * Owns the BO3 connection and sends already-built BO3 command records. It does
 * not parse CLI text and it does not know TikTok, presets, or any app layer.
 */
class Bo3 {
    #connection;
    #started;
    #stopping;

    constructor() {
        this.#connection = null;
        this.#started = false;
        this.#stopping = false;
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

        this.#gameConnection().warmup()
            .then(() => console.log('[BO3] Official DVAR bridge warmed.'))
            .catch((error) => console.warn('[BO3] Official DVAR bridge warmup deferred:', error));

        return this;
    }

    /**
     * @returns {Promise<void>} Stop result.
     */
    stop() {
        this.#stopping = true;
        this.#started = false;
        return this.#connection ? this.#connection.stop() : Promise.resolve();
    }

    /**
     * @param {string[][]} records BO3 command records.
     * @param {string} [label='cli command'] Log/error label.
     * @returns {Promise<object|undefined>} Connection send result.
     */
    sendRecords(records, label = 'cli command') {
        this.start();
        return Promise.resolve()
            .then(() => this.#gameConnection().schedulePayload(records))
            .catch((error) => {
                if (this.#stopping && error && error.message === STOPPED_BEFORE_ACK) return undefined;
                console.error(`[BO3] Failed to send ${label}:`, error);
                throw error;
            });
    }

    #gameConnection() {
        if (!this.#connection) this.#connection = new GameConnection();
        return this.#connection;
    }
}

module.exports = Bo3;
