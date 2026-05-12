function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tracks whether gameplay is safe enough for packet delivery.
 *
 * Owns only readiness state. It does not know packet format, packet writing,
 * ACK parsing, or command semantics.
 */
class GameConnectionReadinessGate {
    /**
     * @param {object} [options] Readiness dependencies and timing.
     * @param {object} options.probe Status probe exposing read().
     * @param {Function} [options.isRunning] Returns true while connection is running.
     * @param {Function} [options.getQueueLength] Returns queued packet count for logs.
     * @param {number} [options.probeIntervalMs] Delay between inactive probes.
     * @param {number} [options.recoverySettleMs] Delay after gameplay recovers.
     * @param {number} [options.readyConfirmationsRequired] Consecutive active probes required.
     * @param {number} [options.readyConfirmationIntervalMs] Delay between confirmation probes.
     */
    constructor(options = {}) {
        this.probe = options.probe;
        this.isRunning = options.isRunning || (() => false);
        this.getQueueLength = options.getQueueLength || (() => 0);
        this.probeIntervalMs = this.#int(options.probeIntervalMs, 1000);
        this.settleMs = this.#int(options.recoverySettleMs, 250);
        this.confirmations = Math.max(1, this.#int(options.readyConfirmationsRequired, 3));
        this.confirmDelayMs = this.#int(options.readyConfirmationIntervalMs, 500);
        this.active = false;
        this.interrupted = false;
        this.settleUntil = Date.now() + this.settleMs;
    }

    /**
     * Resets local readiness state during connection shutdown.
     */
    stop() {
        this.active = false;
        this.interrupted = false;
        this.settleUntil = Date.now() + this.settleMs;
    }

    /**
     * Blocks until gameplay is confirmed active again.
     *
     * @returns {Promise<boolean>} True when active, false when connection stopped.
     */
    async wait() {
        while (this.isRunning()) {
            const status = await this.probe.read({ gameplay: true, activeSession: this.active });
            if (status.state === 'active' && (this.active || (await this.#confirm()))) {
                this.#recover();
                return true;
            }

            this.#interrupt();
            await sleep(this.probeIntervalMs);
        }

        return false;
    }

    /**
     * Reads readiness once while a packet is waiting for ACK.
     *
     * @returns {Promise<{ state: string, needsSettle: boolean }>} Current readiness result.
     */
    async check() {
        const status = await this.probe.read({ gameplay: true, activeSession: this.active });
        return status.state === 'active' && (this.active || (await this.#confirm()))
            ? this.#recover()
            : this.#interrupt();
    }

    /**
     * Requires consecutive active probes before recovering from interruption.
     *
     * @returns {Promise<boolean>} True when all confirmation probes are active.
     */
    async #confirm() {
        for (let attempt = 0; attempt < this.confirmations; attempt += 1) {
            const status = await this.probe.read({ gameplay: true, activeSession: this.active });
            if (status.state !== 'active') return false;
            if (attempt + 1 < this.confirmations) await sleep(this.confirmDelayMs);
        }

        return true;
    }

    /**
     * Pauses packet attempts and logs the transition once.
     *
     * @returns {{ state: 'paused', needsSettle: true }} Paused readiness state.
     */
    #interrupt() {
        this.active = false;
        this.settleUntil = Date.now() + this.settleMs;

        if (!this.interrupted) {
            console.log(`[BO3 CONNECTION] BO3 interrupted; holding ${this.getQueueLength()} queued packet(s) until gameplay is active again.`);
            this.interrupted = true;
        }

        return { state: 'paused', needsSettle: true };
    }

    /**
     * Marks gameplay active and adds a short settle window after recovery.
     *
     * @returns {{ state: 'active', needsSettle: boolean }} Active readiness state.
     */
    #recover() {
        const needsSettle = !this.active || this.interrupted;
        this.active = true;

        if (this.interrupted && this.getQueueLength()) {
            console.log(`[BO3 CONNECTION] BO3 recovered; flushing ${this.getQueueLength()} queued packet(s).`);
        }

        this.interrupted = false;
        if (needsSettle) this.settleUntil = Date.now() + this.settleMs;
        return { state: 'active', needsSettle: Date.now() < this.settleUntil };
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
}

module.exports = GameConnectionReadinessGate;
