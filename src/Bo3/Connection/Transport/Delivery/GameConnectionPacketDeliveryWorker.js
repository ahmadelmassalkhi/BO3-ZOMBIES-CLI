function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Long-running FIFO drain loop.
 *
 * It owns worker lifecycle only. Packet format, readiness decisions, DVAR
 * writes, and ACK parsing stay in their own components.
 */
class GameConnectionPacketDeliveryWorker {
    /**
     * @param {object} [options] Delivery dependencies and timing.
     * @param {object} options.packetQueue FIFO queue exposing peek() and acknowledge().
     * @param {object} options.readiness Readiness gate exposing wait().
     * @param {object} options.sender Packet sender exposing send().
     * @param {Function} [options.isRunning] Returns true while connection is running.
     * @param {Function} [options.canSend] Returns true when packets may enter the in-flight slot.
     * @param {number} options.idleDelayMs Delay while queue is empty.
     * @param {number} options.probeIntervalMs Delay after paused/error states.
     */
    constructor(options = {}) {
        this.packetQueue = options.packetQueue;
        this.readiness = options.readiness;
        this.sender = options.sender;
        this.isRunning = options.isRunning || (() => false);
        this.canSend = options.canSend || (() => true);
        this.idleDelayMs = options.idleDelayMs;
        this.probeIntervalMs = options.probeIntervalMs;
        this.running = false;
        this.promise = null;
        this.lastErrorLogAt = 0;
        this.debug = process.env.BO3_CONNECTION_DEBUG === '1';
    }

    /**
     * Starts the worker loop once.
     *
     * @returns {GameConnectionPacketDeliveryWorker} This worker.
     */
    start() {
        if (this.running && this.promise) return this;
        this.running = true;
        if (!this.promise) this.promise = this.#run().finally(() => { this.promise = null; });
        return this;
    }

    /**
     * Stops the worker loop.
     *
     * @returns {Promise<void>|Promise<*>} Current loop promise, when running.
     */
    stop() {
        this.running = false;
        return this.promise || Promise.resolve();
    }

    /**
     * Drains the queue in FIFO order until stopped.
     */
    async #run() {
        while (this.#active()) {
            const packet = this.packetQueue.peek();
            if (!packet) { await sleep(this.idleDelayMs); continue; }

            try {
                if (!this.canSend(packet)) { await sleep(this.idleDelayMs); continue; }
                if (!(await this.readiness.wait())) { await sleep(this.probeIntervalMs); continue; }
                if (typeof this.packetQueue.activate === 'function' && !this.packetQueue.activate(packet)) continue;
                const result = await this.sender.send(packet);
                if (!this.#active()) break;
                if (!this.packetQueue.acknowledge(packet, result)) {
                    throw new Error(`Packet queue lost active packet ${packet.id}.`);
                }
            } catch (error) {
                if (!this.#active()) break;
                this.#logWorkerError(error);
                await sleep(this.probeIntervalMs);
            }
        }
    }

    /**
     * @returns {boolean} True when both worker and connection are running.
     */
    #active() {
        return this.running && this.isRunning();
    }

    /**
     * Logs repeated worker failures at a controlled cadence.
     *
     * @param {*} error Error-like value from readiness or sender.
     */
    #logWorkerError(error) {
        const now = Date.now();
        if (!this.debug) return;
        if (now - this.lastErrorLogAt < 5000) return;
        this.lastErrorLogAt = now;
        const message = error && error.message ? error.message : String(error);
        console.warn('[BO3 CONNECTION] transport worker recovered from error:', message);
    }
}

module.exports = GameConnectionPacketDeliveryWorker;
