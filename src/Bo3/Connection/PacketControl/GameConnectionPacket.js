/**
 * One immutable BO3 connection packet.
 *
 * Owns the exact ACK id, human-readable payload text, and wire text sent
 * through the DVAR bridge.
 */
class GameConnectionPacket {
    /**
     * @param {string} id Exact ACK id for this packet.
     * @param {string} payload Packet payload without the id prefix.
     */
    constructor(id, payload) {
        this.id = String(id || '');
        this.payload = String(payload || '');
        this.wire = `${this.id}|${this.payload}`;
        Object.freeze(this);
    }

    /**
     * @param {string} ack ACK token read from BO3 status.
     * @returns {boolean} True when the ACK exactly matches this packet.
     */
    acknowledgedBy(ack) {
        return ack === this.id;
    }

    /**
     * @returns {{ accepted: true, packetId: string, payload: string, packet: string }} ACK result.
     */
    accepted() {
        return { accepted: true, packetId: this.id, payload: this.payload, packet: this.wire };
    }
}

module.exports = GameConnectionPacket;
