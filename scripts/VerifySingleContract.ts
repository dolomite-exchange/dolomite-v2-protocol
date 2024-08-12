import { execSync } from 'child_process';
import { promisify } from 'es6-promisify';
import fs from 'fs';
import { contractName } from '../build/contracts/LiquidatorProxyV4WithGenericTrader.json';
import { DolomiteMargin } from '../src';
import deployed from '../migrations/deployed.json';

const truffle = require('../truffle');

const writeFileAsync = promisify(fs.writeFile);

async function writeDeployedJsonToFile(
  contractName: string,
  networkId: number,
  txResult: { contractAddress: string; transactionHash: string },
): Promise<void> {
  deployed[contractName] = deployed[contractName] || {};

  deployed[contractName][networkId] = {
    links: deployed[contractName][networkId].links ?? {},
    address: txResult.contractAddress,
    transactionHash: txResult.transactionHash,
  };

  const json = JSON.stringify(deployed, null, 4).concat('\n');

  const directory = `${__dirname}/../migrations/`;
  const filename = 'deployed.json';
  await writeFileAsync(directory + filename, json);
  console.log(`Wrote ${filename}`);
}

const EXPECTED_NODE_VERSION = 'v16.15.1';

async function verifySingleContract(): Promise<void> {
  if (!process.env.NETWORK) {
    return Promise.reject(new Error('No NETWORK specified!'));
  }

  const nodeVersion = execSync('node --version', { stdio: 'pipe' });
  if (nodeVersion.toString().trim() !== EXPECTED_NODE_VERSION) {
    return Promise.reject(new Error(`Incorrect node version! Expected ${EXPECTED_NODE_VERSION}`));
  }

  const networkId = truffle.networks[process.env.NETWORK]['network_id'];
  const provider = truffle.networks[process.env.NETWORK].provider();
  const dolomiteMargin = new DolomiteMargin(provider, networkId);
  const txResult = await dolomiteMargin.web3.eth.getTransactionReceipt(
    process.env.TRANSACTION_HASH ?? deployed[contractName]?.[networkId]?.transactionHash,
  );
  console.log('Network', process.env.NETWORK, networkId);

  execSync(`truffle run verify --network ${process.env.NETWORK} ${contractName}@${txResult.contractAddress}`, {
    stdio: 'inherit',
  });

  await writeDeployedJsonToFile(contractName, networkId, txResult);
}

verifySingleContract()
  .catch(e => {
    console.error(e.message);
    process.exit(1);
  })
  .then(() => process.exit(0));
