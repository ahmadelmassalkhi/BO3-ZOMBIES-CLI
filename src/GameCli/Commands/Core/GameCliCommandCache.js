const GameCliCommand = require('../GameCliCommand');

/**
 * Core command for inspecting and clearing cached BO3 work.
 */
class GameCliCommandCache extends GameCliCommand {
    constructor() {
        super('cache', [
            'cache',
            'cache show',
            'cache clear',
            'cache clear all',
            'cache clear last',
            'cache clear last <count>',
        ], 'Shows or clears cached commands.', [
            '`cache` defaults to `cache show`.',
            '`cache clear` defaults to `cache clear all`.',
            '`cache clear last` defaults to one pending command.',
            'The active command may already be sent to BO3 and waiting for ACK.',
            'Active commands cannot be cleared.',
            'Queued commands can be cleared.',
        ], 'core');
    }

    /**
     * @param {string[]} args Cache args after the command name.
     * @returns {{action: 'show'}|{action: 'clear', mode: 'all'|'last', count: number}} Parsed cache command.
     */
    cache(args) {
        if (!Array.isArray(args)) throw new TypeError('cache.args must be an array.');
        return GameCliCommandCache.parse(['cache', ...args.map((arg) => String(arg || '').toLowerCase())]);
    }

    /**
     * @param {string[]} tokens Lowercase cache command tokens.
     * @returns {{action: 'show'}|{action: 'clear', mode: 'all'|'last', count: number}} Parsed cache command.
     */
    static parse(tokens) {
        if (!Array.isArray(tokens) || tokens[0] !== 'cache') throw GameCliCommandCache.usageError();

        if (tokens.length === 1) return { action: 'show' };
        if (tokens.length === 2 && tokens[1] === 'show') return { action: 'show' };
        if (tokens.length === 2 && tokens[1] === 'clear') return { action: 'clear', mode: 'all', count: 1 };
        if (tokens.length === 3 && tokens[1] === 'clear' && tokens[2] === 'all') return { action: 'clear', mode: 'all', count: 1 };
        if (tokens.length === 3 && tokens[1] === 'clear' && tokens[2] === 'last') return { action: 'clear', mode: 'last', count: 1 };

        if (tokens.length === 4 && tokens[1] === 'clear' && tokens[2] === 'last') {
            const count = Number.parseInt(tokens[3], 10);
            if (!Number.isInteger(count) || count < 1 || String(count) !== tokens[3]) {
                throw new TypeError('cache clear last count must be a positive integer.');
            }

            return { action: 'clear', mode: 'last', count };
        }

        throw GameCliCommandCache.usageError();
    }

    /**
     * @returns {TypeError} Consistent cache usage error.
     */
    static usageError() {
        return new TypeError('cache command is invalid. Run: cache help.');
    }

    events() {
        throw new TypeError('cache is a core command and does not create BO3 records.');
    }
}

module.exports = GameCliCommandCache;
