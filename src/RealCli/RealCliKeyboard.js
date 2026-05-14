/**
 * Owns interactive keyboard overrides for the readline shell.
 */
class RealCliKeyboard {
    /**
     * @param {import('readline').Interface} shell Readline shell.
     * @param {() => void} cancel Ctrl+C handler.
     * @param {() => void} quit Ctrl+W handler.
     * @returns {() => void} Function that restores the original key handler.
     */
    static bind(shell, cancel, quit) {
        if (!shell || typeof shell._ttyWrite !== 'function' || typeof shell._deleteWordLeft !== 'function') return () => {};
        if (typeof cancel !== 'function') throw new TypeError('RealCliKeyboard.cancel must be a function.');
        if (typeof quit !== 'function') throw new TypeError('RealCliKeyboard.quit must be a function.');

        const write = shell._ttyWrite;
        shell._ttyWrite = function wrappedTtyWrite(sequence, key = {}) {
            if (RealCliKeyboard.#ctrlC(sequence, key)) return cancel();
            if (RealCliKeyboard.#ctrlW(sequence, key)) return quit();
            if (RealCliKeyboard.#ctrlBackspace(sequence, key)) return this._deleteWordLeft();
            return write.call(this, sequence, key);
        };

        return () => { shell._ttyWrite = write; };
    }

    static #ctrlBackspace(sequence, key) {
        return key
            && key.name === 'backspace'
            && (
                key.ctrl
                || sequence === '\b'
                || sequence === '\x1b[127;5u'
                || sequence === '\x1b[8;5~'
            );
    }

    static #ctrlC(sequence, key) {
        return key && key.ctrl && key.name === 'c' && sequence === '\x03';
    }

    static #ctrlW(sequence, key) {
        return key && key.ctrl && key.name === 'w' && sequence === '\x17';
    }
}

module.exports = RealCliKeyboard;
