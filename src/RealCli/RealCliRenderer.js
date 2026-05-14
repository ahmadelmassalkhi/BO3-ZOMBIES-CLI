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
            if (line.startsWith('[BO3 ZM CLI]')) return RealCliRenderer.#title(line);
            if (line.startsWith('[BO3 REPORT]')) return RealCliRenderer.#report(line);

            if (line.startsWith('{ ') && line.endsWith(' }')) return RealCliRenderer.#queryItems(line);

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

    static #title(line) {
        return line
            .replace('[BO3 ZM CLI]', Ansi.yellow('[BO3 ZM CLI]'))
            .replace(/ on map ([^:]+):$/, (_, map) => ` on map ${Ansi.red(map)}:`);
    }

    static #report(line) {
        return line.replace(/\[[^\]]+\]/g, (tag) => {
            if (tag === '[BO3 REPORT]') return Ansi.yellow(tag);
            if (tag === '[ERROR]') return Ansi.red(tag);
            if (tag === '[WARN]') return Ansi.yellow(tag);
            return Ansi.green(tag);
        });
    }

    static #queryItems(line) {
        const items = line.slice(2, -2).split(', ');
        return [
            Ansi.gray('{ '),
            items.map((item) => Ansi.green(item)).join(Ansi.gray(', ')),
            Ansi.gray(' }'),
        ].join('');
    }
}

module.exports = RealCliRenderer;
