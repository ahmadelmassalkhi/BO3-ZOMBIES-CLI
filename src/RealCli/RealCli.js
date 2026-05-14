const readline = require('readline');
const util = require('util');
const GameCli = require('../GameCli/GameCli');
const GameCliResponse = require('../GameCli/GameCliResponse');
const Ansi = require('../GameCli/GameCliAnsi');
const RealCliOptions = require('./RealCliOptions');
const RealCliRenderer = require('./RealCliRenderer');

/**
 * Human-facing CLI wrapper.
 *
 * It owns terminal input/output only. All command parsing and execution stays
 * inside GameCli so external apps and humans use the same behavior.
 */
class RealCli {
    /**
     * @param {GameCli} [gameCli=new GameCli()] Programmatic CLI API.
     */
    constructor(gameCli = new GameCli()) {
        if (!(gameCli instanceof GameCli)) throw new TypeError('RealCli.gameCli must be a GameCli instance.');
        this.gameCli = gameCli;
        this.shuttingDown = false;
        this.canceling = false;
        this.promptReady = false;
        this.commandQueue = Promise.resolve();
        this.commandQueueEntries = [];
        this.commandActive = false;
        this.activeCommandText = '';
    }

    /**
     * @param {string[]} argv Process args after the executable name.
     * @returns {Promise<number>} Process exit code.
     */
    async run(argv = []) {
        const options = new RealCliOptions(argv);
        const renderer = new RealCliRenderer(options.output);
        if (options.machineReadable) this.#routeLogsToStderr();
        return options.hasCommand ? this.#runOne(options.text, renderer, options) : this.#runShell(renderer, options);
    }

    async #runOne(text, renderer, options) {
        try {
            this.#write(renderer, await this.#execute(text, options));
            await this.#stop();
            return 0;
        } catch (error) {
            this.#write(renderer, GameCliResponse.failure(error));
            await this.#stop();
            return 1;
        }
    }

    #runShell(renderer, options) {
        return new Promise((resolve) => {
            const shell = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: renderer.output === 'json' ? '' : `${Ansi.cyan('bo3')} ${Ansi.gray('>')} `,
            });
            let removeKeyBinding = () => {};
            let removeNoticeBinding = () => {};
            let restoreConsole = () => {};

            const close = async (exitCode = 0) => {
                if (this.shuttingDown) return;
                this.shuttingDown = true;
                this.promptReady = false;
                removeKeyBinding();
                removeNoticeBinding();
                restoreConsole();
                shell.close();
                await this.#stop();
                resolve(exitCode);
            };
            restoreConsole = this.#routeShellLogs(shell, renderer);
            removeNoticeBinding = this.#bindNotices((notice) => {
                this.#writeShell(shell, renderer, GameCliResponse.notice(notice));
            });
            removeKeyBinding = this.#bindShellKeys(
                shell,
                () => this.#cancel(shell, renderer, options),
                () => close(0),
            );

            shell.on('line', async (line) => {
                const text = line.trim();
                if (!text) return this.#prompt(shell, renderer);
                if (text === 'exit' || text === 'quit') return close(0);
                if (this.#runShellCommand(text, shell, renderer, options)) return this.#prompt(shell, renderer);
                if (this.#runCacheCommand(text, shell, renderer)) return this.#prompt(shell, renderer);

                this.#enqueueShellCommand(text, shell, renderer, options);
                this.#prompt(shell, renderer);
            });

            shell.on('SIGINT', () => this.#cancel(shell, renderer, options));
            shell.on('close', () => {
                if (!this.shuttingDown) close(0);
            });

            this.#startShell(shell, renderer, options, close);
        });
    }

    async #startShell(shell, renderer, options, close) {
        try {
            if (renderer.output !== 'json') {
                const mode = options.dryRun ? 'dry-run mode; no BO3 connection will start.' : 'Type help. Ctrl+C cancels. Ctrl+W exits.';
                console.log(Ansi.yellow('[CLI]'), mode);
            }

            if (!options.dryRun) {
                this.gameCli.start();
                await this.gameCli.ready();
            }

            if (renderer.output !== 'json') this.#write(renderer, this.gameCli.preview('help'));
            this.#prompt(shell, renderer);
        } catch (error) {
            this.#write(renderer, GameCliResponse.failure(error));
            await close(1);
        }
    }

    #execute(text, options) {
        return options.dryRun ? this.gameCli.preview(text) : this.gameCli.execute(text);
    }

    #enqueueShellCommand(text, shell, renderer, options) {
        const entry = { text, canceled: false };
        const queuedBehindCommand = this.commandActive || this.commandQueueEntries.length > 0;
        this.commandQueueEntries.push(entry);
        if (queuedBehindCommand) {
            this.#writeShell(shell, renderer, GameCliResponse.notice({
                type: 'commandQueued',
                addedRequests: [text],
                ...this.#cacheSnapshot(),
            }));
        }

        const run = async () => {
            const index = this.commandQueueEntries.indexOf(entry);
            if (index !== -1) this.commandQueueEntries.splice(index, 1);
            if (entry.canceled) return;

            this.commandActive = true;
            this.activeCommandText = text;
            try {
                this.#writeShell(shell, renderer, await this.#execute(text, options));
            } catch (error) {
                this.#writeShell(shell, renderer, GameCliResponse.failure(error));
            } finally {
                this.commandActive = false;
                this.activeCommandText = '';
            }
        };

        this.commandQueue = this.commandQueue.then(run, run);
    }

    #runShellCommand(text, shell, renderer, options) {
        const command = text.trim().toLowerCase();
        if (command === 'clear help') {
            this.#writeShell(shell, renderer, this.gameCli.preview('clear help'));
            return true;
        }

        if (command !== 'clear' && command !== 'cls') {
            if (command.startsWith('clear ') || command.startsWith('cls ')) {
                this.#writeShell(shell, renderer, GameCliResponse.failure(new TypeError('clear usage: clear. Run: bo3-zm-cli clear help.')));
                return true;
            }

            return false;
        }

        if (renderer.output !== 'json') {
            process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
        }

        return true;
    }

    #runCacheCommand(text, shell, renderer) {
        const tokens = text.trim().toLowerCase().split(/\s+/);
        if (tokens[0] !== 'cache') return false;

        if (tokens.length === 2 && tokens[1] === 'help') {
            this.#writeShell(shell, renderer, this.gameCli.preview('cache help'));
            return true;
        }

        if (tokens.length === 1 || (tokens.length === 2 && tokens[1] === 'show')) {
            this.#writeShell(shell, renderer, GameCliResponse.cacheShown(this.#cacheSnapshot()));
            return true;
        }

        if (tokens.length >= 2 && tokens[1] === 'clear') {
            try {
                const clear = RealCli.#cacheClear(tokens);
                this.#writeShell(shell, renderer, GameCliResponse.cacheCleared(this.#clearCache(clear.mode, clear.count)));
            } catch (error) {
                this.#writeShell(shell, renderer, GameCliResponse.failure(error));
            }
            return true;
        }

        this.#writeShell(shell, renderer, GameCliResponse.failure(new TypeError('cache usage: cache [show] | cache clear [all|last [count]]. Run: bo3-zm-cli cache help.')));
        return true;
    }

    #cacheSnapshot() {
        const bo3 = this.gameCli.showCache().data || { activeRequests: [], requests: [], active: false };
        const activeRequests = bo3.activeRequests && bo3.activeRequests.length
            ? bo3.activeRequests
            : (this.activeCommandText ? [this.activeCommandText] : []);

        return {
            activeRequests,
            requests: (bo3.requests || []).concat(this.commandQueueEntries.map((entry) => entry.text)),
            active: Boolean(activeRequests.length),
        };
    }

    #clearCache(mode = 'all', count = 1) {
        const waiting = this.#clearQueuedShellCommands(mode, count);
        const remaining = mode === 'last' ? Math.max(0, count - waiting.length) : count;
        const bo3 = (mode === 'last' && remaining === 0)
            ? { requests: [], activeRequests: [], active: false, cleared: 0 }
            : (this.gameCli.clearCache(mode, remaining || 1).data || { requests: [], activeRequests: [], active: false, cleared: 0 });
        const activeRequests = bo3.activeRequests && bo3.activeRequests.length
            ? bo3.activeRequests
            : (this.activeCommandText ? [this.activeCommandText] : []);

        return {
            cleared: waiting.length + (bo3.cleared || 0),
            requests: (bo3.requests || []).concat(waiting),
            activeRequests,
            active: Boolean(activeRequests.length),
        };
    }

    #clearQueuedShellCommands(mode = 'all', count = 1) {
        const entries = mode === 'all' ? this.commandQueueEntries : this.commandQueueEntries.slice(-count);
        const waiting = entries.map((entry) => {
            entry.canceled = true;
            return entry.text;
        });
        this.commandQueueEntries = this.commandQueueEntries.filter((entry) => !entries.includes(entry));
        return waiting;
    }

    async #cancel(shell, renderer, options) {
        if (this.canceling || this.shuttingDown) return;
        this.canceling = true;
        this.#clearQueuedShellCommands('all', 1);
        this.gameCli.clearCache();

        shell.line = '';
        shell.cursor = 0;
        if (renderer.output !== 'json') shell._refreshLine();

        try {
            await this.gameCli.stop();
            if (!options.dryRun) this.gameCli.start();
            if (renderer.output !== 'json') this.#write(renderer, GameCliResponse.canceled());
        } catch (error) {
            this.#write(renderer, GameCliResponse.failure(error));
        } finally {
            this.canceling = false;
            this.#prompt(shell, renderer);
        }
    }

    async #stop() {
        try {
            await this.gameCli.stop();
        } catch (error) {
            console.warn('[CLI] Shutdown warning:', error && error.message ? error.message : String(error));
        }
    }

    #write(renderer, response) {
        const text = renderer.render(response);
        if (text) process.stdout.write(`${text}\n`);
    }

    #writeShell(shell, renderer, response) {
        const text = renderer.render(response);
        if (!text) return;

        if (this.promptReady) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
        }

        process.stdout.write(`${text}\n`);
        if (this.promptReady && !this.shuttingDown && typeof shell._refreshLine === 'function') shell._refreshLine();
    }

    #prompt(shell, renderer) {
        if (renderer.output !== 'json') {
            this.promptReady = true;
            shell.prompt();
        }
    }

    #routeShellLogs(shell, renderer) {
        if (renderer.output === 'json') return () => {};

        const original = {
            log: console.log,
            warn: console.warn,
            error: console.error,
        };

        const write = (method, args) => {
            if (this.promptReady) {
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);
            }

            original[method](util.format(...args));
            if (this.promptReady && !this.shuttingDown && typeof shell._refreshLine === 'function') shell._refreshLine();
        };

        console.log = (...args) => write('log', args);
        console.warn = (...args) => write('warn', args);
        console.error = (...args) => write('error', args);

        return () => {
            console.log = original.log;
            console.warn = original.warn;
            console.error = original.error;
        };
    }

    #bindShellKeys(shell, cancel, quit) {
        const write = shell._ttyWrite;
        if (typeof write !== 'function' || typeof shell._deleteWordLeft !== 'function') return () => {};

        shell._ttyWrite = function wrappedTtyWrite(sequence, key = {}) {
            if (RealCli.#ctrlC(sequence, key)) {
                cancel();
                return;
            }

            if (RealCli.#ctrlW(sequence, key)) {
                quit();
                return;
            }

            if (RealCli.#ctrlBackspace(sequence, key)) {
                this._deleteWordLeft();
                return;
            }

            write.call(this, sequence, key);
        };

        return () => { shell._ttyWrite = write; };
    }

    #bindNotices(handler) {
        if (typeof this.gameCli.on !== 'function' || typeof this.gameCli.off !== 'function') return () => {};

        this.gameCli.on('notice', handler);
        return () => this.gameCli.off('notice', handler);
    }

    static #ctrlBackspace(sequence, key) {
        return key
            && key.name === 'backspace'
            && (
                key.ctrl
                || sequence === '\b'
                || sequence === '\x1b[127;5u'
                || sequence === '\x1b[8;5~'
            );
    }

    static #ctrlC(sequence, key) {
        return key && key.ctrl && key.name === 'c' && sequence === '\x03';
    }

    static #ctrlW(sequence, key) {
        return key && key.ctrl && key.name === 'w' && sequence === '\x17';
    }

    static #cacheClear(tokens) {
        if (tokens.length === 2) return { mode: 'all', count: 1 };
        if (tokens.length === 3 && tokens[2] === 'all') return { mode: 'all', count: 1 };
        if (tokens.length === 3 && tokens[2] === 'last') return { mode: 'last', count: 1 };
        if (tokens.length === 4 && tokens[2] === 'last') {
            const count = Number.parseInt(tokens[3], 10);
            if (!Number.isInteger(count) || count < 1 || String(count) !== tokens[3]) throw new TypeError('cache clear last count must be a positive integer.');
            return { mode: 'last', count };
        }

        throw new TypeError('cache usage: cache [show] | cache clear [all|last [count]]. Run: bo3-zm-cli cache help.');
    }

    #routeLogsToStderr() {
        console.log = (...args) => console.error(...args);
    }
}

module.exports = RealCli;
