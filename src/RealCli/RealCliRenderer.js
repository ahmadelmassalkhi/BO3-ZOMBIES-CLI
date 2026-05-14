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
        return response.ok ? this.#ansi(response.text, response.data) : Ansi.red(response.text);
    }

    #ansi(text, data = null) {
        return String(text).split('\n').map((line) => {
            if (line.startsWith('[CLI]') || line.startsWith('[GET]')) return RealCliRenderer.#title(line);
            if (line.startsWith('[NOTICE]')) return RealCliRenderer.#notice(line, data);
            if (line.startsWith('[REPORT]')) return RealCliRenderer.#report(line);

            if (line.startsWith('{ ') && line.endsWith(' }')) return RealCliRenderer.#queryItems(line);
            if (line === '{' || line === '}') return Ansi.gray(line);
            if (RealCliRenderer.#isCacheItem(line, data)) return RealCliRenderer.#cacheItem(line, data);
            if (line.match(/^  - /)) return RealCliRenderer.#note(line);

            const helpCommand = line.match(/^  ([a-z]+)(?: ([a-z]+))?$/);
            if (helpCommand) {
                const command = Ansi.blue(helpCommand[1]);
                const subcommand = helpCommand[2] ? ` ${Ansi.green(helpCommand[2])}` : '';
                return `  ${command}${subcommand}`;
            }

            const commandLine = line.match(/^  ([a-z]+)\s{2,}(.*)$/);
            if (commandLine) return `  ${Ansi.blue(commandLine[1].padEnd(8))} ${commandLine[2]}`;

            if (line.trim().startsWith('bo3-zm-cli')) {
                return RealCliRenderer.#commandUsage(line);
            }

            return line;
        }).join('\n');
    }

    static #title(line) {
        return line
            .replace(/\[(CLI|GET)\]/, (tag) => Ansi.yellow(tag))
            .replace(/ on map ([^:]+):$/, (_, map) => ` on map ${Ansi.red(map)}:`);
    }

    static #report(line) {
        return line.replace(/\[[^\]]+\]/g, (tag) => {
            if (tag === '[REPORT]') return Ansi.yellow(tag);
            if (tag === '[ERROR]') return Ansi.red(tag);
            if (tag === '[WARN]') return Ansi.yellow(tag);
            return Ansi.green(tag);
        });
    }

    static #notice(line, data = null) {
        const cacheShow = '\u0000CACHE_SHOW\u0000';
        const colored = line
            .replace('[NOTICE]', Ansi.yellow('[NOTICE]'))
            .replace(/\bcache show\b/gi, cacheShow)
            .replace(/\bpaused\b/gi, (match) => Ansi.red(match))
            .replace(/\bwaiting for live gameplay\b/gi, (match) => Ansi.yellow(match))
            .replace(/\bno live match\b/gi, (match) => Ansi.yellow(match))
            .replace(/\bbusy\b/gi, (match) => Ansi.yellow(match))
            .replace(/\bwaiting for BO3 ACK\b/gi, (match) => Ansi.yellow(match))
            .replace(/\bwaiting for current command\b/gi, (match) => Ansi.yellow(match))
            .replace(/\bcache\b/gi, (match) => Ansi.yellow(match))
            .replace(cacheShow, RealCliRenderer.#inlineCommand('cache show'))
            .replace(/ on map ([^;.]+)/, (_, map) => ` on map ${Ansi.red(map)}`);

        return RealCliRenderer.#inlineItems(colored, RealCliRenderer.#activeRequests(data));
    }

    static #queryItems(line) {
        const items = line.slice(2, -2).split(', ');
        return RealCliRenderer.#items(items);
    }

    static #inlineItems(line, activeRequests = []) {
        return line.replace(/\{ ([^}]*) \}/g, (_, content) => RealCliRenderer.#items(content ? content.split(', ') : [], activeRequests));
    }

    static #items(items, activeRequests = []) {
        return [
            Ansi.gray('{ '),
            items.map((item) => activeRequests.includes(item) ? Ansi.red(item) : Ansi.green(item)).join(Ansi.gray(', ')),
            Ansi.gray(' }'),
        ].join('');
    }

    static #isCacheItem(line, data) {
        const requests = data
            ? (data.activeRequests || []).concat(data.requests || [])
            : [];
        const text = line.trim().replace(/,$/, '');
        return requests.includes(text);
    }

    static #cacheItem(line, data) {
        const comma = line.trim().endsWith(',') ? Ansi.gray(',') : '';
        const request = line.trim().replace(/,$/, '');
        const active = data && Array.isArray(data.activeRequests) && data.activeRequests.includes(request);
        return `  ${active ? Ansi.red(request) : Ansi.green(request)}${comma}`;
    }

    static #commandUsage(line) {
        const indent = line.match(/^\s*/)[0];
        let commandColored = false;
        const tokens = line.trim().split(/\s+/).map((token) => {
            if (token === 'bo3-zm-cli') return Ansi.cyan(token);
            if (token.startsWith('--')) return Ansi.yellow(token);
            if (token.startsWith('<') && token.endsWith('>')) {
                if (!commandColored) commandColored = true;
                return Ansi.blue(token);
            }
            if (token.startsWith('[') && token.endsWith(']')) return Ansi.gray(token);
            if (/^[a-z]+$/.test(token) && !commandColored) {
                commandColored = true;
                return Ansi.blue(token);
            }
            if (/^[a-z]+$/.test(token)) return Ansi.green(token);
            return token;
        });

        return `${indent}${tokens.join(' ')}`;
    }

    static #note(line) {
        const prefix = line.match(/^\s*-\s*/)[0];
        const content = line.slice(prefix.length);
        const commands = ['cache clear last', 'cache clear all', 'cache clear', 'cache show', 'cache'];
        let index = 0;
        let output = Ansi.gray(prefix);
        let gray = '';

        const flush = () => {
            if (!gray) return;
            output += Ansi.gray(gray);
            gray = '';
        };

        while (index < content.length) {
            const command = commands.find((item) => {
                return content.slice(index).startsWith(item)
                    && RealCliRenderer.#hasWordBoundary(content, index, item.length);
            });

            if (command) {
                flush();
                output += RealCliRenderer.#inlineCommand(command);
                index += command.length;
            } else {
                gray += content[index];
                index += 1;
            }
        }

        flush();
        return output;
    }

    static #inlineCommand(command) {
        const [name, ...args] = command.split(' ');
        return [
            Ansi.blue(name),
            ...args.map((arg) => Ansi.green(arg)),
        ].join(' ');
    }

    static #hasWordBoundary(text, index, length) {
        const before = index > 0 ? text[index - 1] : '';
        const after = text[index + length] || '';
        return !/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after);
    }

    static #activeRequests(data) {
        return data && Array.isArray(data.activeRequests) ? data.activeRequests : [];
    }
}

module.exports = RealCliRenderer;
