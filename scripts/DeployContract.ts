import { abi, bytecode, contractName } from '../build/contracts/LiquidatorProxyV1WithAmm.json';
import { ConfirmationType, DolomiteMargin } from '../src';
import { LiquidatorProxyV1WithAmm } from '../build/wrappers/LiquidatorProxyV1WithAmm';
import { execSync } from 'child_process';
import deployed from '../migrations/deployed.json';
import { promisify } from 'es6-promisify';
import fs from 'fs';
const truffle = require('../truffle');
const writeFileAsync = promisify(fs.writeFile);

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function deploy(): Promise<void> {
  const network = process.env.NETWORK;
  if (!network) {
    return Promise.reject(new Error('No NETWORK specified!'));
  }

  const nodeVersion = execSync('node --version', { stdio: 'pipe' });
  if (nodeVersion.toString().trim() !== 'v14.17.0') {
    return Promise.reject(new Error('Incorrect node version! Expected v14.17.0'));
  }

  const networkId = truffle.networks[network]['network_id'];
  const provider = truffle.networks[network].provider();
  const dolomiteMargin = new DolomiteMargin(provider, networkId);
  const deployer = (await dolomiteMargin.web3.eth.getAccounts())[0];
  const contract = new dolomiteMargin.web3.eth.Contract(abi) as LiquidatorProxyV1WithAmm;
  const txResult = await dolomiteMargin.contracts.callContractFunction(
    contract.deploy({
      data: bytecode,
      arguments: [
        dolomiteMargin.address,
        dolomiteMargin.dolomiteAmmRouterProxy.address,
        dolomiteMargin.expiry.address,
        dolomiteMargin.liquidatorAssetRegistry.address,
      ],
    }),
    { confirmationType: ConfirmationType.Confirmed, gas: '30000000', gasPrice: '100000000', from: deployer },
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
