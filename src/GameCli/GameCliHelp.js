class GameCliHelp {
    static general(registry) {
        return [
            '[CLI] Usage:',
            '  help',
            '  <command> help',
            '  <command> [args]',
            '',
            '[CLI] CLI commands:',
            '  get help',
            '  post help',
            '  cache help',
            '  clear',
            '',
            '[CLI] Gameplay commands:',
            ...registry.commands
                .filter((command) => command.name !== 'get')
                .map((command) => `  ${command.name} help`),
        ].join('\n');
    }

    static command(command) {
        return GameCliHelp.#page(`${command.name} usage`, command.usage, command.notes);
    }

    static post() {
        return GameCliHelp.#page('post usage', [
            'post <command> [args]',
            'post points +100',
            'post weapon give ray_gun',
        ], [
            'post is optional; gameplay commands run as post by default.',
            'post cannot run get.',
        ]);
    }

    static cache() {
        return GameCliHelp.#page('cache usage', [
            'cache',
            'cache show',
            'cache clear',
            'cache clear all',
            'cache clear last',
            'cache clear last <count>',
        ], [
            'cache defaults to cache show.',
            'cache clear defaults to cache clear all.',
            'cache clear last defaults to one pending command.',
            'The active command may already be sent to BO3 and waiting for ACK.',
            'Active commands cannot be cleared.',
            'Queued commands can be cleared.',
        ]);
    }

    static clear() {
        return GameCliHelp.#page('clear usage', [
            'clear',
        ], [
            'clear is interactive-only and clears the visible CLI log.',
        ]);
    }

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
