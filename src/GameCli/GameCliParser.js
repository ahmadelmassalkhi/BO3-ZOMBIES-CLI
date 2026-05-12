/**
 * Parses one human CLI line into tokens.
 */
class GameCliParser {
    /**
     * @param {string} text Raw command text.
     * @returns {string[]} Parsed tokens.
     */
    static tokens(text) {
        if (typeof text !== 'string') throw new TypeError('GameCli.text must be a string.');
        if (!text.trim()) throw new TypeError('GameCli.text must be a non-empty command.');

        const tokens = [];
        let token = '';
        let quote = '';
        let escaped = false;

        for (const char of text.trim()) {
            if (escaped) {
                token += char;
                escaped = false;
                continue;
            }

            if (quote && char === '\\') {
                escaped = true;
                continue;
            }

            if (quote) {
                if (char === quote) {
                    quote = '';
                } else {
                    token += char;
                }
                continue;
            }

            if (char === '"' || char === "'") {
                quote = char;
                continue;
            }

            if (/\s/.test(char)) {
                if (token) tokens.push(token);
                token = '';
                continue;
            }

            token += char;
        }

        if (escaped) token += '\\';
        if (quote) throw new TypeError(`GameCli.text has an unclosed ${quote} quote.`);
        if (token) tokens.push(token);
        if (!tokens.length) throw new TypeError('GameCli.text must be a non-empty command.');
        return tokens;
    }
}

module.exports = GameCliParser;

