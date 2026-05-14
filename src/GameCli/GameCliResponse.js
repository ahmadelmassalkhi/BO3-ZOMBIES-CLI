/**
 * Stable response returned by GameCli.
 *
 * This is the machine-safe contract. Human coloring and JSON/text output are
 * handled by the real CLI wrapper, not by the command engine.
 */
class GameCliResponse {
    /**
     * @param {'sent'|'queued'|'query'|'preview'|'help'|'notice'|'cleared'|'shown'|'canceled'|'error'} status Response status.
     * @param {string} text Plain response text.
     * @param {string[][]} records BO3 records sent for this command.
     * @param {*} data Optional machine-readable result.
     * @param {object|null} error Optional machine-readable error.
     */
    constructor(status, text, records = [], data = null, error = null) {
        if (!['sent', 'queued', 'query', 'preview', 'help', 'notice', 'cleared', 'shown', 'canceled', 'error'].includes(status)) throw new TypeError('GameCliResponse.status is invalid.');
        if (typeof text !== 'string') throw new TypeError('GameCliResponse.text must be a string.');
        if (!Array.isArray(records)) throw new TypeError('GameCliResponse.records must be an array.');

        this.status = status;
        this.ok = status !== 'error';
        this.text = text;
        this.records = Object.freeze(records.map((record) => Object.freeze([...record])));
        this.data = data;
        this.error = error;
        Object.freeze(this);
    }

    /**
     * @param {string} text Plain response text.
     * @param {object} [options] Response details.
     * @returns {GameCliResponse} Success response.
     */
    static success(text, options = {}) {
        const data = Object.prototype.hasOwnProperty.call(options, 'data') ? options.data : null;
        return new GameCliResponse(options.status || 'sent', text, options.records || [], data);
    }

    /**
     * @param {number} recordCount Number of sent BO3 records.
     * @param {string[][]} records Sent BO3 records.
     * @param {*} data Send result.
     * @returns {GameCliResponse} Sent response.
     */
    static sent(recordCount, records, data) {
        const reports = data && Array.isArray(data.reports) ? data.reports : [];
        const text = reports.length
            ? reports.map((report) => GameCliResponse.#reportText(report)).join('\n')
            : '';

        return new GameCliResponse('sent', text, records, data);
    }

    /**
     * @param {number} recordCount Number of queued BO3 records.
     * @param {string[][]} records Queued BO3 records.
     * @param {*} data Queue result.
     * @returns {GameCliResponse} Queued response.
     */
    static queued(recordCount, records, data) {
        return new GameCliResponse('queued', GameCliResponse.#queuedText(data), records, data);
    }

    /**
     * @param {string} text Query response text.
     * @param {*} data Query data.
     * @returns {GameCliResponse} Query response.
     */
    static query(text, data) {
        return new GameCliResponse('query', text, [], data);
    }

    /**
     * @param {number} recordCount Number of previewed BO3 records.
     * @param {string[][]} records Previewed BO3 records.
     * @returns {GameCliResponse} Preview response.
     */
    static preview(recordCount, records) {
        return new GameCliResponse('preview', `previewed ${recordCount} BO3 record(s).`, records);
    }

    /**
     * @param {string} text Help text.
     * @returns {GameCliResponse} Help response.
     */
    static help(text) {
        return new GameCliResponse('help', text);
    }

    /**
     * @param {object} notice User-facing asynchronous notice.
     * @returns {GameCliResponse} Notice response.
     */
    static notice(notice) {
        return new GameCliResponse('notice', GameCliResponse.#noticeText(notice), [], notice || null);
    }

    /**
     * @param {object} result Cache clear result.
     * @returns {GameCliResponse} Cache clear response.
     */
    static cacheCleared(result) {
        return new GameCliResponse('cleared', GameCliResponse.#cacheClearedText(result), [], result || null);
    }

    /**
     * @param {object} result Cache snapshot.
     * @returns {GameCliResponse} Cache show response.
     */
    static cacheShown(result) {
        return new GameCliResponse('shown', GameCliResponse.#cacheShownText(result), [], result || null);
    }

    /**
     * @param {string} [text='canceled current command.'] Cancellation text.
     * @returns {GameCliResponse} Canceled response.
     */
    static canceled(text = 'canceled current command.') {
        return new GameCliResponse('canceled', text);
    }

    /**
     * @param {*} error Error-like value.
     * @returns {GameCliResponse} Failure response.
     */
    static failure(error) {
        const text = error && error.message ? error.message : String(error);
        return new GameCliResponse('error', text, [], null, {
            name: error && error.name ? error.name : 'Error',
            message: text,
        });
    }

    /**
     * @returns {object} JSON-safe response shape for process integrations.
     */
    toJSON() {
        return {
            ok: this.ok,
            status: this.status,
            text: this.text,
            records: this.records,
            data: this.data,
            error: this.error,
        };
    }

    static #reportText(report) {
        const status = report.status && report.status !== 'ok' ? ` [${String(report.status).toUpperCase()}]` : '';
        const command = report.command ? ` [${String(report.command).toUpperCase()}]` : '';
        const message = report.message ? String(report.message) : '';
        return `[BO3 REPORT]${status}${command} ${message}`.trim();
    }

    static #queuedText(data) {
        return `[BO3 NOTICE] ${GameCliResponse.#waitText(data)}; added { ${GameCliResponse.#addedList(data)} } to cache.`;
    }

    static #noticeText(notice) {
        if (!notice || !notice.type) return '';

        if (notice.type === 'reports') {
            return Array.isArray(notice.reports)
                ? notice.reports.map((report) => GameCliResponse.#reportText(report)).join('\n')
                : '';
        }

        if (notice.type === 'cachedFlush') {
            const map = notice.map ? ` on map ${notice.map}` : '';
            const requests = Array.isArray(notice.requests) ? notice.requests : [];
            const prefix = notice.gameplayRecovered ? `live gameplay detected${map}` : 'ACK received';
            return `[BO3 NOTICE] ${prefix}; sending cache { ${requests.join(', ')} }`;
        }

        if (notice.type === 'commandQueued') {
            return `[BO3 NOTICE] CLI busy; added { ${GameCliResponse.#addedList(notice)} } to cache.`;
        }

        if (notice.type === 'cachedError') {
            return `[BO3 NOTICE] cache failed: ${notice.message || '<unknown>'}`;
        }

        if (notice.type === 'queryResult') {
            return GameCliResponse.#queryText(notice.result);
        }

        return '';
    }

    static #cacheClearedText(result) {
        const requests = result && Array.isArray(result.requests) ? result.requests : [];
        const activeRequests = result && Array.isArray(result.activeRequests) ? result.activeRequests : [];
        if (!requests.length) return activeRequests.length
            ? `[BO3 NOTICE] no pending cache cleared; active { ${activeRequests.join(', ')} }`
            : '[BO3 NOTICE] cache empty.';

        const label = result && result.mode === 'last' ? 'cleared last pending cache item.' : 'cleared pending cache.';
        return activeRequests.length ? `[BO3 NOTICE] ${label} active { ${activeRequests.join(', ')} }` : `[BO3 NOTICE] ${label}`;
    }

    static #cacheShownText(result) {
        const requests = result && Array.isArray(result.requests) ? result.requests : [];
        const activeRequests = result && Array.isArray(result.activeRequests) ? result.activeRequests : [];
        if (!requests.length && !activeRequests.length) return '[BO3 NOTICE] cache empty.';

        const items = activeRequests.concat(requests).map((request, index, all) => {
            const comma = index + 1 < all.length ? ',' : '';
            return `  ${request}${comma}`;
        });
        return ['[BO3 NOTICE] cache:', '{', ...items, '}'].join('\n');
    }

    static #addedList(data) {
        const requests = data && Array.isArray(data.addedRequests) ? data.addedRequests : [];
        return requests.join(', ');
    }

    static #requestList(data) {
        const activeRequests = data && Array.isArray(data.activeRequests) ? data.activeRequests : [];
        const requests = data && Array.isArray(data.requests) ? data.requests : [];
        return activeRequests.concat(requests).join(', ');
    }

    static #waitText(data) {
        if (!data) return 'waiting';
        if (data.reason === 'busy') return data.detail || 'waiting for current command';
        if (data.reason === 'paused') return data.map ? `paused on map ${data.map}` : 'paused';
        if (data.reason === 'inactive') return 'waiting for live gameplay';
        return data.detail || 'waiting';
    }

    static #queryText(result) {
        const queryName = `${result.target}${result.filter ? ` ${result.filter}` : ''}`;
        const mapName = result.map ? ` on map ${result.map}` : '';
        const title = `[BO3 ZM CLI] ${queryName}${mapName}:`;
        const items = Array.isArray(result.items) && result.items.length ? result.items.join(', ') : '<empty>';
        return `${title}\n{ ${items} }`;
    }
}

module.exports = GameCliResponse;
