/**
 * Base class for one GameCli command.
 */
class GameCliCommand {
    /**
     * @param {string} name Command name.
     * @param {string} usage Command usage.
     * @param {string} description Short command description.
     * @param {string[]} [aliases=[]] Command aliases.
     */
    constructor(name, usage, description, aliases = []) {
        if (typeof name !== 'string' || !name.trim()) throw new TypeError('GameCliCommand.name must be a non-empty string.');
        if (typeof usage !== 'string' || !usage.trim()) throw new TypeError('GameCliCommand.usage must be a non-empty string.');
        if (typeof description !== 'string') throw new TypeError('GameCliCommand.description must be a string.');
        if (!Array.isArray(aliases)) throw new TypeError('GameCliCommand.aliases must be a string array.');

        this.name = name;
        this.usage = usage;
        this.description = description;
        this.aliases = Object.freeze(aliases.map((alias) => String(alias).toLowerCase()));
        Object.freeze(this);
    }

    /**
     * @param {string} name Raw command name.
     * @returns {boolean} True when this command owns the name.
     */
    matches(name) {
        const normalized = String(name || '').toLowerCase();
        return normalized === this.name || this.aliases.includes(normalized);
    }

    /**
     * @param {import('../../Bo3/Bo3')} bo3 BO3 runtime.
     * @param {string[]} args Command args.
     * @returns {import('../../Bo3/Bo3Events/Bo3Event')[]} BO3 events.
     */
    events(bo3, args) {
        throw new Error(`${this.constructor.name}.events() must be implemented.`);
    }

    positiveInt(value, label) {
        if (!/^\d+$/.test(String(value ?? ''))) throw new TypeError(`${label} must be a positive integer.`);
        const parsed = Number.parseInt(value, 10);
        if (!Number.isSafeInteger(parsed) || parsed < 1) throw new TypeError(`${label} must be a positive integer.`);
        return parsed;
    }

    signedInt(value, label) {
        if (!/^[+-]?\d+$/.test(String(value ?? ''))) throw new TypeError(`${label} must be an integer.`);
        const parsed = Number.parseInt(value, 10);
        if (!Number.isSafeInteger(parsed) || parsed === 0) throw new TypeError(`${label} must not be zero.`);
        return parsed;
    }

    tokenText(args, fallback) {
        if (!Array.isArray(args)) throw new TypeError('GameCliCommand.args must be an array.');
        const text = args.join('_').trim();
        return text || fallback;
    }
}

module.exports = GameCliCommand;

