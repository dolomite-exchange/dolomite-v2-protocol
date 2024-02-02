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
  isDevNetwork,
  getDoubleExponentParams,
  shouldOverwrite,
  getNoOverwriteParams,
} = require('./helpers');

// ============ Contracts ============

// Test Contracts
const TestInterestSetter = artifacts.require('TestInterestSetter');

// Interest Setters
const AAVECopyCatAltCoinInterestSetter = artifacts.require('AAVECopyCatAltCoinInterestSetter');
const AAVECopyCatStableCoinInterestSetter = artifacts.require('AAVECopyCatStableCoinInterestSetter');
const AlwaysZeroInterestSetter = artifacts.require('AlwaysZeroInterestSetter');
const DoubleExponentInterestSetter = artifacts.require('DoubleExponentInterestSetter');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  await deployInterestSetters(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployInterestSetters(deployer, network) {
  if (isDevNetwork(network)) {
    await deployer.deploy(TestInterestSetter);
  }

  if (shouldOverwrite(AAVECopyCatAltCoinInterestSetter, network)) {
    await deployer.deploy(AAVECopyCatAltCoinInterestSetter);
  } else {
    await deployer.deploy(AAVECopyCatAltCoinInterestSetter, getNoOverwriteParams());
  }

  if (shouldOverwrite(AAVECopyCatStableCoinInterestSetter, network)) {
    await deployer.deploy(AAVECopyCatStableCoinInterestSetter);
  } else {
    await deployer.deploy(AAVECopyCatStableCoinInterestSetter, getNoOverwriteParams());
  }

  if (shouldOverwrite(AlwaysZeroInterestSetter, network)) {
    await deployer.deploy(AlwaysZeroInterestSetter);
  } else {
    await deployer.deploy(AlwaysZeroInterestSetter, getNoOverwriteParams());
  }

  if (shouldOverwrite(DoubleExponentInterestSetter, network)) {
    await deployer.deploy(DoubleExponentInterestSetter, getDoubleExponentParams(network));
  } else {
    await deployer.deploy(DoubleExponentInterestSetter, getNoOverwriteParams());
  }
}
