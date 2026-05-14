/**
 * FIFO packet queue.
 *
 * Owns ACK promises and preserves delivery order. It never writes packets and
 * never interprets ACK text.
 */
class GameConnectionPacketQueue {
    constructor() {
        this.queue = [];
    }

    /**
     * @returns {number} Number of queued packets.
     */
    get length() {
        return this.queue.length;
    }

    /**
     * @returns {boolean} True when the front packet is already being delivered.
     */
    get hasActive() {
        return Boolean(this.queue[0] && this.queue[0].active);
    }

    /**
     * Adds one packet and exposes its eventual ACK/reject promise.
     *
     * @param {import('./GameConnectionPacket')} packet Packet to enqueue.
     * @returns {Promise<object>} Resolves when the packet is ACKed.
     */
    enqueue(packet) {
        return new Promise((resolve, reject) => {
            this.queue.push({ packet, resolve, reject, active: false });
        });
    }

    /**
     * Reads the active packet without removing it.
     *
     * @returns {import('./GameConnectionPacket')|null} Active packet, or null when empty.
     */
    peek() {
        const entry = this.queue[0];
        return entry ? entry.packet : null;
    }

    /**
     * Marks the active packet as in-flight.
     *
     * @param {import('./GameConnectionPacket')} packet Packet now being delivered.
     * @returns {boolean} True when the packet is still queued and now active.
     */
    activate(packet) {
        const entry = this.queue[0];
        if (!entry || entry.packet !== packet) return false;

        entry.active = true;
        return true;
    }

    /**
     * ACKs only the active packet the sender just completed.
     *
     * @param {import('./GameConnectionPacket')} packet Packet that was ACKed.
     * @param {object} result ACK result.
     * @returns {boolean} True when the active packet was acknowledged.
     */
    acknowledge(packet, result) {
        const entry = this.queue[0];
        if (!entry || entry.packet !== packet) return false;

        this.queue.shift();
        entry.resolve(result);
        return true;
    }

    /**
     * Rejects pending packets when the connection is intentionally stopped.
     *
     * @param {Error} [error] Rejection reason for queued packets.
     */
    rejectAll(error = new Error('Packet queue stopped before queued packets were delivered.')) {
        while (this.queue.length) this.queue.shift().reject(error);
    }

    /**
     * Rejects cached packets while preserving the active in-flight packet.
     *
     * @param {Error} [error] Rejection reason for cleared packets.
     * @returns {import('./GameConnectionPacket')[]} Cleared packets.
     */
    clearCached(error = new Error('Cached BO3 commands cleared.'), shouldClear = () => true) {
        const kept = [];
        const cleared = [];

        for (const entry of this.queue) {
            if (entry.active || !shouldClear(entry.packet)) {
                kept.push(entry);
            } else {
                cleared.push(entry.packet);
                entry.reject(error);
            }
        }

        this.queue = kept;
        return cleared;
    }
}

module.exports = GameConnectionPacketQueue;
