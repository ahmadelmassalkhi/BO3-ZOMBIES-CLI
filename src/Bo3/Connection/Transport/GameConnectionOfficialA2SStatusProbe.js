const dgram = require('dgram');

const FRONTEND_MAPS = new Set(['core_frontend', 'frontend']);
const QUERY = Buffer.concat([
    Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]),
    Buffer.from('Source Engine Query\0', 'ascii'),
]);

/**
 * Reads official BO3 readiness and ACK text through passive A2S_INFO.
 */
class GameConnectionOfficialA2SStatusProbe {
    /**
     * @param {object} [options] UDP status probe options.
     * @param {string} [options.host] BO3 A2S host.
     * @param {number} [options.port] BO3 A2S UDP port.
     * @param {number} [options.timeoutMs] Query timeout.
     */
    constructor(options = {}) {
        this.host = String(options.host || process.env.BO3_OFFICIAL_HOST || '127.0.0.1').trim() || '127.0.0.1';
        this.port = this.#int(options.port ?? process.env.BO3_OFFICIAL_UDP_PORT, 27017);
        this.timeoutMs = this.#int(options.timeoutMs ?? process.env.BO3_OFFICIAL_A2S_TIMEOUT_MS, 1000);
        this.activeSockets = new Set();
        this.lastWarningAt = 0;
        console.log(`[BO3] Status mode: official-a2s (${this.host}:${this.port})`);
    }

    /**
     * Returns the readiness shape consumed by the BO3 connection loop.
     *
     * @param {object} [options] Read options.
     * @param {boolean} [options.activeSession] Whether gameplay was previously active.
     * @returns {Promise<object>} BO3 status and readiness state.
     */
    async read(options = {}) {
        const buffer = await this.#query();
        if (!buffer) return this.#inactive(options, '');

        const info = this.#info(buffer);
        const gameplayReady = this.#gameplayReady(info);
        const state = gameplayReady && (info.players > 0 || options.activeSession) ? 'active' : 'inactive';

        return {
            reachable: true,
            info,
            playerCount: info.players,
            raw: info.raw,
            gameplayReady,
            state,
        };
    }

    /**
     * Cancels all in-flight UDP probes during connection shutdown.
     */
    stop() {
        for (const socket of this.activeSockets) {
            this.#closeSocket(socket, 'stop');
        }
        this.activeSockets.clear();
    }

    /**
     * Performs challenge-aware A2S_INFO without sending BO3 DVAR packets.
     *
     * @returns {Promise<Buffer|null>} A2S response buffer, or null when unreachable.
     */
    #query() {
        return new Promise((resolve) => {
            const socket = dgram.createSocket('udp4');
            let settled = false;
            let challenged = false;
            let timer = null;
            this.activeSockets.add(socket);

            const finish = (value) => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                this.activeSockets.delete(socket);
                this.#closeSocket(socket, 'query finish');
                resolve(value);
            };

            socket.on('message', (message) => {
                const type = message[4];
                if (type === 0x41 && !challenged && message.length >= 9) {
                    challenged = true;
                    socket.send(Buffer.concat([QUERY, message.subarray(5, 9)]), this.port, this.host, (error) => {
                        if (error) {
                            this.#warn('challenge send failed', error);
                            finish(null);
                        }
                    });
                    return;
                }

                finish(type === 0x49 ? message : null);
            });

            socket.once('error', (error) => {
                this.#warn('udp socket error', error);
                finish(null);
            });
            timer = setTimeout(() => finish(null), this.timeoutMs);
            if (timer.unref) timer.unref();

            try {
                socket.bind(() => {
                    if (settled) return;
                    try {
                        socket.send(QUERY, this.port, this.host, (error) => {
                            if (error) {
                                this.#warn('initial send failed', error);
                                finish(null);
                            }
                        });
                    } catch (error) {
                        this.#warn('initial send threw', error);
                        finish(null);
                    }
                });
            } catch (error) {
                this.#warn('udp bind threw', error);
                finish(null);
            }
        });
    }

    /**
     * Extracts stable fields plus raw text for ACK parsing.
     *
     * @param {Buffer} buffer A2S response buffer.
     * @returns {object} Parsed server info.
     */
    #info(buffer) {
        let offset = 6;
        const name = this.#string(buffer, offset); offset = name.next;
        const map = this.#string(buffer, offset); offset = map.next;
        const folder = this.#string(buffer, offset); offset = folder.next;
        const game = this.#string(buffer, offset); offset = game.next;

        offset += 2;
        const players = buffer[offset] || 0;
        const maxPlayers = buffer[offset + 1] || 0;
        const strings = this.#strings(buffer);
        const kv = this.#pairs(strings.join('\\'));

        return {
            name: name.value,
            server_map: map.value,
            folder: folder.value,
            game: game.value,
            players,
            maxPlayers,
            loaded_mod: kv.modName || kv.fs_game || '',
            live_gametype: kv.g_gametype || '',
            raw: strings.join(' | '),
        };
    }

    /**
     * Reads one null-terminated string from the A2S payload.
     *
     * @param {Buffer} buffer A2S response buffer.
     * @param {number} start Start offset.
     * @returns {{ value: string, next: number }} Parsed string and next offset.
     */
    #string(buffer, start) {
        let end = start;
        while (end < buffer.length && buffer[end] !== 0) end += 1;
        return { value: buffer.subarray(start, end).toString('latin1'), next: end + 1 };
    }

    /**
     * Pulls printable strings out so ACK markers remain visible.
     *
     * @param {Buffer} buffer A2S response buffer.
     * @returns {string[]} Printable strings.
     */
    #strings(buffer) {
        return buffer.toString('latin1').match(/[\x20-\x7e]{2,}/g) || [];
    }

    /**
     * Parses backslash key/value fragments embedded in BO3 server info.
     *
     * @param {string} text Raw key/value text.
     * @returns {object} Parsed key/value map.
     */
    #pairs(text) {
        const info = {};
        const tokens = String(text || '').split('\\').filter(Boolean);
        for (let index = 0; index + 1 < tokens.length; index += 2) info[tokens[index]] = tokens[index + 1];
        return info;
    }

    /**
     * @param {object} info Parsed server info.
     * @returns {boolean} True when BO3 is in gameplay rather than frontend/menu.
     */
    #gameplayReady(info) {
        const map = String(info.server_map || '').trim().toLowerCase();
        const type = String(info.live_gametype || '').trim().toLowerCase();
        return Boolean(map) && !FRONTEND_MAPS.has(map) && type !== 'frontend';
    }

    /**
     * @param {object} options Read options.
     * @param {string} raw Raw status text.
     * @returns {object} Inactive status result.
     */
    #inactive(options, raw) {
        return {
            reachable: false,
            info: null,
            playerCount: 0,
            raw,
            gameplayReady: false,
            state: options.activeSession ? 'paused' : 'inactive',
        };
    }

    /**
     * @param {*} value Raw integer-like value.
     * @param {number} fallback Fallback when value is invalid.
     * @returns {number} Non-negative integer.
     */
    #int(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    }

    /**
     * @param {object} socket UDP socket to close.
     * @param {string} operation Operation label for warnings.
     */
    #closeSocket(socket, operation) {
        try {
            socket.close();
        } catch (error) {
            this.#warn(`socket close failed during ${operation}`, error);
        }
    }

    /**
     * @param {string} operation Operation that failed.
     * @param {*} error Error-like value.
     */
    #warn(operation, error) {
        const now = Date.now();
        if (now - this.lastWarningAt < 5000) return;
        this.lastWarningAt = now;
        console.warn(`[BO3 A2S STATUS] ${operation}: ${error && error.message ? error.message : error}`);
    }
}

module.exports = GameConnectionOfficialA2SStatusProbe;
