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
  isEthereumMainnet,
  getRiskLimits,
  getRiskParams,
  getChainlinkOracleSentinelGracePeriod,
  getChainlinkSequencerUptimeFeed,
  shouldOverwrite,
  getNoOverwriteParams,
  isArbitrumNetwork,
  isPolygonZkEvmNetwork,
  isBaseNetwork,
  isMantleNetwork,
  isXLayerNetwork,
} = require('./helpers');

const DolomiteMargin = artifacts.require('DolomiteMargin');
const TestDolomiteMargin = artifacts.require('TestDolomiteMargin');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  await deployBaseProtocol(deployer, network);
  await deployTestContractsForDolomiteMarginDep(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployBaseProtocol(deployer, network) {
  // Base Protocol
  const AdminImpl = artifacts.require('AdminImpl');
  const GettersImpl = artifacts.require('GettersImpl');
  const AlwaysOnlineOracleSentinel = artifacts.require('AlwaysOnlineOracleSentinel');

  let operationImpl;
  if (!isDevNetwork(network)) {
    operationImpl = artifacts.require('OperationImpl')
  } else {
    operationImpl = artifacts.require('TestOperationImpl');
  }

  let dolomiteMargin;
  if (isDevNetwork(network)) {
    dolomiteMargin = artifacts.require('TestDolomiteMargin');
  } else if (
    isEthereumMainnet(network) ||
    isPolygonZkEvmNetwork(network) ||
    isBaseNetwork(network) ||
    isArbitrumNetwork(network) ||
    isMantleNetwork(network) ||
    isXLayerNetwork(network)
  ) {
    dolomiteMargin = DolomiteMargin;
  } else {
    throw new Error('Cannot deploy DolomiteMargin');
  }

  await Promise.all([
    dolomiteMargin.link('AdminImpl', AdminImpl.address),
    dolomiteMargin.link('GettersImpl', GettersImpl.address),
    dolomiteMargin.link('OperationImpl', operationImpl.address),
  ]);

  if (shouldOverwrite(dolomiteMargin, network)) {
    const riskParams = await getRiskParams(network);
    await deployer.deploy(
      dolomiteMargin,
      getRiskLimits(),
      riskParams.marginRatio,
      riskParams.liquidationSpread,
      riskParams.earningsRate,
      riskParams.minBorrowedValue,
      riskParams.accountMaxNumberOfMarketsWithBalances,
      AlwaysOnlineOracleSentinel.address,
      riskParams.callbackGasLimit,
    );
  } else {
    await deployer.deploy(dolomiteMargin, getNoOverwriteParams());
  }

  const TestSequencerUptimeFeedAggregator = artifacts.require('TestSequencerUptimeFeedAggregator');
  const ChainlinkOracleSentinel = artifacts.require('ChainlinkOracleSentinel');
  let uptimeFeed = getChainlinkSequencerUptimeFeed(network, TestSequencerUptimeFeedAggregator);
  if (uptimeFeed) {
    if (shouldOverwrite(ChainlinkOracleSentinel, network)) {
      await deployer.deploy(
        ChainlinkOracleSentinel,
        getChainlinkOracleSentinelGracePeriod(),
        uptimeFeed,
        dolomiteMargin.address,
      );
    } else {
      await deployer.deploy(ChainlinkOracleSentinel, getNoOverwriteParams());
    }

    dolomiteMargin = await getDolomiteMargin(network);
    if ((await dolomiteMargin.getOracleSentinel()).toLowerCase() !== ChainlinkOracleSentinel.address.toLowerCase()) {
      await dolomiteMargin.ownerSetOracleSentinel(ChainlinkOracleSentinel.address);
    }
  }
}

async function deployTestContractsForDolomiteMarginDep(deployer, network) {
  if (isDevNetwork(network)) {
    const TestCallee = artifacts.require('TestCallee');
    const TestParaswapTrader = artifacts.require('TestParaswapTrader');
    const TestParaswapAugustusRouter = artifacts.require('TestParaswapAugustusRouter');
    const TestParaswapTransferProxy = artifacts.require('TestParaswapTransferProxy');
    const TestSimpleCallee = artifacts.require('TestSimpleCallee');

    await deployer.deploy(TestParaswapTransferProxy);
    await deployer.deploy(TestParaswapAugustusRouter, TestParaswapTransferProxy.address);
    await Promise.all([
      deployer.deploy(
        TestParaswapTrader,
        TestParaswapAugustusRouter.address,
        TestParaswapTransferProxy.address,
        TestDolomiteMargin.address,
      ),
      deployer.deploy(TestCallee, TestDolomiteMargin.address),
      deployer.deploy(TestSimpleCallee, TestDolomiteMargin.address),
    ]);
  }
}

async function getDolomiteMargin(network) {
  if (isDevNetwork(network)) {
    return TestDolomiteMargin.deployed();
  }
  return DolomiteMargin.deployed();
}
