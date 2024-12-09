/*

    Copyright 2019 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License";
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

/**
 * @typedef {Object} artifacts
 */

const {
  isArbitrumNetwork,
  isDevNetwork,
  getChainId,
  deployContractIfNecessary,
  getContract,
} = require('./helpers');

// ============ Contracts ============

// MultiCall
const AccountValuesReader = artifacts.require('AccountValuesReader');
const ArbitrumMultiCall = artifacts.require('ArbitrumMultiCall');
const DolomiteMargin = artifacts.require('DolomiteMargin');
const LiquidatorAssetRegistry = artifacts.require('LiquidatorAssetRegistry');
const MultiCall = artifacts.require('MultiCall');
const TestDolomiteMargin = artifacts.require('TestDolomiteMargin');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  await deployMultiCall(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployMultiCall(deployer, network) {
  const dolomiteMargin = await getContract(network, isDevNetwork(network) ? TestDolomiteMargin : DolomiteMargin);
  let multiCall;
  if (isArbitrumNetwork(network)) {
    multiCall = ArbitrumMultiCall;
  } else {
    multiCall = MultiCall;
  }

  await deployContractIfNecessary(artifacts, deployer, network, multiCall);
  const liquidatorAssetRegistry = await deployContractIfNecessary(
    artifacts,
    deployer,
    network,
    LiquidatorAssetRegistry,
    [dolomiteMargin.address],
  );

  if (isArbitrumNetwork(network)) {
    await deployContractIfNecessary(artifacts, deployer, network, AccountValuesReader, [
      getChainId(network),
      dolomiteMargin.address,
      liquidatorAssetRegistry.address,
    ]);
  }
}
