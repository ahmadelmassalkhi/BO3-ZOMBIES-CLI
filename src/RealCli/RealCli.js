const readline = require('readline');
const GameCli = require('../GameCli/GameCli');
const GameCliHelp = require('../GameCli/GameCliHelp');
const GameCliResponse = require('../GameCli/GameCliResponse');
const Ansi = require('../GameCli/GameCliAnsi');
const defaultRealCliCommands = require('./Commands/defaultCommands');
const RealCliCommandRegistry = require('./Commands/RealCliCommandRegistry');
const RealCliCache = require('./RealCliCache');
const RealCliCommandQueue = require('./RealCliCommandQueue');
const RealCliConsoleRouter = require('./RealCliConsoleRouter');
const RealCliKeyboard = require('./RealCliKeyboard');
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
        this.commandQueue = new RealCliCommandQueue();
        this.cache = new RealCliCache(gameCli, this.commandQueue);
    }

    /**
     * @param {string[]} argv Process args after the executable name.
     * @returns {Promise<number>} Process exit code.
     */
    async run(argv = []) {
        const options = new RealCliOptions(argv);
        const renderer = new RealCliRenderer(options.output);
        if (options.machineReadable) RealCliConsoleRouter.routeLogsToStderr();
        return options.hasCommand ? this.#runOne(options.text, renderer, options) : this.#runShell(renderer, options);
    }

    /**
     * Runs one non-interactive command and stops the BO3 runtime afterward.
     *
     * @param {string} text Command text.
     * @param {RealCliRenderer} renderer Output renderer.
     * @param {RealCliOptions} options Parsed process options.
     * @returns {Promise<number>} Process exit code.
     */
    async #runOne(text, renderer, options) {
        try {
            const realCliCommands = this.#realCliCommands(() => {});
            const realCliResponse = this.#runRealCliCommand(text, realCliCommands);
            if (realCliResponse) {
                const response = await realCliResponse;
                this.#write(renderer, response);
                await this.#stop();
                return response.ok ? 0 : 1;
            }

            if (text.trim().toLowerCase() === 'help') {
                this.#write(renderer, this.#helpResponse(realCliCommands));
                await this.#stop();
                return 0;
            }

            this.#write(renderer, await this.#execute(text, options));
            await this.#stop();
            return 0;
        } catch (error) {
            this.#write(renderer, GameCliResponse.failure(error));
            await this.#stop();
            return 1;
        }
    }

    /**
     * Starts the interactive shell and keeps BO3 connection work alive.
     *
     * @param {RealCliRenderer} renderer Output renderer.
     * @param {RealCliOptions} options Parsed process options.
     * @returns {Promise<number>} Process exit code.
     */
    #runShell(renderer, options) {
        return new Promise((resolve) => {
            const shell = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: renderer.output === 'json' ? '' : `${Ansi.cyan('bo3')} ${Ansi.gray('>')} `,
            });
            const realCliCommands = this.#realCliCommands(() => {
                if (renderer.output !== 'json') process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
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
            restoreConsole = renderer.output === 'json'
                ? () => {}
                : RealCliConsoleRouter.routeShellLogs(
                    shell,
                    () => this.promptReady,
                    () => this.shuttingDown,
                );
            removeNoticeBinding = this.#bindNotices((notice) => {
                this.#writeShell(shell, renderer, GameCliResponse.notice(notice));
            });
            removeKeyBinding = RealCliKeyboard.bind(
                shell,
                () => this.#cancel(shell, renderer, options),
                () => close(0),
            );

            shell.on('line', async (line) => {
                const text = line.trim();
                if (!text) return this.#prompt(shell, renderer);
                if (text === 'exit' || text === 'quit') return close(0);
                if (text === 'help') {
                    this.#writeShell(shell, renderer, this.#helpResponse(realCliCommands));
                    return this.#prompt(shell, renderer);
                }

                const realCliResponse = this.#runRealCliCommand(text, realCliCommands);
                if (realCliResponse) {
                    this.#writeShell(shell, renderer, await realCliResponse);
                    return this.#prompt(shell, renderer);
                }

                this.#enqueueShellCommand(text, shell, renderer, options);
                this.#prompt(shell, renderer);
            });

            shell.on('SIGINT', () => this.#cancel(shell, renderer, options));
            shell.on('close', () => {
                if (!this.shuttingDown) close(0);
            });

            this.#startShell(shell, renderer, options, close, realCliCommands);
        });
    }

    /**
     * Starts BO3 for interactive mode, prints startup help, then shows the prompt.
     *
     * @param {import('readline').Interface} shell Readline shell.
     * @param {RealCliRenderer} renderer Output renderer.
     * @param {RealCliOptions} options Parsed process options.
     * @param {(exitCode?: number) => Promise<void>} close Shell close callback.
     * @param {RealCliCommandRegistry} realCliCommands Interactive command registry.
     * @returns {Promise<void>}
     */
    async #startShell(shell, renderer, options, close, realCliCommands) {
        try {
            if (renderer.output !== 'json') {
                const mode = options.dryRun ? 'dry-run mode; no BO3 connection will start.' : 'Type help. Ctrl+C cancels. Ctrl+W exits.';
                console.log(Ansi.yellow('[CLI]'), mode);
            }

            if (!options.dryRun) {
                this.gameCli.start();
                await this.gameCli.ready();
            }

            if (renderer.output !== 'json') this.#write(renderer, this.#helpResponse(realCliCommands));
            this.#prompt(shell, renderer);
        } catch (error) {
            this.#write(renderer, GameCliResponse.failure(error));
            await close(1);
        }
    }

    /**
     * Executes or previews one GameCli command according to process options.
     *
     * @param {string} text Command text.
     * @param {RealCliOptions} options Parsed process options.
     * @returns {Promise<GameCliResponse>|GameCliResponse} Command response.
     */
    #execute(text, options) {
        return options.dryRun ? this.gameCli.preview(text) : this.gameCli.execute(text);
    }

    /**
     * Adds one gameplay command to the interactive serial queue.
     *
     * @param {string} text Command text.
     * @param {import('readline').Interface} shell Readline shell.
     * @param {RealCliRenderer} renderer Output renderer.
     * @param {RealCliOptions} options Parsed process options.
     */
    #enqueueShellCommand(text, shell, renderer, options) {
        this.commandQueue.enqueue(text, async (commandText) => {
            try {
                this.#writeShell(shell, renderer, await this.#execute(commandText, options));
            } catch (error) {
                this.#writeShell(shell, renderer, GameCliResponse.failure(error));
            }
        }, () => {
            this.#writeShell(shell, renderer, GameCliResponse.notice({
                type: 'commandQueued',
                addedRequests: [text],
                ...this.cache.snapshot(),
            }));
        });
    }

    /**
     * Handles Ctrl+C by clearing pending work and restarting the connection.
     *
     * @param {import('readline').Interface} shell Readline shell.
     * @param {RealCliRenderer} renderer Output renderer.
     * @param {RealCliOptions} options Parsed process options.
     * @returns {Promise<void>}
     */
    async #cancel(shell, renderer, options) {
        if (this.canceling || this.shuttingDown) return;
        this.canceling = true;
        this.commandQueue.clear('all');
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

    /**
     * Stops BO3 runtime without letting shutdown warnings crash the CLI.
     *
     * @returns {Promise<void>}
     */
    async #stop() {
        try {
            await this.gameCli.stop();
        } catch (error) {
            console.warn('[CLI] Shutdown warning:', error && error.message ? error.message : String(error));
        }
    }

    /**
     * Writes one response outside readline prompt management.
     *
     * @param {RealCliRenderer} renderer Output renderer.
     * @param {GameCliResponse} response Response to render.
     */
    #write(renderer, response) {
        const text = renderer.render(response);
        if (text) process.stdout.write(`${text}\n`);
    }

    /**
     * Writes one response while preserving the interactive prompt line.
     *
     * @param {import('readline').Interface} shell Readline shell.
     * @param {RealCliRenderer} renderer Output renderer.
     * @param {GameCliResponse} response Response to render.
     */
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

    /**
     * Shows the prompt when human output is enabled.
     *
     * @param {import('readline').Interface} shell Readline shell.
     * @param {RealCliRenderer} renderer Output renderer.
     */
    #prompt(shell, renderer) {
        if (renderer.output !== 'json') {
            this.promptReady = true;
            shell.prompt();
        }
    }

    /**
     * Builds the interactive-only command registry for this shell session.
     *
     * @param {() => void} clearScreen Clears the visible terminal.
     * @returns {RealCliCommandRegistry} Interactive command registry.
     */
    #realCliCommands(clearScreen) {
        return new RealCliCommandRegistry(defaultRealCliCommands(
            this.gameCli,
            this.cache,
            clearScreen,
        ));
    }

    /**
     * @param {string} text Command text.
     * @param {RealCliCommandRegistry} realCliCommands Interactive command registry.
     * @returns {import('../GameCli/GameCliResponse')|Promise<import('../GameCli/GameCliResponse')>|undefined} Command response.
     */
    #runRealCliCommand(text, realCliCommands) {
        return realCliCommands.run(text);
    }

    /**
     * @param {RealCliCommandRegistry} realCliCommands Interactive command registry.
     * @returns {GameCliResponse} Interactive help response.
     */
    #helpResponse(realCliCommands) {
        return GameCliResponse.help(GameCliHelp.general(this.gameCli.registry, [
            'get help',
            'post help',
            ...realCliCommands.helpLines(),
        ]));
    }

    /**
     * Mirrors async GameCli notices into the interactive shell.
     *
     * @param {(notice: object) => void} handler Notice handler.
     * @returns {() => void} Unsubscribe callback.
     */
    #bindNotices(handler) {
        if (typeof this.gameCli.on !== 'function' || typeof this.gameCli.off !== 'function') return () => {};

        this.gameCli.on('notice', handler);
        return () => this.gameCli.off('notice', handler);
    }

}

module.exports = RealCli;
