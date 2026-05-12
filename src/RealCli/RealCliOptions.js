class RealCliOptions {
    /**
     * @param {string[]} argv Process args after executable name.
     */
    constructor(argv = []) {
        if (!Array.isArray(argv)) throw new TypeError('RealCli.argv must be an array.');

        this.output = 'ansi';
        this.dryRun = false;
        this.command = [];

        let parsingFlags = true;
        for (const arg of argv) {
            if (parsingFlags && arg === '--') {
                parsingFlags = false;
                continue;
            }

            if (parsingFlags && arg === '--json') {
                this.output = 'json';
                continue;
            }

            if (parsingFlags && arg === '--plain') {
                this.output = 'text';
                continue;
            }

            if (parsingFlags && arg === '--ansi') {
                this.output = 'ansi';
                continue;
            }

            if (parsingFlags && (arg === '--dry-run' || arg === '--preview')) {
                this.dryRun = true;
                continue;
            }

            this.command.push(arg);
        }

        Object.freeze(this.command);
        Object.freeze(this);
    }

    get hasCommand() {
        return this.command.length > 0;
    }

    get text() {
        return this.command.join(' ');
    }

    get machineReadable() {
        return this.output === 'json';
    }
}

module.exports = RealCliOptions;
