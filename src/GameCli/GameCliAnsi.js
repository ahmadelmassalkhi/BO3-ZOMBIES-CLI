class GameCliAnsi {
    static RESET = '\x1b[0m';
    static RED = '\x1b[31m';
    static GREEN = '\x1b[32m';
    static YELLOW = '\x1b[33m';
    static BLUE = '\x1b[34m';
    static CYAN = '\x1b[36m';
    static GRAY = '\x1b[90m';

    static red(text) { return this.#paint(this.RED, text); }
    static green(text) { return this.#paint(this.GREEN, text); }
    static yellow(text) { return this.#paint(this.YELLOW, text); }
    static blue(text) { return this.#paint(this.BLUE, text); }
    static cyan(text) { return this.#paint(this.CYAN, text); }
    static gray(text) { return this.#paint(this.GRAY, text); }

    static #paint(color, text) {
        return `${color}${String(text ?? '')}${this.RESET}`;
    }
}

Object.freeze(GameCliAnsi);
module.exports = GameCliAnsi;

