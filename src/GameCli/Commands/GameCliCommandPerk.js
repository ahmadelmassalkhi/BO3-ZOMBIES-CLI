const Bo3EventPerk = require('../../Bo3/Bo3Events/Bo3EventPerk');
const GameCliCommand = require('./GameCliCommand');

class GameCliCommandPerk extends GameCliCommand {
    constructor() {
        super('perk', [
            'perk',
            'perk give',
            'perk give <perk>',
            'perk take',
            'perk take <perk>',
        ], 'Gives or takes perks.', [
            'Use get perks to list valid perk names.',
            'perk defaults to perk give.',
            'perk give defaults to random.',
            'perk take defaults to last.',
        ]);
    }

    events(bo3, args) {
        if (args.length > 2) throw this.usageError('perk usage: perk [give|take] [perk].');
        const action = args.length ? GameCliCommandPerk.#action(args[0]) : Bo3EventPerk.actions.GIVE;
        if (!action) throw this.usageError('perk.action must be give or take.');

        const perkArgs = args.length ? args.slice(1) : [];
        const cleanAction = action;
        const fallback = cleanAction === Bo3EventPerk.actions.TAKE ? 'last' : 'random';
        const perk = perkArgs[0] ? this.canonicalToken(perkArgs[0], 'perk.name') : fallback;
        return [new Bo3EventPerk(bo3, cleanAction, perk)];
    }

    static #action(value) {
        const action = String(value || '').toLowerCase();
        if (action === 'give' || action === 'take') return action;
        return undefined;
    }
}

module.exports = GameCliCommandPerk;

