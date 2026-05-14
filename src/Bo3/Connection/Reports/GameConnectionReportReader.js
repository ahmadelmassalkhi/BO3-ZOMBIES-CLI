const DEFAULT_MARKER = '~R:';
const DEFAULT_FIRST_TIMEOUT_MS = 450;
const DEFAULT_QUIET_MS = 140;
const DEFAULT_POLL_MS = 20;

class GameConnectionReportReader {
    /**
     * @param {object} options Report reader dependencies and timing.
     * @param {object} options.statusProbe Probe exposing read().
     * @param {string} [options.marker='~R:'] Report marker in BO3 status text.
     * @param {number} [options.firstTimeoutMs=450] Max wait for the first new report.
     * @param {number} [options.quietMs=140] Quiet window after the newest report.
     * @param {number} [options.pollMs=20] Poll delay.
     */
    constructor(options = {}) {
        if (!options.statusProbe || typeof options.statusProbe.read !== 'function') throw new TypeError('[BO3 REPORT] statusProbe must expose read().');

        this.statusProbe = options.statusProbe;
        this.marker = String(options.marker || process.env.BO3_REPORT_MARKER || DEFAULT_MARKER);
        this.firstTimeoutMs = this.#int(options.firstTimeoutMs ?? process.env.BO3_REPORT_FIRST_TIMEOUT_MS, DEFAULT_FIRST_TIMEOUT_MS);
        this.quietMs = this.#int(options.quietMs ?? process.env.BO3_REPORT_QUIET_MS, DEFAULT_QUIET_MS);
        this.pollMs = this.#int(options.pollMs ?? process.env.BO3_REPORT_POLL_MS, DEFAULT_POLL_MS);
        this.lastId = '';
    }

    /**
     * Marks the currently visible report as already seen.
     *
     * @returns {Promise<void>}
     */
    async prime() {
        const report = this.#report(await this.statusProbe.read({ activeSession: true }));
        if (report) this.lastId = report.id;
    }

    /**
     * Collects reports published after the last seen report id.
     *
     * @returns {Promise<object[]>} New BO3 reports.
     */
    async collect() {
        const reports = [];
        const seen = new Set();
        let deadline = Date.now() + this.firstTimeoutMs;

        while (Date.now() < deadline) {
            const report = this.#report(await this.statusProbe.read({ activeSession: true }));
            if (report && report.id !== this.lastId && !seen.has(report.id)) {
                reports.push(report);
                seen.add(report.id);
                this.lastId = report.id;
                deadline = Date.now() + this.quietMs;
            }

            await GameConnectionReportReader.#delay(this.pollMs);
        }

        return reports;
    }

    #report(status) {
        const payload = this.#payload(status);
        if (!payload) return null;

        const parts = payload.split('|');
        if (parts.length < 4) return null;

        const id = parts[0].trim();
        const command = parts[2].trim();
        const message = parts.slice(3).join('|').replace(/\^[0-9]/g, '').trim();
        if (!id || !command || !message) return null;

        return {
            id,
            status: GameConnectionReportReader.#status(parts[1]),
            command,
            message,
            text: `[${command.toUpperCase()}] ${message}`,
        };
    }

    #payload(status) {
        const info = status && status.info ? status.info : {};
        const texts = [info.name, info.sv_hostname, status && status.raw].map((text) => String(text || ''));

        for (const text of texts) {
            const markerAt = text.lastIndexOf(this.marker);
            if (markerAt !== -1) return text.slice(markerAt + this.marker.length).trim();
        }

        return '';
    }

    #int(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }

    static #status(value) {
        if (value === '0') return 'error';
        if (value === '2') return 'warn';
        return 'ok';
    }

    static #delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = GameConnectionReportReader;
