/**
 * Serializes interactive commands typed faster than BO3 can accept them.
 */
class RealCliCommandQueue {
    constructor() {
        this.#queue = Promise.resolve();
        Object.freeze(this);
    }

    #queue;
    #entries = [];
    #activeText = '';

    /**
     * @returns {string[]} Human commands waiting in the interactive queue.
     */
    pendingRequests() {
        return this.#entries.map((entry) => entry.text);
    }

    /**
     * @returns {string[]} Current command already executing, if any.
     */
    activeRequests() {
        return this.#activeText ? [this.#activeText] : [];
    }

    /**
     * @param {string} text Human command text.
     * @param {(text: string) => Promise<void>} run Executes the command.
     * @param {() => void} onQueued Called when this command waits behind another command.
     */
    enqueue(text, run, onQueued = () => {}) {
        if (typeof text !== 'string' || !text.trim()) throw new TypeError('RealCliCommandQueue.text must be a non-empty string.');
        if (typeof run !== 'function') throw new TypeError('RealCliCommandQueue.run must be a function.');
        if (typeof onQueued !== 'function') throw new TypeError('RealCliCommandQueue.onQueued must be a function.');

        const entry = { text, canceled: false };
        const waitsBehindCommand = Boolean(this.#activeText || this.#entries.length);

        this.#entries.push(entry);
        if (waitsBehindCommand) onQueued();

        this.#queue = this.#queue.then(
            () => this.#runEntry(entry, run),
            () => this.#runEntry(entry, run),
        );
    }

    /**
     * Clears pending commands that have not started executing.
     *
     * @param {'all'|'last'} [mode='all'] Clear mode.
     * @param {number} [count=1] Number of last pending commands to clear.
     * @returns {string[]} Cleared command texts.
     */
    clear(mode = 'all', count = 1) {
        if (mode !== 'all' && mode !== 'last') throw new TypeError('RealCliCommandQueue.clear mode must be all or last.');
        if (!Number.isInteger(count) || count < 1) throw new TypeError('RealCliCommandQueue.clear count must be a positive integer.');

        const entries = mode === 'all' ? this.#entries : this.#entries.slice(-count);
        entries.forEach((entry) => { entry.canceled = true; });
        this.#entries = this.#entries.filter((entry) => !entries.includes(entry));
        return entries.map((entry) => entry.text);
    }

    async #runEntry(entry, run) {
        const index = this.#entries.indexOf(entry);
        if (index !== -1) this.#entries.splice(index, 1);
        if (entry.canceled) return;

        this.#activeText = entry.text;
        try {
            await run(entry.text);
        } finally {
            if (this.#activeText === entry.text) this.#activeText = '';
        }
    }
}

module.exports = RealCliCommandQueue;
