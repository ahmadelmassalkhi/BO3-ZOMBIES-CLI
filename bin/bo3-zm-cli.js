#!/usr/bin/env node

const RealCli = require('../src/RealCli/RealCli');

const cli = new RealCli();

cli.run(process.argv.slice(2))
    .then((exitCode) => process.exit(exitCode))
    .catch((error) => {
        console.error(error && error.message ? error.message : String(error));
        process.exit(1);
    });

