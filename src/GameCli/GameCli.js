const EventEmitter = require('events');
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
class GameCli extends EventEmitter {
    /**
     * @param {Bo3} [bo3=new Bo3()] BO3 runtime.
     * @param {GameCliCommandRegistry} [registry=new GameCliCommandRegistry()] Command registry.
     */
    constructor(bo3 = new Bo3(), registry = new GameCliCommandRegistry()) {
        super();
        if (!(bo3 instanceof Bo3)) throw new TypeError('GameCli.bo3 must be a Bo3 instance.');
        if (!(registry instanceof GameCliCommandRegistry)) throw new TypeError('GameCli.registry must be a GameCliCommandRegistry.');

        this.bo3 = bo3;
        this.registry = registry;
        this.bo3.on('notice', (notice) => this.emit('notice', notice));
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
     * @returns {Promise<void>} BO3 startup warmup/log completion.
     */
    ready() {
        return this.bo3.ready();
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
     * Clears cached commands that have not entered BO3's in-flight ACK slot.
     *
     * @param {'all'|'last'} [mode='all'] Clear mode.
     * @param {number} [count=1] Number of last cached requests to clear.
     * @returns {GameCliResponse} Cache clear response.
     */
    clearCache(mode = 'all', count = 1) {
        return GameCliResponse.cacheCleared(this.bo3.clearCache(mode, count));
    }

    /**
     * @returns {GameCliResponse} Current cache response.
     */
    showCache() {
        return GameCliResponse.cacheShown(this.bo3.cache());
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
        if (compiled.cache) {
            return compiled.cache.action === 'clear'
                ? this.clearCache(compiled.cache.mode, compiled.cache.count)
                : this.showCache();
        }
        if (compiled.query) {
            const result = await this.bo3.get(compiled.query.target, compiled.query.filter);
            return result && result.queued
                ? GameCliResponse.queued(0, [], result)
                : GameCliResponse.query(GameCli.#queryText(result), result);
        }

        const records = GameCli.#records(compiled.commands);
        const label = compiled.commands.map((command) => command.name).join(', ');
        const result = records.length ? await this.bo3.sendRecords(records, label) : undefined;
        return result && result.queued
            ? GameCliResponse.queued(records.length, records, result)
            : GameCliResponse.sent(records.length, records, result);
    }

    /**
     * @param {string[]} texts CLI commands to validate and translate without sending.
     * @returns {GameCliResponse} Preview response.
     */
    previewAll(texts) {
        const compiled = this.#compiledCommands(texts);
        if (compiled.help) return compiled.help;
        if (compiled.cache) return GameCliResponse.success(`previewed cache ${compiled.cache.action}.`, { status: 'preview', data: { cache: compiled.cache } });
        if (compiled.query) return GameCliResponse.success(GameCli.#queryPreviewText(compiled.query), { status: 'preview', data: compiled.query });

        const records = GameCli.#records(compiled.commands);
        return GameCliResponse.preview(records.length, records);
    }

    #compiledCommands(texts) {
        if (!Array.isArray(texts) || !texts.length) throw new TypeError('GameCli expected a non-empty string array.');
        if (!texts.every((text) => typeof text === 'string')) throw new TypeError('GameCli expected a string array.');

        const commands = texts.map((text) => this.#compile(text));
        if (commands.length === 1 && commands[0].help) return { help: commands[0].help };
        if (commands.length === 1 && commands[0].cache) return { cache: commands[0].cache };
        if (commands.some((command) => command.help)) throw new TypeError('GameCli cannot batch help with gameplay commands.');
        if (commands.some((command) => command.cache)) throw new TypeError('GameCli cannot batch cache commands with gameplay commands.');
        if (commands.length === 1 && commands[0].query) return { query: commands[0].query };
        if (commands.some((command) => command.query)) throw new TypeError('GameCli cannot batch get with other commands.');
        return { commands };
    }

    static #records(compiledCommands) {
        return compiledCommands.flatMap((command) => command.events.flatMap((event) => event.toRecords()));
    }

    #compile(text) {
        const tokens = GameCliParser.tokens(text);
        return this.#compileTokens(tokens);
    }

    #compileTokens(tokens) {
        const commandName = tokens[0].toLowerCase();

        if (commandName === 'help') return { help: this.#help(tokens[1]) };
        if (commandName === 'cache') return this.#compileCache(tokens);
        if (commandName === 'clear') return this.#compileClear(tokens);
        if (commandName === 'post' && tokens.length === 2 && tokens[1].toLowerCase() === 'help') return { help: this.#help('post') };
        if (commandName === 'post') return this.#compilePost(tokens.slice(1));
        if (tokens[tokens.length - 1].toLowerCase() === 'help') return { help: this.#help(commandName) };

        const command = this.registry.get(commandName);
        if (typeof command.get === 'function') {
            return {
                name: command.name,
                query: command.get(tokens.slice(1)),
            };
        }

        return {
            name: command.name,
            events: command.events(this.bo3, tokens.slice(1)),
        };
    }

    #compilePost(tokens) {
        if (!tokens.length) throw new TypeError('post requires a command.');
        if (tokens[0].toLowerCase() === 'get') throw new TypeError('post cannot run get. Use get directly.');
        return this.#compileTokens(tokens);
    }

    #compileCache(tokens) {
        if (tokens.length === 2 && tokens[1].toLowerCase() === 'help') return { help: this.#help('cache') };
        if (tokens.length === 1) return { cache: { action: 'show' } };
        if (tokens.length === 2 && tokens[1].toLowerCase() === 'show') return { cache: { action: 'show' } };
        if (tokens.length === 2 && tokens[1].toLowerCase() === 'clear') return { cache: { action: 'clear', mode: 'all', count: 1 } };
        if (tokens.length === 3 && tokens[1].toLowerCase() === 'clear' && tokens[2].toLowerCase() === 'all') return { cache: { action: 'clear', mode: 'all', count: 1 } };
        if (tokens.length === 3 && tokens[1].toLowerCase() === 'clear' && tokens[2].toLowerCase() === 'last') return { cache: { action: 'clear', mode: 'last', count: 1 } };
        if (tokens.length === 4 && tokens[1].toLowerCase() === 'clear' && tokens[2].toLowerCase() === 'last') {
            const count = Number.parseInt(tokens[3], 10);
            if (!Number.isInteger(count) || count < 1 || String(count) !== tokens[3]) throw new TypeError('cache clear last count must be a positive integer.');
            return { cache: { action: 'clear', mode: 'last', count } };
        }
        throw new TypeError('cache usage: cache [show] | cache clear [all|last [count]]. Run: bo3-zm-cli cache help.');
    }

    #compileClear(tokens) {
        if (tokens.length === 2 && tokens[1].toLowerCase() === 'help') return { help: this.#help('clear') };
        if (tokens.length === 1) return { help: this.#help('clear') };
        throw new TypeError('clear usage: clear. Run: bo3-zm-cli clear help.');
    }

    #help(commandName) {
        if (String(commandName || '').toLowerCase() === 'post') return GameCliResponse.help(GameCliHelp.post());
        if (String(commandName || '').toLowerCase() === 'cache') return GameCliResponse.help(GameCliHelp.cache());
        if (String(commandName || '').toLowerCase() === 'clear') return GameCliResponse.help(GameCliHelp.clear());

        const text = commandName
            ? GameCliHelp.command(this.registry.get(commandName))
            : GameCliHelp.general(this.registry);

        return GameCliResponse.help(text);
    }

    static #queryPreviewText(query) {
        return `previewed BO3 get ${query.target}${query.filter ? ` ${query.filter}` : ''}.`;
    }

    static #queryText(result) {
        const queryName = `${result.target}${result.filter ? ` ${result.filter}` : ''}`;
        const mapName = result.map ? ` on map ${result.map}` : '';
        const title = `[BO3 ZM CLI] ${queryName}${mapName}:`;
        const items = result.items.length ? result.items.join(', ') : '<empty>';
        return `${title}\n{ ${items} }`;
    }
}

module.exports = GameCli;
