const Bo3 = require('../Bo3/Bo3');
const GameCliCommandRegistry = require('./GameCliCommandRegistry');
const GameCliHelp = require('./GameCliHelp');
const GameCliParser = require('./GameCliParser');
const GameCliResponse = require('./GameCliResponse');

/**
 * Programmatic BO3 command API.
 *
 * Other applications call execute(text) or executeAll(text[]) and receive a
 * stable response object. This class is the only layer that parses CLI text.
 */
class GameCli {
    /**
     * @param {Bo3} [bo3=new Bo3()] BO3 runtime.
     * @param {GameCliCommandRegistry} [registry=new GameCliCommandRegistry()] Command registry.
     */
    constructor(bo3 = new Bo3(), registry = new GameCliCommandRegistry()) {
        if (!(bo3 instanceof Bo3)) throw new TypeError('GameCli.bo3 must be a Bo3 instance.');
        if (!(registry instanceof GameCliCommandRegistry)) throw new TypeError('GameCli.registry must be a GameCliCommandRegistry.');

        this.bo3 = bo3;
        this.registry = registry;
    }

    /**
     * Starts the BO3 runtime behind this CLI.
     *
     * @returns {GameCli} This CLI.
     */
    start() {
        this.bo3.start();
        return this;
    }

    /**
     * Stops the BO3 runtime behind this CLI.
     *
     * @returns {Promise<void>} Stop result.
     */
    stop() {
        return this.bo3.stop();
    }

    /**
     * @param {string} text One CLI command.
     * @returns {Promise<GameCliResponse>} Command response.
     */
    execute(text) {
        return this.executeAll([text]);
    }

    /**
     * @param {string} text One CLI command.
     * @returns {GameCliResponse} Preview response without sending records.
     */
    preview(text) {
        return this.previewAll([text]);
    }

    /**
     * @param {string[]} texts CLI commands to validate, translate, then send together.
     * @returns {Promise<GameCliResponse>} Command response.
     */
    async executeAll(texts) {
        const compiled = this.#compiledCommands(texts);
        if (compiled.help) return compiled.help;

        const records = GameCli.#records(compiled.commands);
        const label = compiled.commands.map((command) => command.name).join(', ');
        const result = records.length ? await this.bo3.sendRecords(records, label) : undefined;
        return GameCliResponse.sent(records.length, records, result);
    }

    /**
     * @param {string[]} texts CLI commands to validate and translate without sending.
     * @returns {GameCliResponse} Preview response.
     */
    previewAll(texts) {
        const compiled = this.#compiledCommands(texts);
        if (compiled.help) return compiled.help;

        const records = GameCli.#records(compiled.commands);
        return GameCliResponse.preview(records.length, records);
    }

    #compiledCommands(texts) {
        if (!Array.isArray(texts) || !texts.length) throw new TypeError('GameCli expected a non-empty string array.');
        if (!texts.every((text) => typeof text === 'string')) throw new TypeError('GameCli expected a string array.');

        const commands = texts.map((text) => this.#compile(text));
        if (commands.length === 1 && commands[0].help) return { help: commands[0].help };
        if (commands.some((command) => command.help)) throw new TypeError('GameCli cannot batch help with gameplay commands.');
        return { commands };
    }

    static #records(compiledCommands) {
        return compiledCommands.flatMap((command) => command.events.flatMap((event) => event.toRecords()));
    }

    #compile(text) {
        const tokens = GameCliParser.tokens(text);
        const commandName = tokens[0].toLowerCase();

        if (commandName === 'help') return { help: this.#help(tokens[1]) };
        if (tokens[tokens.length - 1].toLowerCase() === 'help') return { help: this.#help(commandName) };

        const command = this.registry.get(commandName);
        return {
            name: command.name,
            events: command.events(this.bo3, tokens.slice(1)),
        };
    }

    #help(commandName) {
        const text = commandName
            ? GameCliHelp.command(this.registry.get(commandName))
            : GameCliHelp.general(this.registry);

        return GameCliResponse.help(text);
    }
}

module.exports = GameCli;
