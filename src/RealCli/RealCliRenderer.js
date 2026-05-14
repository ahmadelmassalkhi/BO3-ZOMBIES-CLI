const Ansi = require('../GameCli/GameCliAnsi');
const GameCliResponse = require('../GameCli/GameCliResponse');

class RealCliRenderer {
    /**
     * @param {'ansi'|'text'|'json'} output Output mode.
     */
    constructor(output = 'ansi') {
        if (!['ansi', 'text', 'json'].includes(output)) throw new TypeError('RealCliRenderer.output is invalid.');
        this.output = output;
        Object.freeze(this);
    }

    /**
     * @param {GameCliResponse} response GameCli response.
     * @returns {string} Rendered response.
     */
    render(response) {
        if (!(response instanceof GameCliResponse)) throw new TypeError('RealCliRenderer.response must be a GameCliResponse.');
        if (this.output === 'json') return JSON.stringify(response.toJSON());
        if (this.output === 'text') return response.text;
        return response.ok ? this.#ansi(response.text) : Ansi.red(response.text);
    }

    #ansi(text) {
        return String(text).split('\n').map((line) => {
            if (line.startsWith('[BO3 ZM CLI]')) return line.replace('[BO3 ZM CLI]', Ansi.yellow('[BO3 ZM CLI]'));

            const itemLine = line.match(/^  - (.+)$/);
            if (itemLine) return `  ${Ansi.gray('-')} ${Ansi.cyan(itemLine[1])}`;

            const commandLine = line.match(/^  ([a-z]+)\s{2,}(.*)$/);
            if (commandLine) return `  ${Ansi.blue(commandLine[1].padEnd(8))} ${commandLine[2]}`;

            if (line.trim().startsWith('bo3-zm-cli')) {
                return line
                    .replace('bo3-zm-cli', Ansi.cyan('bo3-zm-cli'))
                    .replace(/--json|--plain|--ansi|--dry-run/g, (match) => Ansi.yellow(match))
                    .replace(/<command>/g, Ansi.blue('<command>'))
                    .replace(/\[args\]/g, Ansi.gray('[args]'))
                    .replace(/\bhelp\b/g, Ansi.green('help'));
            }

            return line;
        }).join('\n');
    }
}

module.exports = RealCliRenderer;
