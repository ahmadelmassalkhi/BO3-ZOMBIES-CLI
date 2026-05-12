const readline = require('readline');
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
            try {
                if (!options.dryRun) this.gameCli.start();
            } catch (error) {
                this.#write(renderer, GameCliResponse.failure(error));
                resolve(1);
                return;
            }

            const shell = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: renderer.output === 'json' ? '' : `${Ansi.cyan('bo3')} ${Ansi.gray('>')} `,
            });

            const close = async (exitCode = 0) => {
                if (this.shuttingDown) return;
                this.shuttingDown = true;
                shell.close();
                await this.#stop();
                resolve(exitCode);
            };

            shell.on('line', async (line) => {
                const text = line.trim();
                if (!text) return this.#prompt(shell, renderer);
                if (text === 'exit' || text === 'quit') return close(0);

                try {
                    this.#write(renderer, await this.#execute(text, options));
                } catch (error) {
                    this.#write(renderer, GameCliResponse.failure(error));
                }

                this.#prompt(shell, renderer);
            });

            shell.on('SIGINT', () => close(0));
            shell.on('close', () => {
                if (!this.shuttingDown) close(0);
            });

            if (renderer.output !== 'json') {
                const mode = options.dryRun ? 'dry-run mode; no BO3 connection will start.' : 'Type help, or exit to quit.';
                console.log(Ansi.yellow('[BO3 ZM CLI]'), mode);
            }
            this.#prompt(shell, renderer);
        });
    }

    #execute(text, options) {
        return options.dryRun ? this.gameCli.preview(text) : this.gameCli.execute(text);
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
        if (renderer.output !== 'json') shell.prompt();
    }

    #routeLogsToStderr() {
        console.log = (...args) => console.error(...args);
    }
}

module.exports = RealCli;
