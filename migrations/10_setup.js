/*

    Copyright 2019 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
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
  isDocker,
  isPolygonZkEvm,
  isArbitrumOne,
  isBeraNetwork,
  isMantleNetwork,
  isXLayerNetwork,
  isBaseNetwork, getContract,
} = require('./helpers');
const {
  getDaiAddress,
  getLinkAddress,
  getUsdcAddress,
  getWethAddress,
  getWbtcAddress,
  getWrappedCurrencyAddress,
  getUsdtAddress,
} = require('./token_helpers');
const { getChainlinkPriceOracleContract } = require('./oracle_helpers');

// ============ Contracts ============

// Base Protocol
const DolomiteMargin = artifacts.require('DolomiteMargin');
const DepositWithdrawalProxy = artifacts.require('DepositWithdrawalProxy');
const Expiry = artifacts.require('Expiry');

// Test Contracts
const TestDolomiteMargin = artifacts.require('TestDolomiteMargin');
const TokenA = artifacts.require('TokenA');
const TokenB = artifacts.require('TokenB');
const TokenD = artifacts.require('TokenD');
const TokenF = artifacts.require('TokenF');
const TestWETH = artifacts.require('TestWETH');
const TestPriceOracle = artifacts.require('TestPriceOracle');

// Interest Setters
const AlwaysZeroInterestSetter = artifacts.require('AlwaysZeroInterestSetter');

// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await setupProtocol(deployer, network, accounts);
};

module.exports = migration;

// ============ Setup Functions ============

async function setupProtocol(deployer, network) {
  const expiry = await getContract(network, Expiry);
  const dolomiteMargin = await getDolomiteMargin(network);
  await dolomiteMargin.ownerSetAutoTraderSpecial(expiry.address, true);

  if (isDevNetwork(network) && !isDocker(network)) {
    return;
  }
  if (isMantleNetwork(network) || isXLayerNetwork(network) || isBeraNetwork(network)) {
    return;
  }

  const [tokens, oracles, setters] = await Promise.all([getTokens(network), getOracles(network), getSetters(network)]);

  await addMarkets(dolomiteMargin, tokens, oracles, setters);

  const depositWithdrawalProxy = await DepositWithdrawalProxy.deployed();
  depositWithdrawalProxy.initializePayableMarket(getWrappedCurrencyAddress(network, TestWETH));
}

async function addMarkets(dolomiteMargin, tokens, priceOracles, interestSetters) {
  const marginPremium = { value: '0' };
  const liquidationSpreadPremium = { value: '0' };
  const maxWei = '0';
  const isClosing = false;
  const earningsRateOverride = '0';

  for (let i = 0; i < tokens.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await dolomiteMargin.ownerAddMarket(
      tokens[i].address,
      priceOracles[i].address,
      interestSetters[i].address,
      marginPremium,
      liquidationSpreadPremium,
      maxWei,
      maxWei,
      { value: earningsRateOverride },
      isClosing,
    );
  }
}

// ============ Network Getter Functions ============

async function getDolomiteMargin(network) {
  if (isDevNetwork(network)) {
    return getContract(network, TestDolomiteMargin);
  }
  return getContract(network, DolomiteMargin);
}

function getTokens(network) {
  if (isPolygonZkEvm(network) || isBaseNetwork(network)) {
    return [
      { address: getWethAddress(network, TestWETH) },
    ];
  } else if (isArbitrumOne(network)) {
    const tokens = [
      { address: getWethAddress(network, TestWETH) },
      { address: getDaiAddress(network, TokenB) },
      { address: getUsdcAddress(network, TokenA) },
      { address: getLinkAddress(network, TokenF) },
      { address: getWbtcAddress(network, TokenD) },
    ];
    if (isArbitrumOne(network)) {
      tokens.push({ address: getUsdtAddress(network) });
    }
    return tokens;
  }

  throw new Error(`Could not get tokens for network: ${network}`);
}

async function getOracles(network) {
  const tokens = getTokens(network);
  if (isDocker(network)) {
    return tokens.map(() => ({ address: TestPriceOracle.address }));
  }

  const OracleContract = getChainlinkPriceOracleContract(network, artifacts);
  return tokens.map(() => ({ address: OracleContract.address }));
}

async function getSetters(network) {
  const tokens = getTokens(network);
  return tokens.map(() => ({ address: AlwaysZeroInterestSetter.address }));
}
