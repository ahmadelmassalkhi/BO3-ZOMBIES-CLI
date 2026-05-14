const Bo3Event = require('./Bo3Event');

const TOKENS = Object.freeze({
    RANDOM: 'random',
});

/**
 * Gives a BO3 powerup.
 */
class Bo3EventPowerup extends Bo3Event {
    /**
     * @param {import('../Bo3')} bo3 BO3 runtime.
     * @param {string} [powerupName=TOKENS.RANDOM] Powerup token/name.
     */
    constructor(bo3, powerupName = TOKENS.RANDOM) {
        super(bo3, 'powerup', [Bo3EventPowerup.#powerup(powerupName)]);
        Object.freeze(this);
    }

    static get tokens() { return TOKENS; }

    static #powerup(powerupName) {
        const token = Bo3Event.cleanToken(powerupName ?? TOKENS.RANDOM);
        if (!token) return TOKENS.RANDOM;
        if (/\s/.test(token) || token !== token.toLowerCase()) {
            throw new TypeError('powerup.name must be one lowercase canonical token. Use get powerups.');
        }

        return token;
    }
}

module.exports = Bo3EventPowerup;

