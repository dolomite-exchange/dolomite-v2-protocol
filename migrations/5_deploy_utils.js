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
  shouldOverwrite,
  getNoOverwriteParams,
  isArbitrumNetwork,
  isDevNetwork,
} = require('./helpers');

// ============ Contracts ============

// MultiCall
const AccountValuesReader = artifacts.require('AccountValuesReader');
const ArbitrumMultiCall = artifacts.require('ArbitrumMultiCall');
const DolomiteMargin = artifacts.require('DolomiteMargin');
const MultiCall = artifacts.require('MultiCall');
const TestDolomiteMargin = artifacts.require('TestDolomiteMargin');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  await deployMultiCall(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployMultiCall(deployer, network) {
  let multiCall;
  if (isArbitrumNetwork(network)) {
    multiCall = ArbitrumMultiCall;
  } else {
    multiCall = MultiCall;
  }

  if (shouldOverwrite(multiCall, network)) {
    await deployer.deploy(multiCall);
  } else {
    await deployer.deploy(multiCall, getNoOverwriteParams());
  }

  if (isArbitrumNetwork(network)) {
    if (shouldOverwrite(AccountValuesReader, network)) {
      let dolomiteMargin = isDevNetwork(network) ? TestDolomiteMargin : DolomiteMargin;

      await deployer.deploy(AccountValuesReader, dolomiteMargin);
    } else {
      await deployer.deploy(AccountValuesReader, getNoOverwriteParams());
    }
  }
}
