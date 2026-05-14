const GameCliCommand = require('./Commands/GameCliCommand');
const defaultCommands = require('./Commands/defaultCommands');

class GameCliCommandRegistry {
    /**
     * @param {GameCliCommand[]} [commands=defaultCommands()] Registered GameCli commands.
     */
    constructor(commands = defaultCommands()) {
        if (!Array.isArray(commands) || !commands.every((command) => command instanceof GameCliCommand)) {
            throw new TypeError('GameCliCommandRegistry.commands must be GameCliCommand[].');
        }

        this.commands = Object.freeze([...commands]);
        Object.freeze(this);
    }

    /**
     * @param {string} name Command name.
     * @returns {GameCliCommand} Matching command.
     * @throws {TypeError} When no command owns the name.
     */
    get(name) {
        const command = this.commands.find((entry) => entry.matches(name));
        if (command) return command;
        throw new TypeError(`Unknown BO3 command "${name}". Use help.`);
    }
}

module.exports = GameCliCommandRegistry;

