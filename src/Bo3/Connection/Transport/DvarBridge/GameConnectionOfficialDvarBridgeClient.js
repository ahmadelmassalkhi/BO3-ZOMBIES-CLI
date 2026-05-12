const fs = require('fs');
const { execFile, spawn } = require('child_process');
const readline = require('readline');
const GameConnectionDvarBridgeProtocol = require('./GameConnectionDvarBridgeProtocol');
const gameConnectionPowerShellDvarBridgeSource = require('./GameConnectionPowerShellDvarBridgeSource');

const STOP_GRACE_MS = 500;
const STOP_KILL_MS = 1000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Persistent client for the official BO3 DVAR PowerShell bridge.
 *
 * Owns child process startup, request correlation, timeout handling, pending
 * request rejection, and child shutdown. It does not format BO3 packets.
 */
class GameConnectionOfficialDvarBridgeClient {
    /**
     * @param {object} [options] Bridge process options.
     * @param {string} options.patchDir Directory containing bridge runtime files.
     * @param {string} options.powershellPath PowerShell executable path.
     * @param {number} options.timeoutMs Per-request timeout.
     * @param {GameConnectionDvarBridgeProtocol} [options.protocol] Bridge protocol parser/formatter.
     */
    constructor(options = {}) {
        this.patchDir = options.patchDir;
        this.powershellPath = options.powershellPath;
        this.timeoutMs = options.timeoutMs;
        this.protocol = options.protocol || new GameConnectionDvarBridgeProtocol();
        this.process = null;
        this.reader = null;
        this.ready = null;
        this.pending = new Map();
        this.sequence = 0;
        this.stopping = null;
    }

    /**
     * Sends one bridge request and resolves when the matching response arrives.
     *
     * @param {{ op: string, name?: string, value?: string }} payload Bridge request payload.
     * @returns {Promise<string|boolean>} Bridge response value.
     * @throws {Error} When bridge is unavailable, times out, exits, or returns ERR/FATAL.
     */
    async request(payload) {
        await this.#start();
        const child = this.process;
        if (!child || !child.stdin || child.stdin.destroyed || child.exitCode !== null) {
            throw new Error('Official dvar bridge is not available for requests.');
        }

        return new Promise((resolve, reject) => {
            const id = String(++this.sequence);
            const timer = setTimeout(() => {
                if (this.pending.delete(id)) reject(new Error(`Official dvar bridge timed out after ${this.timeoutMs}ms.`));
                this.#reset(new Error(`Official dvar bridge timed out after ${this.timeoutMs}ms.`));
            }, this.timeoutMs);
            if (timer.unref) timer.unref();

            this.pending.set(id, { resolve, reject, timer });
            const failWrite = (error) => {
                clearTimeout(timer);
                this.pending.delete(id);
                reject(error);
                this.#reset(error);
            };

            try {
                child.stdin.write(`${this.protocol.requestLine(id, payload)}\n`, (error) => {
                    if (error) failWrite(error);
                });
            } catch (error) {
                failWrite(error);
            }
        });
    }

    /**
     * Stops the bridge child and rejects pending requests.
     *
     * @returns {Promise<void>|undefined} Stop promise when a child exists.
     */
    async stop() {
        if (this.stopping) return this.stopping;

        const child = this.process;
        this.process = null;
        this.ready = null;
        this.#closeReader();
        this.#rejectPending(new Error('Official dvar bridge stopped.'));
        if (!child) return undefined;

        this.stopping = this.#stopChild(child)
            .catch((error) => console.warn('[BO3 OFFICIAL DVAR] Bridge shutdown warning:', error.message))
            .finally(() => { this.stopping = null; });

        return this.stopping;
    }

    /**
     * Starts the bridge child and waits until it emits READY.
     *
     * @returns {Promise<void>} Ready promise.
     */
    async #start() {
        if (this.stopping) await this.stopping;
        if (this.process && this.ready) return this.ready;

        this.#ensureRuntime();
        this.#ensurePowerShellBridge();

        const child = spawn(this.powershellPath, this.#powerShellArgs(), {
            windowsHide: true,
            env: { ...process.env, BO3_T7PATCH_DIR: this.patchDir },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.process = child;
        this.ready = new Promise((resolve, reject) => {
            const reader = readline.createInterface({ input: child.stdout });
            this.reader = reader;

            const fail = (error) => {
                if (this.process === child) {
                    this.process = null;
                    this.ready = null;
                }
                if (child.exitCode === null && !child.killed) {
                    this.#tryKill(child, 'startup failure');
                }
                this.#rejectPending(error);
                reject(error);
            };

            reader.on('line', (line) => this.#handleLine(line, resolve));
            child.stderr.on('data', (data) => this.#logStderr(data));
            child.once('error', fail);
            child.once('exit', (code, signal) => this.#handleExit(child, reader, code, signal, fail));

            try {
                child.stdin.write(`${gameConnectionPowerShellDvarBridgeSource()}\n`, (error) => {
                    if (error) fail(error);
                });
            } catch (error) {
                fail(error);
            }
        });

        return this.ready;
    }

    /**
     * Handles one stdout protocol line from the bridge.
     *
     * @param {string} line Raw response line.
     * @param {Function} resolveReady Resolves startup once READY is seen.
     */
    #handleLine(line, resolveReady) {
        let response = null;
        try {
            response = this.protocol.responseFrom(line);
        } catch (error) {
            console.error('[BO3 OFFICIAL DVAR] Protocol error:', error.message);
            this.#reset(error);
            return;
        }

        if (response.type === 'READY') return resolveReady();
        if (response.type === 'FATAL') return this.#reset(new Error(response.message));

        const pending = this.pending.get(response.id);
        if (!pending) {
            console.warn(`[BO3 OFFICIAL DVAR] Ignored response with no pending request: type=${response.type} id=${response.id || '<missing>'}`);
            return undefined;
        }

        clearTimeout(pending.timer);
        this.pending.delete(response.id);
        if (response.type === 'OK') return pending.resolve(response.value);
        return pending.reject(new Error(response.message));
    }

    /**
     * Handles child exit and rejects any startup/pending work.
     *
     * @param {object} child Child process.
     * @param {object} reader Readline reader bound to stdout.
     * @param {number|null} code Exit code.
     * @param {string|null} signal Exit signal.
     * @param {Function} failReady Startup reject callback.
     */
    #handleExit(child, reader, code, signal, failReady) {
        if (this.reader === reader) this.reader = null;
        if (this.process === child) {
            this.process = null;
            this.ready = null;
        }

        const reason = code === null ? `signal ${signal || 'unknown'}` : `code ${code}`;
        const error = new Error(`Official dvar bridge exited (${reason}).`);
        this.#rejectPending(error);
        failReady(error);
    }

    /**
     * Gracefully stops the child, then escalates to kill/taskkill if needed.
     *
     * @param {object} child Child process to stop.
     * @returns {Promise<void>}
     */
    async #stopChild(child) {
        if (child.exitCode !== null) return;

        const exited = new Promise((resolve) => child.once('exit', resolve));
        this.#tryEndStdin(child, 'graceful stop');

        await Promise.race([exited, sleep(STOP_GRACE_MS)]);
        if (child.exitCode !== null) return;

        this.#tryKill(child, 'graceful stop timeout');
        await Promise.race([exited, sleep(STOP_GRACE_MS)]);
        if (child.exitCode !== null) return;

        await this.#taskkill(child.pid);
        await Promise.race([exited, sleep(STOP_KILL_MS)]);
    }

    /**
     * @param {number} pid Process id to kill.
     * @returns {Promise<void>}
     */
    #taskkill(pid) {
        if (!pid) return Promise.resolve();
        return new Promise((resolve) => {
            execFile('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve());
        });
    }

    /**
     * @throws {Error} When required bridge runtime files are missing.
     */
    #ensureRuntime() {
        const missing = ['t7dwidm_protect.exe', 'External.dll']
            .map((name) => `${this.patchDir}\\${name}`)
            .filter((file) => !fs.existsSync(file));

        if (missing.length) throw new Error(`Missing official DVAR bridge runtime file(s): ${missing.join(', ')}`);
    }

    /**
     * @throws {Error} When PowerShell executable is missing.
     */
    #ensurePowerShellBridge() {
        if (!fs.existsSync(this.powershellPath)) throw new Error(`Missing PowerShell executable: ${this.powershellPath}`);
    }

    /**
     * @returns {string[]} PowerShell process args.
     */
    #powerShellArgs() {
        return ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'];
    }

    /**
     * Closes the stdout reader during shutdown/reset.
     */
    #closeReader() {
        if (!this.reader) return;
        try {
            this.reader.close();
        } catch (error) {
            console.warn('[BO3 OFFICIAL DVAR] Reader close warning:', error.message);
        }
        this.reader = null;
    }

    /**
     * Resets bridge state after protocol/write/startup failures.
     *
     * @param {Error} error Reason used to reject pending requests.
     */
    #reset(error) {
        const child = this.process;
        this.process = null;
        this.ready = null;

        if (child && child.exitCode === null && !child.killed) {
            this.#tryKill(child, 'bridge reset');
        }

        this.#rejectPending(error);
    }

    /**
     * @param {object} child Child process.
     * @param {string} operation Operation label for warnings.
     */
    #tryEndStdin(child, operation) {
        try {
            child.stdin.end();
        } catch (error) {
            console.warn(`[BO3 OFFICIAL DVAR] stdin close warning during ${operation}:`, error.message);
        }
    }

    /**
     * @param {object} child Child process.
     * @param {string} operation Operation label for warnings.
     */
    #tryKill(child, operation) {
        try {
            child.kill();
        } catch (error) {
            console.warn(`[BO3 OFFICIAL DVAR] process kill warning during ${operation}:`, error.message);
        }
    }

    /**
     * Rejects every pending bridge request.
     *
     * @param {Error} error Rejection reason.
     */
    #rejectPending(error) {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pending.clear();
    }

    /**
     * Logs bridge stderr lines.
     *
     * @param {*} data Raw stderr data.
     */
    #logStderr(data) {
        const text = String(data || '').trim();
        if (text) console.error(`[BO3 OFFICIAL DVAR] ${text}`);
    }
}

module.exports = GameConnectionOfficialDvarBridgeClient;
