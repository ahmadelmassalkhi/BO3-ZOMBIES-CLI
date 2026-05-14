const fs = require('fs');
const path = require('path');

/**
 * Loads command classes from a folder by filename convention.
 */
class CommandDiscovery {
    /**
     * @param {object} options Discovery options.
     * @param {string} options.directory Directory containing command files.
     * @param {string} options.prefix Required filename prefix.
     * @param {Function} options.baseClass Required superclass.
     * @param {*[]} [options.args=[]] Constructor args passed to each command.
     * @param {string[]} [options.exclude=[]] Filenames to ignore.
     * @returns {ReadonlyArray<*>} Instantiated command objects.
     */
    static load({ directory, prefix, baseClass, args = [], exclude = [] }) {
        if (!Array.isArray(args)) throw new TypeError('CommandDiscovery.args must be an array.');

        const commands = CommandDiscovery.loadClasses({ directory, prefix, baseClass, exclude })
            .map((Command) => CommandDiscovery.#instantiate(Command, baseClass, args))
            .sort((left, right) => left.name.localeCompare(right.name));

        return Object.freeze(commands);
    }

    /**
     * @param {object} options Discovery options.
     * @param {string} options.directory Directory containing command files.
     * @param {string} options.prefix Required filename prefix.
     * @param {Function} options.baseClass Required superclass.
     * @param {string[]} [options.exclude=[]] Filenames to ignore.
     * @returns {ReadonlyArray<Function>} Discovered command classes.
     */
    static loadClasses({ directory, prefix, baseClass, exclude = [] }) {
        if (typeof directory !== 'string' || !directory.trim()) throw new TypeError('CommandDiscovery.directory must be a non-empty string.');
        if (typeof prefix !== 'string' || !prefix.trim()) throw new TypeError('CommandDiscovery.prefix must be a non-empty string.');
        if (typeof baseClass !== 'function') throw new TypeError('CommandDiscovery.baseClass must be a class.');
        if (!Array.isArray(exclude) || !exclude.every((file) => typeof file === 'string' && file.trim())) {
            throw new TypeError('CommandDiscovery.exclude must be string[].');
        }

        const classes = fs.readdirSync(directory)
            .filter((file) => CommandDiscovery.#isCommandFile(file, prefix, exclude))
            .sort((left, right) => left.localeCompare(right))
            .map((file) => CommandDiscovery.#loadClass(path.join(directory, file), baseClass));

        if (!classes.length) throw new Error(`No ${prefix} files were found in ${directory}.`);
        return Object.freeze(classes);
    }

    static #isCommandFile(file, prefix, exclude) {
        return file.endsWith('.js')
            && file.startsWith(prefix)
            && file !== `${prefix}.js`
            && !exclude.includes(file);
    }

    static #loadClass(file, baseClass) {
        const Command = require(file);
        if (typeof Command !== 'function') throw new TypeError(`${file} must export a command class.`);
        if (Command.name !== path.basename(file, '.js')) throw new TypeError(`${file} class name must match filename.`);
        if (!(Command.prototype instanceof baseClass)) throw new TypeError(`${file} must export a ${baseClass.name} subclass.`);

        return Command;
    }

    static #instantiate(Command, baseClass, args) {
        const command = new Command(...args);
        if (!(command instanceof baseClass)) throw new TypeError(`${Command.name} must create a ${baseClass.name}.`);

        return command;
    }
}

module.exports = CommandDiscovery;
