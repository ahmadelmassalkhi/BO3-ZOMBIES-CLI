/**
 * Base class for one GameCli command.
 */
class GameCliCommand {
    /**
     * @param {string} name Command name.
     * @param {string} usage Command usage.
     * @param {string} description Short command description.
     */
    constructor(name, usage, description) {
        if (typeof name !== 'string' || !name.trim()) throw new TypeError('GameCliCommand.name must be a non-empty string.');
        if (typeof usage !== 'string' || !usage.trim()) throw new TypeError('GameCliCommand.usage must be a non-empty string.');
        if (typeof description !== 'string') throw new TypeError('GameCliCommand.description must be a string.');

        this.name = name;
        this.usage = usage;
        this.description = description;
        Object.freeze(this);
    }

    /**
     * @param {string} name Raw command name.
     * @returns {boolean} True when this command owns the name.
     */
    matches(name) {
        const normalized = String(name || '').toLowerCase();
        return normalized === this.name;
    }

    /**
     * @param {import('../../Bo3/Bo3')} bo3 BO3 runtime.
     * @param {string[]} args Command args.
     * @returns {import('../../Bo3/Bo3Events/Bo3Event')[]} BO3 events.
     */
    events(bo3, args) {
        throw new Error(`${this.constructor.name}.events() must be implemented.`);
    }

    usageError(message) {
        return new TypeError(`${message} Run: bo3-zm-cli ${this.name} help.`);
    }

    canonicalToken(value, label) {
        const token = String(value ?? '').trim();
        if (!token || /\s/.test(token) || token !== token.toLowerCase()) {
            throw this.usageError(`${label} must be one lowercase canonical token.`);
        }

        return token;
    }
}

module.exports = GameCliCommand;

