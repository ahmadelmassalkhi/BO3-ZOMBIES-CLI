/**
 * Base class for one GameCli command.
 */
class GameCliCommand {
    /**
     * @param {string} name Command name.
     * @param {string|string[]} usage Command usage lines.
     * @param {string} description Short command description.
     * @param {string[]} [notes=[]] Usage notes.
     */
    constructor(name, usage, description, notes = []) {
        if (typeof name !== 'string' || !name.trim()) throw new TypeError('GameCliCommand.name must be a non-empty string.');
        if (typeof usage === 'string' && !usage.trim()) throw new TypeError('GameCliCommand.usage must be non-empty.');
        if (Array.isArray(usage) && (!usage.length || !usage.every((line) => typeof line === 'string' && line.trim()))) {
            throw new TypeError('GameCliCommand.usage must contain non-empty strings.');
        }
        if (typeof usage !== 'string' && !Array.isArray(usage)) throw new TypeError('GameCliCommand.usage must be a string or string array.');
        if (typeof description !== 'string') throw new TypeError('GameCliCommand.description must be a string.');
        if (!Array.isArray(notes) || !notes.every((note) => typeof note === 'string' && note.trim())) {
            throw new TypeError('GameCliCommand.notes must be string[].');
        }

        this.name = name;
        this.usage = Object.freeze(Array.isArray(usage) ? [...usage] : [usage]);
        this.description = description;
        this.notes = Object.freeze([...notes]);
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
        return new TypeError(`${message} Run: ${this.name} help.`);
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

