class GameCliHelp {
    static general(registry) {
        return [
            '[BO3 ZM CLI] Usage:',
            '  bo3-zm-cli help',
            '  bo3-zm-cli <command> help',
            '  bo3-zm-cli <command> [args]',
            '  bo3-zm-cli --json <command> [args]',
            '  bo3-zm-cli --plain <command> [args]',
            '  bo3-zm-cli --dry-run --json <command> [args]',
            '',
            '[BO3 ZM CLI] CLI commands:',
            '  get help',
            '  post help',
            '  cache help',
            '  clear',
            '',
            '[BO3 ZM CLI] Gameplay commands:',
            ...registry.commands
                .filter((command) => command.name !== 'get')
                .map((command) => `  ${command.name} help`),
        ].join('\n');
    }

    static command(command) {
        return [
            `[BO3 ZM CLI] ${command.name} usage:`,
            `  bo3-zm-cli ${command.usage}`,
            `  bo3-zm-cli --json ${command.usage}`,
            `  bo3-zm-cli --dry-run --json ${command.usage}`,
        ].join('\n');
    }

    static post() {
        return [
            '[BO3 ZM CLI] post usage:',
            '  bo3-zm-cli post <command> [args]',
            '  bo3-zm-cli post points +100',
            '  bo3-zm-cli post weapon give ray_gun',
        ].join('\n');
    }

    static cache() {
        return [
            '[BO3 ZM CLI] cache usage:',
            '  bo3-zm-cli cache',
            '  bo3-zm-cli cache show',
            '  bo3-zm-cli cache clear',
            '  bo3-zm-cli cache clear all',
            '  bo3-zm-cli cache clear last',
            '  bo3-zm-cli cache clear last <count>',
            '',
            '[BO3 ZM CLI] Notes:',
            '  - cache defaults to cache show.',
            '  - cache clear defaults to cache clear all.',
            '  - cache clear last defaults to one pending command.',
            '  - The first cached command may already be sent to BO3 and waiting for ACK.',
            '  - Active commands are shown in red and cannot be cleared.',
            '  - Pending commands are shown in green and can be cleared.',
        ].join('\n');
    }

    static clear() {
        return [
            '[BO3 ZM CLI] clear usage:',
            '  clear',
            '',
            '[BO3 ZM CLI] clear is interactive-only and clears the visible CLI log.',
        ].join('\n');
    }
}

module.exports = GameCliHelp;
