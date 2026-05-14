const readline = require('readline');
const util = require('util');

/**
 * Routes background logs without corrupting the interactive prompt.
 */
class RealCliConsoleRouter {
    /**
     * Sends console logs to stderr for machine-readable one-shot commands.
     */
    static routeLogsToStderr() {
        console.log = (...args) => console.error(...args);
    }

    /**
     * Temporarily reroutes console methods through prompt-safe terminal writes.
     *
     * @param {import('readline').Interface} shell Readline shell.
     * @param {() => boolean} promptReady Whether the prompt is currently visible.
     * @param {() => boolean} shuttingDown Whether the shell is shutting down.
     * @returns {() => void} Function that restores original console methods.
     */
    static routeShellLogs(shell, promptReady, shuttingDown) {
        if (!shell || typeof shell._refreshLine !== 'function') return () => {};
        if (typeof promptReady !== 'function') throw new TypeError('RealCliConsoleRouter.promptReady must be a function.');
        if (typeof shuttingDown !== 'function') throw new TypeError('RealCliConsoleRouter.shuttingDown must be a function.');

        const original = {
            log: console.log,
            warn: console.warn,
            error: console.error,
        };

        const write = (method, args) => {
            if (promptReady()) {
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);
            }

            original[method](util.format(...args));
            if (promptReady() && !shuttingDown()) shell._refreshLine();
        };

        console.log = (...args) => write('log', args);
        console.warn = (...args) => write('warn', args);
        console.error = (...args) => write('error', args);

        return () => {
            console.log = original.log;
            console.warn = original.warn;
            console.error = original.error;
        };
    }
}

module.exports = RealCliConsoleRouter;
