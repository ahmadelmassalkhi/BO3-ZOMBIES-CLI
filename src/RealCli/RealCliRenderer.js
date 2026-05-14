const Ansi = require('../GameCli/GameCliAnsi');
const GameCliResponse = require('../GameCli/GameCliResponse');

/**
 * Renders stable GameCli responses for humans, plain text, or JSON integrations.
 */
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
            if (line.startsWith('[CLI]') || line.startsWith('[GET]') || line.startsWith('[CACHE]')) return RealCliRenderer.#title(line);
            if (line.startsWith('[NOTICE]')) return RealCliRenderer.#notice(line, data);
            if (line.startsWith('[REPORT]')) return RealCliRenderer.#report(line);

            if (line.startsWith('{ ') && line.endsWith(' }')) return RealCliRenderer.#queryItems(line);
            if (line === '{' || line === '}') return Ansi.gray(line);
            if (RealCliRenderer.#isCacheItem(line)) return RealCliRenderer.#cacheItem(line);
            if (line.match(/^  - /)) return RealCliRenderer.#note(line);

            const helpCommand = line.match(/^  ([a-z]+)(?: ([a-z]+))?$/);
            if (helpCommand) {
                const command = Ansi.cyan(helpCommand[1]);
                const subcommand = helpCommand[2] ? ` ${helpCommand[2]}` : '';
                return `  ${command}${subcommand}`;
            }

            const commandLine = line.match(/^  ([a-z]+)\s{2,}(.*)$/);
            if (commandLine) return `  ${Ansi.cyan(commandLine[1].padEnd(8))} ${commandLine[2]}`;

            if (RealCliRenderer.#isUsageLine(line)) return RealCliRenderer.#commandUsage(line);

            return line;
        }).join('\n');
    }

    static #title(line) {
        return line
            .replace(/\[(CLI|GET|CACHE)\]/, (tag) => Ansi.gray(tag))
            .replace(/ on map ([^:]+):$/, (_, map) => ` on map ${Ansi.cyan(map)}:`);
    }

    static #report(line) {
        return line.replace(/\[[^\]]+\]/g, (tag) => {
            if (tag === '[REPORT]') return Ansi.gray(tag);
            if (tag === '[ERROR]') return Ansi.red(tag);
            if (tag === '[WARN]') return Ansi.yellow(tag);
            return Ansi.green(tag);
        });
    }

    static #notice(line, data = null) {
        const cacheShow = '\u0000CACHE_SHOW\u0000';
        const colored = line
            .replace('[NOTICE]', Ansi.gray('[NOTICE]'))
            .replace(/\bcache show\b/gi, cacheShow)
            .replace(/\bno live match\b/gi, (match) => Ansi.yellow(match))
            .replace(/\bbusy\b/gi, (match) => Ansi.yellow(match))
            .replace(/\bpaused\b/gi, (match) => Ansi.yellow(match))
            .replace(cacheShow, RealCliRenderer.#inlineCommand('cache show'))
            .replace(/ on map ([^;.]+)/, (_, map) => ` on map ${Ansi.cyan(map)}`);

        return RealCliRenderer.#inlineItems(colored, RealCliRenderer.#activeRequests(data));
    }

    static #queryItems(line) {
        const items = line.slice(2, -2).split(', ');
        return RealCliRenderer.#items(items.map((item) => Ansi.green(item)));
    }

    static #inlineItems(line, activeRequests = []) {
        return line.replace(/\{ ([^}]*) \}/g, (_, content) => RealCliRenderer.#items(content ? content.split(', ') : [], activeRequests));
    }

    static #items(items, activeRequests = []) {
        return [
            Ansi.gray('{ '),
            items.join(Ansi.gray(', ')),
            Ansi.gray(' }'),
        ].join('');
    }

    static #isCacheItem(line) {
        return /^  (active|queued)  /.test(line);
    }

    static #cacheItem(line) {
        const match = line.match(/^  (active|queued)  (.*)$/);
        const status = match[1] === 'active' ? Ansi.yellow('active') : Ansi.gray('queued');
        return `  ${status}  ${match[2]}`;
    }

    static #commandUsage(line) {
        const indent = line.match(/^\s*/)[0];
        let commandColored = false;
        const tokens = line.trim().split(/\s+/).map((token) => {
            if (token.startsWith('--')) return Ansi.yellow(token);
            if (token.startsWith('<') && token.endsWith('>')) {
                if (!commandColored) commandColored = true;
                return Ansi.gray(token);
            }
            if (/^[+-]<[^>]+>$/.test(token)) return Ansi.gray(token);
            if (token.startsWith('[') && token.endsWith(']')) return Ansi.gray(token);
            if (/^[a-z]+$/.test(token) && !commandColored) {
                commandColored = true;
                return Ansi.cyan(token);
            }
            return token;
        });

        return `${indent}${tokens.join(' ')}`;
    }

    static #isUsageLine(line) {
        return /^  (?:[a-z]+|--[a-z-]+|<[^>]+>)/.test(line);
    }

    static #note(line) {
        const prefix = line.match(/^\s*-\s*/)[0];
        const content = line.slice(prefix.length);
        const segments = content.split(/(`[^`]+`)/g).filter(Boolean).map((segment) => {
            if (segment.startsWith('`') && segment.endsWith('`')) return RealCliRenderer.#inlineCommand(segment.slice(1, -1));
            return Ansi.gray(segment);
        });

        return `${Ansi.gray(prefix)}${segments.join('')}`;
    }

    static #inlineCommand(command) {
        return Ansi.cyan(command);
    }

    static #activeRequests(data) {
        return data && Array.isArray(data.activeRequests) ? data.activeRequests : [];
    }
}

module.exports = RealCliRenderer;
