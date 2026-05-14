const GameCliCommandPackAPunch = require('./GameCliCommandPackAPunch');
const GameCliCommandGet = require('./GameCliCommandGet');
const GameCliCommandPerk = require('./GameCliCommandPerk');
const GameCliCommandPoints = require('./GameCliCommandPoints');
const GameCliCommandPowerup = require('./GameCliCommandPowerup');
const GameCliCommandPrint = require('./GameCliCommandPrint');
const GameCliCommandRound = require('./GameCliCommandRound');
const GameCliCommandWeapon = require('./GameCliCommandWeapon');
const GameCliCommandZombie = require('./GameCliCommandZombie');

module.exports = () => Object.freeze([
    new GameCliCommandGet(),
    new GameCliCommandPrint(),
    new GameCliCommandZombie(),
    new GameCliCommandPoints(),
    new GameCliCommandRound(),
    new GameCliCommandPerk(),
    new GameCliCommandWeapon(),
    new GameCliCommandPowerup(),
    new GameCliCommandPackAPunch(),
]);
