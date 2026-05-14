const fs = require('fs');
const os = require('os');
const path = require('path');

const REQUIRED_FILES = Object.freeze([
    'External.dll',
    't7dwidm_protect.exe',
]);

/**
 * Ensures the official DVAR bridge runtime exists on real disk.
 *
 * Packaged executables keep assets inside the exe snapshot, but PowerShell must
 * load External.dll and t7dwidm_protect.exe from normal filesystem paths. This
 * module copies the bundled runtime files into AppData when they are missing.
 */
class GameConnectionBridgeRuntime {
    /**
     * @param {string} [patchDir=GameConnectionBridgeRuntime.defaultPatchDir()] Runtime target folder.
     * @returns {string} Ready-to-use runtime folder.
     * @throws {Error} When bundled runtime files cannot be found or written.
     */
    static ensure(patchDir = GameConnectionBridgeRuntime.defaultPatchDir()) {
        const targetDir = path.resolve(String(patchDir || GameConnectionBridgeRuntime.defaultPatchDir()));
        if (GameConnectionBridgeRuntime.#complete(targetDir)) return targetDir;

        const sourceDir = GameConnectionBridgeRuntime.#sourceDirs().find((candidate) => (
            GameConnectionBridgeRuntime.#complete(candidate)
        ));
        if (!sourceDir) {
            throw new Error('Missing bundled official DVAR bridge runtime files. Rebuild BlackOps3ZombiesCli.exe with BridgeRuntime assets.');
        }

        if (path.resolve(sourceDir).toLowerCase() === targetDir.toLowerCase()) return targetDir;

        fs.mkdirSync(targetDir, { recursive: true });
        for (const fileName of REQUIRED_FILES) {
            const bytes = fs.readFileSync(path.join(sourceDir, fileName));
            fs.writeFileSync(path.join(targetDir, fileName), bytes);
        }

        if (!GameConnectionBridgeRuntime.#complete(targetDir)) {
            throw new Error(`Failed to install official DVAR bridge runtime in ${targetDir}.`);
        }

        return targetDir;
    }

    /**
     * @returns {string} Default runtime folder.
     */
    static defaultPatchDir() {
        return process.pkg
            ? path.join(GameConnectionBridgeRuntime.#localAppData(), 'BlackOps3ZombiesCli', 'BridgeRuntime')
            : GameConnectionBridgeRuntime.#bundledSourceDir();
    }

    static #sourceDirs() {
        const dirs = [GameConnectionBridgeRuntime.#bundledSourceDir()];
        if (process.pkg) dirs.push(path.join(path.dirname(process.execPath), 'BridgeRuntime'));
        return dirs;
    }

    static #bundledSourceDir() {
        return path.join(__dirname, '..', 'BridgeRuntime');
    }

    static #complete(dir) {
        return REQUIRED_FILES.every((fileName) => {
            try {
                return fs.statSync(path.join(dir, fileName)).size > 0;
            } catch (error) {
                return false;
            }
        });
    }

    static #localAppData() {
        return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    }
}

module.exports = GameConnectionBridgeRuntime;
