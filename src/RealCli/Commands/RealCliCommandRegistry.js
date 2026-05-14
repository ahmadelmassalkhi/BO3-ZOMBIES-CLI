const RealCliCommand = require('./RealCliCommand');

/**
 * Finds and runs interactive-only commands.
 */
class RealCliCommandRegistry {
    /**
     * @param {RealCliCommand[]} commands RealCli commands.
     */
    constructor(commands) {
        if (!Array.isArray(commands) || !commands.every((command) => command instanceof RealCliCommand)) {
            throw new TypeError('RealCliCommandRegistry.commands must be RealCliCommand[].');
        }

        this.commands = Object.freeze([...commands]);
        Object.freeze(this);
    }

    /**
     * Runs a command when the first token matches an interactive-only command.
     *
     * @param {string} text Raw command text.
     * @returns {import('../../GameCli/GameCliResponse')|Promise<import('../../GameCli/GameCliResponse')>|undefined} Command response, or undefined when unhandled.
     */
    run(text) {
        const tokens = RealCliCommandRegistry.#tokens(text);
        const command = this.commands.find((entry) => entry.matches(tokens));
        if (!command) return undefined;

        return command.run(tokens);
    }

    /**
     * @returns {string[]} Help lines for registered interactive commands.
     */
    helpLines() {
        return this.commands.map((command) => `${command.name} help`);
    }

    static #tokens(text) {
        return String(text || '')
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
    }
}

module.exports = RealCliCommandRegistry;
