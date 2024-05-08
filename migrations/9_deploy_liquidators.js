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
  shouldOverwrite,
  getNoOverwriteParams,
  setGlobalOperatorIfNecessary,
} = require('./helpers');

// ============ Contracts ============

// Base Protocol
const DolomiteMargin = artifacts.require('DolomiteMargin');

// Test Contracts
const TestDolomiteMargin = artifacts.require('TestDolomiteMargin');

// Second-Layer Contracts
const Expiry = artifacts.require('Expiry');
const ExpiryProxy = artifacts.require('ExpiryProxy');
const LiquidatorAssetRegistry = artifacts.require('LiquidatorAssetRegistry');
const LiquidatorProxyV1 = artifacts.require('LiquidatorProxyV1');
const LiquidatorProxyV4WithGenericTrader = artifacts.require('LiquidatorProxyV4WithGenericTrader');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  await deploySecondLayer(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deploySecondLayer(deployer, network) {
  const dolomiteMargin = await getDolomiteMargin(network);

  if (shouldOverwrite(LiquidatorAssetRegistry, network)) {
    await deployer.deploy(LiquidatorAssetRegistry, dolomiteMargin.address);
  } else {
    await deployer.deploy(LiquidatorAssetRegistry, getNoOverwriteParams());
  }

  if (shouldOverwrite(ExpiryProxy, network)) {
    await deployer.deploy(ExpiryProxy, LiquidatorAssetRegistry.address, Expiry.address, dolomiteMargin.address);
  } else {
    await deployer.deploy(ExpiryProxy, getNoOverwriteParams());
  }

  if (shouldOverwrite(LiquidatorProxyV1, network)) {
    await deployer.deploy(LiquidatorProxyV1, LiquidatorAssetRegistry.address, dolomiteMargin.address);
  } else {
    await deployer.deploy(LiquidatorProxyV1, getNoOverwriteParams());
  }

  if (shouldOverwrite(LiquidatorProxyV4WithGenericTrader, network)) {
    await deployer.deploy(
      LiquidatorProxyV4WithGenericTrader,
      Expiry.address,
      dolomiteMargin.address,
      LiquidatorAssetRegistry.address,
    );
  } else {
    await deployer.deploy(LiquidatorProxyV4WithGenericTrader, getNoOverwriteParams());
  }

  await setGlobalOperatorIfNecessary(dolomiteMargin, ExpiryProxy.address);
  await setGlobalOperatorIfNecessary(dolomiteMargin, LiquidatorProxyV1.address);
  await setGlobalOperatorIfNecessary(dolomiteMargin, LiquidatorProxyV4WithGenericTrader.address);
}

async function getDolomiteMargin(network) {
  if (isDevNetwork(network)) {
    return TestDolomiteMargin.deployed();
  }
  return DolomiteMargin.deployed();
}
