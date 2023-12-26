import { execSync } from 'child_process';
import { promisify } from 'es6-promisify';
import fs from 'fs';
import GenericTraderProxyV1 from '../build/contracts/GenericTraderProxyV1.json';
import deployed from '../migrations/deployed.json';
import { ConfirmationType, DolomiteMargin } from '../src';

const truffle = require('../truffle.js');

const writeFileAsync = promisify(fs.writeFile);

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// @ts-ignore
const eventEmitterRegistryAddress = '0x4BfF12773B0Dc3Cb35f174B5CD351F662018CC2F';
// @ts-ignore
const genericTraderProxyV1LibAddress = '0x361b242C2E4F7E002205c0d016b9Ae0ac97c93D1';

async function deploy(): Promise<void> {
  const network = process.env.NETWORK;
  if (!network) {
    return Promise.reject(new Error('No NETWORK specified!'));
  }

  const nodeVersion = execSync('node --version', { stdio: 'pipe' });
  if (nodeVersion.toString().trim() !== 'v14.17.0') {
    return Promise.reject(new Error('Incorrect node version! Expected v14.17.0'));
  }

  const contractName = GenericTraderProxyV1.contractName;
  const networkId = truffle.networks[network]['network_id'];
  const provider = truffle.networks[network].provider();
  const dolomiteMargin = new DolomiteMargin(provider, networkId);
  const deployer = (await dolomiteMargin.web3.eth.getAccounts())[0];
  const contract = new dolomiteMargin.web3.eth.Contract(GenericTraderProxyV1.abi);
  const txResult = await dolomiteMargin.contracts.callContractFunction(
    contract.deploy({
      data: GenericTraderProxyV1.bytecode.replace(
        '__GenericTraderProxyV1Lib_______________',
        genericTraderProxyV1LibAddress.substring(2),
      ),
      arguments: [dolomiteMargin.expiry.address, eventEmitterRegistryAddress, dolomiteMargin.address],
    }),
    { confirmationType: ConfirmationType.Confirmed, gas: '60000000', gasPrice: '100000000', from: deployer },
  );

  console.log(`Deployed ${contractName} to ${txResult.contractAddress}`);
  // sleeping for 5 seconds to allow for the transaction to settle before verification
  console.log('Sleeping for 5 seconds...');
  await sleep(5000);

  execSync(`truffle run verify --network ${network} ${contractName}@${txResult.contractAddress}`, {
    stdio: 'inherit',
  });

  deployed[contractName] = deployed[contractName] || {};

  deployed[contractName][networkId] = {
    links: {},
    address: txResult.contractAddress,
    transactionHash: txResult.transactionHash,
  };

  const json = JSON.stringify(deployed, null, 4).concat('\n');

  const directory = `${__dirname}/../migrations/`;
  const filename = 'deployed.json';
  await writeFileAsync(directory + filename, json);
  console.log(`Wrote ${filename}`);
}

deploy()
  .catch(e => {
    console.error(e.message);
    process.exit(1);
  })
  .then(() => process.exit(0));
