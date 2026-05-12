const GameCliCommandLoadout = require('./GameCliCommandLoadout');
const GameCliCommandPackAPunch = require('./GameCliCommandPackAPunch');
const GameCliCommandPerk = require('./GameCliCommandPerk');
const GameCliCommandPoints = require('./GameCliCommandPoints');
const GameCliCommandPowerup = require('./GameCliCommandPowerup');
const GameCliCommandPrint = require('./GameCliCommandPrint');
const GameCliCommandRound = require('./GameCliCommandRound');
const GameCliCommandWeapon = require('./GameCliCommandWeapon');
const GameCliCommandZombie = require('./GameCliCommandZombie');

module.exports = () => Object.freeze([
    new GameCliCommandPrint(),
    new GameCliCommandZombie(),
    new GameCliCommandPoints(),
    new GameCliCommandRound(),
    new GameCliCommandPerk(),
    new GameCliCommandWeapon(),
    new GameCliCommandPowerup(),
    new GameCliCommandPackAPunch(),
    new GameCliCommandLoadout(),
]);

