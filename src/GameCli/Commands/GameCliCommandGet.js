const GameCliCommand = require('./GameCliCommand');

class GameCliCommandGet extends GameCliCommand {
    constructor() {
        super('get', [
            'get weapons',
            'get weapons wonderweapons',
            'get perks',
            'get powerups',
        ], 'Reads live map data.', [
            'Results are read from the active map.',
            'get weapons wonderweapons filters weapons to wonder weapons.',
        ]);
    }

    get(args) {
        if (!Array.isArray(args)) throw new TypeError('get.args must be an array.');

        const target = String(args[0] || '').toLowerCase();
        if (!['weapons', 'perks', 'powerups'].includes(target)) throw this.usageError('get target must be weapons, perks, or powerups.');

        const filter = GameCliCommandGet.#filter(target, args.slice(1));
        return { target, filter };
    }

    events() {
        throw new TypeError('get is a query command and does not create BO3 records.');
    }

    static #filter(target, args) {
        if (!args.length) return '';
        if (args.length > 1) throw new TypeError('get usage: get <weapons|perks|powerups> [wonderweapons]. Run: get help.');

        const filter = args[0].toLowerCase();
        if (target !== 'weapons') throw new TypeError(`get ${target} does not accept a filter. Run: get help.`);
        if (filter === 'wonderweapons') return 'wonderweapons';

        throw new TypeError('get weapons filter must be wonderweapons. Run: get help.');
    }
}

module.exports = GameCliCommandGet;
