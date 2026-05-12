const GameConnectionPacket = require('./GameConnectionPacket');
const GameConnectionPayload = require('./GameConnectionPayload');

const DEFAULT_DVAR = 'stoe_packet';
const DEFAULT_MARKER = ' STOE_ACK:';

/**
 * BO3 packet protocol.
 *
 * Creates outbound packets from command payloads and extracts exact ACK ids
 * from BO3 server status text.
 */
class GameConnectionPacketProtocol {
    #ackMarker;
    #sequence;

    /**
     * @param {{ packetDvar?: string, ackMarker?: string }} [options] Protocol text options.
     */
    constructor(options = {}) {
        this.packetDvar = this.#text(options.packetDvar ?? process.env.BO3_PACKET_DVAR, DEFAULT_DVAR);
        this.#ackMarker = String(options.ackMarker ?? process.env.BO3_ACK_MARKER ?? DEFAULT_MARKER);
        this.#sequence = 0;
    }

    /**
     * @param {string|Array<unknown>|GameConnectionPayload|object} payload Payload accepted by GameConnectionPayload.
     * @returns {GameConnectionPacket[]} Packets ready for FIFO delivery.
     */
    createMany(payload) {
        const normalized = payload instanceof GameConnectionPayload ? payload : new GameConnectionPayload(payload);
        return normalized.chunks().map((chunk) => {
            this.#sequence += 1;
            return new GameConnectionPacket(this.#id(), chunk);
        });
    }

    /**
     * @param {{ reachable?: boolean, raw?: string, info?: object }} [status] Status read from the BO3 probe.
     * @returns {string} Exact ACK token, or empty string when no ACK is present.
     */
    ackFrom(status = {}) {
        // ACKs are published through server info text, so strip BO3 color codes before matching.
        const info = status.reachable && status.info ? status.info : {};
        const text = String(status.raw || info.sv_hostname || info.name || '');
        const markerAt = text.lastIndexOf(this.#ackMarker);
        if (markerAt === -1) return '';

        const ack = text.slice(markerAt + this.#ackMarker.length).replace(/\^[0-9]/g, '').trim();
        const token = ack.match(/^[^\s|\\]+/);
        return token ? token[0] : '';
    }

    #id() {
        // Time + process + sequence is compact, ordered enough for logs, and collision-resistant here.
        return [Date.now().toString(36), process.pid.toString(36), this.#sequence.toString(36)].join('-');
    }

    /**
     * @param {unknown} value Raw text value.
     * @param {string} fallback Fallback when value is empty.
     * @returns {string} Non-empty text.
     */
    #text(value, fallback) {
        return String(value || '').trim() || fallback;
    }
}

module.exports = GameConnectionPacketProtocol;
