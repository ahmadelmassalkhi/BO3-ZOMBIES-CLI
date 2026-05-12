class Colors {
    static BLACK = '^0';
    static RED = '^1';
    static GREEN = '^2';
    static YELLOW = '^3';
    static BLUE = '^4';
    static CYAN = '^5';
    static PURPLE = '^6';
    static WHITE = '^7';
    static GRAY = '^8';
    static DARK_GRAY = '^9';

    static toBlack(text) { return this.#paint(this.BLACK, text); }
    static toRed(text) { return this.#paint(this.RED, text); }
    static toGreen(text) { return this.#paint(this.GREEN, text); }
    static toYellow(text) { return this.#paint(this.YELLOW, text); }
    static toBlue(text) { return this.#paint(this.BLUE, text); }
    static toCyan(text) { return this.#paint(this.CYAN, text); }
    static toPurple(text) { return this.#paint(this.PURPLE, text); }
    static toWhite(text) { return this.#paint(this.WHITE, text); }
    static toGray(text) { return this.#paint(this.GRAY, text); }
    static toDarkGray(text) { return this.#paint(this.DARK_GRAY, text); }

    static #paint(color, text) {
        return `${color}${String(text ?? '')}`;
    }
}

Object.freeze(Colors);
module.exports = Colors;
