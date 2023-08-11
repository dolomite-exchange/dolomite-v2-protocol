/* eslint-disable import/no-extraneous-dependencies */
import fs from 'fs';
import { promisify } from 'es6-promisify';
import mkdirp from 'mkdirp';
import contracts from './Artifacts';
import testContracts from './TestArtifacts';
import deployed from '../migrations/deployed.json';
import externalDeployed from '../migrations/external-deployed.json';
import { abi as eventsAbi } from '../build/contracts/Events.json';
import { abi as adminAbi } from '../build/contracts/AdminImpl.json';
import { abi as callAbi } from '../build/contracts/CallImpl.json';
import { abi as depositAbi } from '../build/contracts/DepositImpl.json';
import { abi as liquidateOrVaporizeAbi } from '../build/contracts/LiquidateOrVaporizeImpl.json';
import { abi as operationAbi } from '../build/contracts/OperationImpl.json';
import { abi as tradeAbi } from '../build/contracts/TradeImpl.json';
import { abi as transferAbi } from '../build/contracts/TransferImpl.json';
import { abi as withdrawAbi } from '../build/contracts/WithdrawalImpl.json';
import { abi as safeExternalCallbackAbi } from '../build/contracts/SafeExternalCallback.json';
import { abi as permissionAbi } from '../build/contracts/Permission.json';

const writeFileAsync = promisify(fs.writeFile);

// eslint-disable-next-line import/no-extraneous-dependencies
require('dotenv-flow').config();

const TEST_NETWORK_ID: string = '1001';
const COVERAGE_NETWORK_ID: string = '1002';

async function clean(): Promise<void> {
  const directory = `${__dirname}/../build/published_contracts/`;
  const testDirectory = `${__dirname}/../build/testing_contracts/`;
  mkdirp.sync(directory);
  mkdirp.sync(testDirectory);

  const allContractNames = Object.keys(contracts).concat(Object.keys(testContracts));

  const promises = allContractNames.map(async (contractName) => {
    let contract = contracts[contractName];
    const finalDirectory = contract ? directory : testDirectory;
    if (!contract) {
      contract = testContracts[contractName];
    }

    const cleaned = {
      contractName: contract.contractName,
      abi: contract.abi,
      networks: {},
    };

    if (externalDeployed[contractName]) {
      cleaned.networks = externalDeployed[contractName];
    } else if (deployed[contractName]) {
      cleaned.networks = deployed[contractName];
    }

    if (contract.networks && contract.networks[TEST_NETWORK_ID]) {
      cleaned.networks[TEST_NETWORK_ID] = {
        links: contract.networks[TEST_NETWORK_ID].links,
        address: contract.networks[TEST_NETWORK_ID].address,
        transactionHash: contract.networks[TEST_NETWORK_ID].transactionHash,
      };
    }
    if (contract.networks && contract.networks[COVERAGE_NETWORK_ID]) {
      cleaned.networks[COVERAGE_NETWORK_ID] = {
        links: contract.networks[COVERAGE_NETWORK_ID].links,
        address: contract.networks[COVERAGE_NETWORK_ID].address,
        transactionHash: contract.networks[COVERAGE_NETWORK_ID].transactionHash,
      };
    }

    if (contractName === 'DolomiteMargin' || contractName === 'TestDolomiteMargin') {
      // Some of these may have empty ABIs in production, but that's okay. When running coverage, they're non-empty.
      cleaned.abi = cleaned.abi
        .concat(getAllEvents(callAbi))
        .concat(getAllEvents(depositAbi))
        .concat(getAllEvents(liquidateOrVaporizeAbi))
        .concat(getAllEvents(operationAbi))
        .concat(getAllEvents(tradeAbi))
        .concat(getAllEvents(transferAbi))
        .concat(getAllEvents(withdrawAbi))
        .concat(getAllEvents(eventsAbi))
        .concat(getAllEvents(adminAbi))
        .concat(getAllEvents(safeExternalCallbackAbi))
        .concat(getAllEvents(permissionAbi));
    }

    const json = JSON.stringify(cleaned, null, 4);

    const filename = `${contractName}.json`;
    await writeFileAsync(finalDirectory + filename, json);

    console.log(`Wrote ${finalDirectory}${filename}`);
  });

  await Promise.all(promises);
}

function getAllEvents(abi: any) {
  return abi.filter(e => e.type === 'event');
}

clean()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));
