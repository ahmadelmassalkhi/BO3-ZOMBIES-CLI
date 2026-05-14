/**
 * Parses cache commands for both the programmatic CLI and the interactive CLI.
 */
class GameCliCache {
    /**
     * @param {string[]} tokens Lowercase cache command tokens.
     * @returns {{action: 'show'}|{action: 'clear', mode: 'all'|'last', count: number}} Parsed cache command.
     */
    static parse(tokens) {
        if (!Array.isArray(tokens) || tokens[0] !== 'cache') throw GameCliCache.usageError();

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

        throw GameCliCache.usageError();
    }

    /**
     * @returns {TypeError} Consistent cache usage error.
     */
    static usageError() {
        return new TypeError('cache command is invalid. Run: cache help.');
    }
}

module.exports = GameCliCache;
