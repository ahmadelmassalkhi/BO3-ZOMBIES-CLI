/**
 * Base class for one interactive-only command.
 */
class RealCliCommand {
    /**
     * @param {string} name Primary command name.
     * @param {string[]} [aliases=[]] Alternative command names.
     */
    constructor(name, aliases = []) {
        if (typeof name !== 'string' || !name.trim()) throw new TypeError('RealCliCommand.name must be a non-empty string.');
        if (!Array.isArray(aliases) || !aliases.every((alias) => typeof alias === 'string' && alias.trim())) {
            throw new TypeError('RealCliCommand.aliases must be string[].');
        }

        this.name = name;
        this.aliases = Object.freeze([...aliases]);
    }

    /**
     * @param {string[]} tokens Lowercase command tokens.
     * @returns {boolean} True when this command should handle the tokens.
     */
    matches(tokens) {
        if (!Array.isArray(tokens) || !tokens.length) return false;
        return tokens[0] === this.name || this.aliases.includes(tokens[0]);
    }

    /**
     * @param {string[]} tokens Lowercase command tokens.
     * @returns {import('../../GameCli/GameCliResponse')|Promise<import('../../GameCli/GameCliResponse')>} Command response.
     */
    run(tokens) {
        throw new Error(`${this.constructor.name}.run() must be implemented.`);
    }
}

module.exports = RealCliCommand;
