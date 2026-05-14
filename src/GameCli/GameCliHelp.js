class GameCliHelp {
    static general(registry) {
        return [
            '[BO3 ZM CLI] Usage:',
            '  bo3-zm-cli help',
            '  bo3-zm-cli <command> help',
            '  bo3-zm-cli <command> [args]',
            '  bo3-zm-cli post <command> [args]',
            '  bo3-zm-cli get <weapons|perks|powerups> [wonderweapons]',
            '  bo3-zm-cli --json <command> [args]',
            '  bo3-zm-cli --plain <command> [args]',
            '  bo3-zm-cli --dry-run --json <command> [args]',
            '',
            '[BO3 ZM CLI] Commands:',
            ...registry.commands.map((command) => `  ${command.name.padEnd(8)} ${command.description}`),
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
}

module.exports = GameCliHelp;
