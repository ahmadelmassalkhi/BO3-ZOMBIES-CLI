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
        this.commandVersion = 0;
        this.canceling = false;
        this.promptReady = false;
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
            let restoreConsole = () => {};

            const close = async (exitCode = 0) => {
                if (this.shuttingDown) return;
                this.shuttingDown = true;
                this.promptReady = false;
                removeKeyBinding();
                restoreConsole();
                shell.close();
                await this.#stop();
                resolve(exitCode);
            };
            restoreConsole = this.#routeShellLogs(shell, renderer);
            removeKeyBinding = this.#bindShellKeys(
                shell,
                () => this.#cancel(shell, renderer, options),
                () => close(0),
            );

            shell.on('line', async (line) => {
                const text = line.trim();
                if (!text) return this.#prompt(shell, renderer);
                if (text === 'exit' || text === 'quit') return close(0);
                if (this.#runShellCommand(text, shell, renderer)) return this.#prompt(shell, renderer);

                const commandVersion = ++this.commandVersion;
                try {
                    const response = await this.#execute(text, options);
                    if (commandVersion === this.commandVersion) this.#write(renderer, response);
                } catch (error) {
                    if (commandVersion === this.commandVersion) this.#write(renderer, GameCliResponse.failure(error));
                }

                if (commandVersion === this.commandVersion) this.#prompt(shell, renderer);
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
                const mode = options.dryRun ? 'dry-run mode; no BO3 connection will start.' : 'Type help or clear. Ctrl+C cancels. Ctrl+W exits.';
                console.log(Ansi.yellow('[BO3 ZM CLI]'), mode);
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

    #runShellCommand(text, shell, renderer) {
        const command = text.trim().toLowerCase();
        if (command !== 'clear' && command !== 'cls') return false;

        if (renderer.output !== 'json') {
            process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
        }

        return true;
    }

    async #cancel(shell, renderer, options) {
        if (this.canceling || this.shuttingDown) return;
        this.canceling = true;
        this.commandVersion += 1;

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
            console.warn('[BO3 ZM CLI] Shutdown warning:', error && error.message ? error.message : String(error));
        }
    }

    #write(renderer, response) {
        process.stdout.write(`${renderer.render(response)}\n`);
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

    #routeLogsToStderr() {
        console.log = (...args) => console.error(...args);
    }
}

module.exports = RealCli;
