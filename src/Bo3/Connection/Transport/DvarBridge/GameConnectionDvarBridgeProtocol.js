/**
 * Text protocol used between Node and the PowerShell DVAR bridge.
 */
class GameConnectionDvarBridgeProtocol {
    /**
     * @param {string} id Request id.
     * @param {{ op: string, name?: string, value?: string }} payload Bridge request payload.
     * @returns {string} Tab-separated bridge request line.
     */
    requestLine(id, payload) {
        if (payload.op === 'ping') return `PING\t${id}`;
        return `SET\t${id}\t${this.#encode(payload.name)}\t${this.#encode(payload.value)}`;
    }

    /**
     * @param {string} line Raw bridge response line.
     * @returns {{ type: string, id?: string, value?: string|boolean, message?: string }} Parsed response.
     * @throws {Error} When response type or encoding is invalid.
     */
    responseFrom(line) {
        const parts = String(line || '').split('\t');
        const type = parts[0];

        if (type === 'READY') return { type };
        if (type === 'FATAL') return { type, message: this.#decode(parts[1]) || 'Official dvar bridge failed.' };
        if (type !== 'OK' && type !== 'ERR') {
            throw new Error(`Unexpected official dvar bridge response: ${String(line || '').trim() || '<empty>'}`);
        }

        return {
            type,
            id: String(parts[1] || ''),
            value: parts[2] || true,
            message: this.#decode(parts[2]) || 'Official dvar write failed.',
        };
    }

    /**
     * @param {*} value Raw value.
     * @returns {string} Base64 UTF-8 encoded value.
     */
    #encode(value) {
        return Buffer.from(String(value ?? ''), 'utf8').toString('base64');
    }

    /**
     * @param {*} value Base64 UTF-8 encoded value.
     * @returns {string} Decoded value.
     * @throws {Error} When field is malformed.
     */
    #decode(value) {
        try {
            return Buffer.from(String(value || ''), 'base64').toString('utf8');
        } catch (error) {
            throw new Error(`Malformed official dvar bridge response field: ${error.message}`);
        }
    }
}

module.exports = GameConnectionDvarBridgeProtocol;
