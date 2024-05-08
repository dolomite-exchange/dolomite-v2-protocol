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
} = require('./helpers');
const {
  getChainlinkPriceOracleContract,
  getChainlinkPriceOracleV1Params
} = require('./oracle_helpers');

// ============ Contracts ============

// Base Protocol
const DolomiteMargin = artifacts.require('DolomiteMargin');
const TestDolomiteMargin = artifacts.require('TestDolomiteMargin');

// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await deployPriceOracles(deployer, network, accounts);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployPriceOracles(deployer, network) {
  let params;
  if (isDevNetwork(network)) {
    // Test Tokens
    const TokenA = artifacts.require('TokenA');
    const TokenB = artifacts.require('TokenB');
    const TokenD = artifacts.require('TokenD');
    const TokenE = artifacts.require('TokenE');
    const TokenF = artifacts.require('TokenF');

    // Test Contracts
    const TestBtcUsdChainlinkAggregator = artifacts.require('TestBtcUsdChainlinkAggregator');
    const TestDaiUsdChainlinkAggregator = artifacts.require('TestDaiUsdChainlinkAggregator');
    const TestEthUsdChainlinkAggregator = artifacts.require('TestEthUsdChainlinkAggregator');
    const TestLinkUsdChainlinkAggregator = artifacts.require('TestLinkUsdChainlinkAggregator');
    const TestLrcEthChainlinkAggregator = artifacts.require('TestLrcEthChainlinkAggregator');
    const TestMaticUsdChainlinkAggregator = artifacts.require('TestMaticUsdChainlinkAggregator');
    const TestPriceOracle = artifacts.require('TestPriceOracle');
    const TestUsdcUsdChainlinkAggregator = artifacts.require('TestUsdcUsdChainlinkAggregator');
    const TestWETH = artifacts.require('TestWETH');

    await deployer.deploy(TestPriceOracle);

    await Promise.all([
      deployer.deploy(TestBtcUsdChainlinkAggregator),
      deployer.deploy(TestDaiUsdChainlinkAggregator),
      deployer.deploy(TestEthUsdChainlinkAggregator),
      deployer.deploy(TestLinkUsdChainlinkAggregator),
      deployer.deploy(TestLrcEthChainlinkAggregator),
      deployer.deploy(TestMaticUsdChainlinkAggregator),
      deployer.deploy(TestUsdcUsdChainlinkAggregator),
    ]);

    const tokens = {
      TokenA,
      TokenB,
      TokenD,
      TokenE,
      TokenF,
      TestWETH,
    };
    const aggregators = {
      btcUsdAggregator: TestBtcUsdChainlinkAggregator,
      daiUsdAggregator: TestDaiUsdChainlinkAggregator,
      ethUsdAggregator: TestEthUsdChainlinkAggregator,
      linkUsdAggregator: TestLinkUsdChainlinkAggregator,
      lrcEthAggregator: TestLrcEthChainlinkAggregator,
      maticUsdAggregator: TestMaticUsdChainlinkAggregator,
      usdcUsdAggregator: TestUsdcUsdChainlinkAggregator,
    };
    params = getChainlinkPriceOracleV1Params(network, tokens, aggregators);
  } else {
    params = getChainlinkPriceOracleV1Params(network, {}, {});
  }

  const oracleContract = getChainlinkPriceOracleContract(network, artifacts);

  if (shouldOverwrite(oracleContract, network)) {
    const dolomiteMargin = await getDolomiteMargin(network);
    await deployer.deploy(
      oracleContract,
      params ? params.tokens : [],
      params ? params.aggregators : [],
      params ? params.tokenDecimals : [],
      params ? params.tokenPairs : [],
      dolomiteMargin.address,
    );
  } else {
    await deployer.deploy(oracleContract, getNoOverwriteParams());
  }
}

async function getDolomiteMargin(network) {
  if (isDevNetwork(network)) {
    return TestDolomiteMargin.deployed();
  }
  return DolomiteMargin.deployed();
}
