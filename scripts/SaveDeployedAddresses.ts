import fs from 'fs';
import { promisify } from 'es6-promisify';
import contracts from './Artifacts';
import deployed from '../migrations/deployed.json';

const writeFileAsync = promisify(fs.writeFile);
const truffleConfig = require('../truffle.js');
const helpers = require('../migrations/helpers.js');

const NETWORK_IDS = Object.keys(truffleConfig.networks).reduce<string[]>((acc, networkName) => {
  if (!helpers.isDevNetwork(networkName)) {
    acc.push(truffleConfig.networks[networkName].network_id);
  }
  return acc;
}, []);

async function run() {
  Object.keys(contracts).forEach((contractName) => {
    const contract = contracts[contractName];

    NETWORK_IDS.forEach((networkId) => {
      if (contract.networks[networkId]) {
        deployed[contractName] = deployed[contractName] || {};

        deployed[contractName][networkId] = {
          links: contract.networks[networkId].links,
          address: contract.networks[networkId].address,
          transactionHash: contract.networks[networkId].transactionHash,
        };
      }
    });
  });

  const json = JSON.stringify(deployed, null, 4).concat('\n');

  const directory = `${__dirname}/../migrations/`;
  const filename = 'deployed.json';
  await writeFileAsync(directory + filename, json);
  console.log(`Wrote ${filename}`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));
