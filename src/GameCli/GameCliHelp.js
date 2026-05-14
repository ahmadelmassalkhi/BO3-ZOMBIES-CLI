/**
 * Builds plain help text; RealCliRenderer owns colors.
 */
class GameCliHelp {
    /**
     * @param {import('./GameCliCommandRegistry')} registry Gameplay command registry.
     * @param {string[]} [cliCommands] CLI command help lines.
     * @returns {string} Main help page.
     */
    static general(registry, cliCommands = ['get help', 'post help', 'cache help', 'clear help']) {
        return [
            '[CLI] Usage:',
            '  help',
            '  <command> help',
            '  <command> [args]',
            '',
            '[CLI] CLI commands:',
            ...cliCommands.map((command) => `  ${command}`),
            '',
            '[CLI] Gameplay commands:',
            ...registry.commands
                .filter((command) => command.group === 'gameplay')
                .map((command) => `  ${command.name} help`),
        ].join('\n');
    }

    /**
     * @param {import('./Commands/GameCliCommand')} command Gameplay command.
     * @returns {string} Command help page.
     */
    static command(command) {
        return GameCliHelp.#page(`${command.name} usage`, command.usage, command.notes);
    }

    /**
     * @returns {string} Post command help page.
     */
    static post() {
        return GameCliHelp.#page('post usage', [
            'post <command> [args]',
            'post points +100',
            'post weapon give ray_gun',
        ], [
            '`post` is optional; gameplay commands run as post by default.',
            '`post` cannot run `get`.',
        ]);
    }

    /**
     * @returns {string} Clear command help page.
     */
    static clear() {
        return GameCliHelp.#page('clear usage', [
            'clear',
        ], [
            '`clear` is interactive-only and clears the visible CLI log.',
        ]);
    }

    /**
     * @param {string} title Help title without [CLI].
     * @param {string[]} usageLines Usage lines.
     * @param {string[]} [notes=[]] Optional notes.
     * @returns {string} Help page.
     */
    static #page(title, usageLines, notes = []) {
        const lines = [
            `[CLI] ${title}:`,
            ...usageLines.map((line) => `  ${line}`),
        ];

        if (notes.length) lines.push('[CLI] Notes:', ...notes.map((note) => `  - ${note}`));

        return lines.join('\n');
    }
}

module.exports = GameCliHelp;
