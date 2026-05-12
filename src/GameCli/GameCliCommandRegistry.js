const GameCliCommand = require('./Commands/GameCliCommand');
const defaultCommands = require('./Commands/defaultCommands');

class GameCliCommandRegistry {
    constructor(commands = defaultCommands()) {
        if (!Array.isArray(commands) || !commands.every((command) => command instanceof GameCliCommand)) {
            throw new TypeError('GameCliCommandRegistry.commands must be GameCliCommand[].');
        }

        this.commands = Object.freeze([...commands]);
        Object.freeze(this);
    }

    get(name) {
        const command = this.commands.find((entry) => entry.matches(name));
        if (command) return command;
        throw new TypeError(`Unknown BO3 command "${name}". Use help.`);
    }
}

module.exports = GameCliCommandRegistry;

