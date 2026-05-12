const path = require('path');
const GameConnectionOfficialDvarBridgeClient = require('./GameConnectionOfficialDvarBridgeClient');

const DEFAULT_PATCH_DIR = path.join(__dirname, '..', 'BridgeRuntime');
const DEFAULT_POWERSHELL = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
);

/**
 * Serial DVAR writer backed by the official BO3 DVAR bridge.
 *
 * Owns write ordering and bridge warmup. It does not know packet ACK semantics.
 */
class GameConnectionOfficialDvarWriter {
    /**
     * @param {object} [options] DVAR writer options.
     * @param {string} [options.patchDir] Directory containing bridge runtime files.
     * @param {string} [options.powershellPath] PowerShell executable path.
     * @param {number} [options.timeoutMs] Bridge request timeout.
     * @param {object} [options.bridge] Bridge client exposing request() and stop().
     * @param {boolean} [options.log] Whether to log connection mode.
     */
    constructor(options = {}) {
        this.patchDir = String(options.patchDir || process.env.BO3_T7PATCH_DIR || DEFAULT_PATCH_DIR);
        this.timeoutMs = this.#int(options.timeoutMs ?? process.env.BO3_OFFICIAL_DVAR_TIMEOUT_MS, 5000);
        this.powershellPath = options.powershellPath || process.env.BO3_POWERSHELL_PATH || DEFAULT_POWERSHELL;
        this.bridge = options.bridge || new GameConnectionOfficialDvarBridgeClient({
            patchDir: this.patchDir,
            powershellPath: this.powershellPath,
            timeoutMs: this.timeoutMs,
        });
        this.queue = Promise.resolve();
        this.generation = 0;
        if (options.log !== false) console.log(`[BO3] Connection mode: official-dvar (${this.patchDir})`);
    }

    /**
     * Queues one DVAR write.
     *
     * @param {string} name DVAR name.
     * @param {string} value DVAR value.
     * @returns {Promise<string|boolean>} Bridge response.
     */
    write(name, value) {
        return this.#enqueue({ op: 'set', name, value });
    }

    /**
     * Starts the bridge with a ping request.
     *
     * @returns {Promise<string|boolean>} Bridge ping response.
     */
    warmup() {
        return this.#enqueue({ op: 'ping' });
    }

    /**
     * Stops queued write work and closes the bridge.
     *
     * @returns {Promise<void>|undefined} Bridge stop result.
     */
    stop() {
        this.generation += 1;
        this.queue = Promise.resolve();
        return this.bridge.stop();
    }

    /**
     * Serializes bridge payloads so DVAR writes stay ordered.
     *
     * @param {{ op: string, name?: string, value?: string }} payload Bridge payload.
     * @returns {Promise<string|boolean>} Bridge response.
     */
    #enqueue(payload) {
        const generation = this.generation;
        const job = this.queue.then(() => {
            if (generation !== this.generation) {
                throw new Error('Official dvar writer stopped before queued write started.');
            }

            return this.bridge.request(payload);
        });

        this.queue = job.catch(() => {
            // The returned job keeps the real rejection for callers.
            // This internal queue promise recovers so later writes can still run.
        });
        return job;
    }

    /**
     * @param {*} value Raw integer-like value.
     * @param {number} fallback Fallback when value is invalid.
     * @returns {number} Non-negative integer.
     */
    #int(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }
}

module.exports = GameConnectionOfficialDvarWriter;
