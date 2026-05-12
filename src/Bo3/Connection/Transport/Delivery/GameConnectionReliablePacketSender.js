function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends exactly one packet until BO3 publishes that packet's exact ACK.
 */
class GameConnectionReliablePacketSender {
    /**
     * @param {object} [options] Packet sending dependencies and timing.
     * @param {object} options.packetWriter Writer exposing write().
     * @param {object} [options.commandWriter] Backward-compatible alias for packetWriter.
     * @param {object} options.statusProbe Status probe exposing read().
     * @param {object} options.packetProtocol Packet protocol exposing packetDvar and ackFrom().
     * @param {object} options.readiness Readiness gate exposing check().
     * @param {Function} [options.isRunning] Returns true while connection is running.
     * @param {number} options.probeIntervalMs Delay between readiness probes.
     * @param {number} options.settleMs Delay after gameplay recovers.
     * @param {number} options.repeatCount DVAR write repeats per packet attempt.
     * @param {number} options.repeatDelayMs Delay between repeated writes.
     * @param {number} options.edgeDelayMs Delay after clearing DVAR before retry.
     * @param {number} options.ackPollMs Delay between ACK polls.
     * @param {number} options.ackResendMs Delay before resending current packet.
     */
    constructor(options = {}) {
        this.packetWriter = options.packetWriter || options.commandWriter;
        this.statusProbe = options.statusProbe;
        this.packetProtocol = options.packetProtocol;
        this.readiness = options.readiness;
        this.isRunning = options.isRunning || (() => false);
        this.probeIntervalMs = options.probeIntervalMs;
        this.settleMs = options.settleMs;
        this.repeatCount = options.repeatCount;
        this.repeatDelayMs = options.repeatDelayMs;
        this.edgeDelayMs = options.edgeDelayMs;
        this.ackPollMs = options.ackPollMs;
        this.ackResendMs = options.ackResendMs;
        this.lastAckErrorLogAt = 0;
    }

    /**
     * Sends one packet until its exact ACK is observed.
     *
     * @param {import('../../PacketControl/GameConnectionPacket')} packet Packet to send.
     * @returns {Promise<object>} Packet ACK result.
     * @throws {TypeError} When packet shape is invalid.
     * @throws {Error} When connection stops before ACK.
     */
    async send(packet) {
        this.#validatePacket(packet);
        console.log(`[BO3 CONNECTION] payload transmitting : "${packet.payload}"`);

        let firstSendAt = 0;
        let lastSendAt = 0;
        let lastStatusAt = 0;
        let lastAckLogAt = 0;
        let sent = false;

        while (this.isRunning()) {
            if (sent && packet.acknowledgedBy(await this.#ack())) return packet.accepted();

            const now = Date.now();
            if (!sent || now - lastStatusAt >= this.probeIntervalMs) {
                const status = await this.readiness.check();
                lastStatusAt = Date.now();
                if (status.state !== 'active') { await sleep(this.probeIntervalMs); continue; }
                if (status.needsSettle) await sleep(this.settleMs);
            }

            if (!sent || now - lastSendAt >= this.ackResendMs) {
                if (!sent) firstSendAt = Date.now();
                await this.#writePacket(packet, sent);
                sent = true;
                lastSendAt = Date.now();
            }

            if (packet.acknowledgedBy(await this.#ack())) return packet.accepted();
            lastAckLogAt = this.#logAckWait(packet.id, firstSendAt, lastAckLogAt);
            await sleep(this.ackPollMs);
        }

        throw new Error('BO3 connection stopped before queued packets were acknowledged.');
    }

    /**
     * @param {*} packet Packet-like value to validate.
     * @throws {TypeError} When packet shape is invalid.
     */
    #validatePacket(packet) {
        if (!packet || !packet.id || !packet.wire || typeof packet.acknowledgedBy !== 'function' || typeof packet.accepted !== 'function') {
            throw new TypeError('[BO3 CONNECTION] Reliable packet sender received an invalid packet.');
        }
    }

    /**
     * Writes packet wire text to the configured DVAR.
     *
     * @param {import('../../PacketControl/GameConnectionPacket')} packet Packet to write.
     * @param {boolean} forceEdge Whether to clear the DVAR first for retry edge detection.
     */
    async #writePacket(packet, forceEdge) {
        if (forceEdge) {
            await this.packetWriter.write(this.packetProtocol.packetDvar, '');
            if (this.edgeDelayMs > 0) await sleep(this.edgeDelayMs);
        }

        for (let attempt = 1; attempt <= this.repeatCount; attempt += 1) {
            await this.packetWriter.write(this.packetProtocol.packetDvar, packet.wire);
            if (attempt < this.repeatCount && this.repeatDelayMs > 0) await sleep(this.repeatDelayMs);
        }
    }

    /**
     * Reads ACK text best-effort; packet retry/re-read is the recovery path.
     *
     * @returns {Promise<string>} ACK token, or empty string when absent/unreadable.
     */
    async #ack() {
        try {
            return this.packetProtocol.ackFrom(await this.statusProbe.read());
        } catch (error) {
            this.#logAckReadError(error);
            return '';
        }
    }

    /**
     * Logs long ACK waits at a controlled cadence.
     *
     * @param {string} packetId Packet id being waited on.
     * @param {number} firstSendAt First send timestamp.
     * @param {number} lastLogAt Previous log timestamp.
     * @returns {number} Updated last log timestamp.
     */
    #logAckWait(packetId, firstSendAt, lastLogAt) {
        const now = Date.now();
        const waitMs = now - firstSendAt;
        if (waitMs < 5000 || now - lastLogAt < 5000) return lastLogAt;
        console.log(`[BO3 CONNECTION] waiting for ACK ${packetId}; retrying current packet (${waitMs}ms).`);
        return now;
    }

    /**
     * Logs ACK probe failures at a controlled cadence.
     *
     * @param {*} error Error-like value.
     */
    #logAckReadError(error) {
        const now = Date.now();
        if (now - this.lastAckErrorLogAt < 5000) return;
        this.lastAckErrorLogAt = now;
        const message = error && error.message ? error.message : String(error);
        console.warn('[BO3 CONNECTION] ACK probe read failed; retry owns recovery:', message);
    }
}

module.exports = GameConnectionReliablePacketSender;
