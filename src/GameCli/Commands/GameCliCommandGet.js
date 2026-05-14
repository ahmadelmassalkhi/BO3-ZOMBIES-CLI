const GameCliCommand = require('./GameCliCommand');

const TARGETS = new Map([
    ['weapon', 'weapons'],
    ['weapons', 'weapons'],
    ['perk', 'perks'],
    ['perks', 'perks'],
    ['powerup', 'powerups'],
    ['powerups', 'powerups'],
]);

class GameCliCommandGet extends GameCliCommand {
    constructor() {
        super('get', 'get <weapons|perks|powerups> [wonderweapons]', 'Reads live map data.');
    }

    get(args) {
        if (!Array.isArray(args)) throw new TypeError('get.args must be an array.');

        const target = TARGETS.get(String(args[0] || '').toLowerCase());
        if (!target) throw new TypeError('get target must be weapons, perks, or powerups.');

        const filter = GameCliCommandGet.#filter(target, args.slice(1));
        return { target, filter };
    }

    events() {
        throw new TypeError('get is a query command and does not create BO3 records.');
    }

    static #filter(target, args) {
        if (!args.length) return '';
        const filter = args.join('_').toLowerCase();

        if (target !== 'weapons') throw new TypeError(`get ${target} does not accept a filter.`);
        if (['wonder', 'wonderweapon', 'wonderweapons'].includes(filter)) return 'wonderweapons';

        throw new TypeError('get weapons filter must be wonderweapons.');
    }
}

module.exports = GameCliCommandGet;
