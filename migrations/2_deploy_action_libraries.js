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
  getPolynomialParams,
  getDoubleExponentParams,
  deployContractIfNecessary,
} = require('./helpers');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  await deployTestContracts(deployer, network);
  await deployBaseProtocol(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployTestContracts(deployer, network) {
  if (isDevNetwork(network)) {
    // Test Tokens
    const TokenA = artifacts.require('TokenA');
    const TokenB = artifacts.require('TokenB');
    const TokenC = artifacts.require('TokenC');
    const TokenD = artifacts.require('TokenD');
    const TokenE = artifacts.require('TokenE');
    const TokenF = artifacts.require('TokenF');
    const ErroringToken = artifacts.require('ErroringToken');
    const MalformedToken = artifacts.require('MalformedToken');
    const OmiseToken = artifacts.require('OmiseToken');

    // Test Contracts
    const TestAccountRiskOverrideSetter = artifacts.require('TestAccountRiskOverrideSetter');
    const TestAutoTrader = artifacts.require('TestAutoTrader');
    const TestChainlinkAggregator = artifacts.require('TestChainlinkAggregator');
    const TestDoubleExponentInterestSetter = artifacts.require('TestDoubleExponentInterestSetter');
    const TestExchangeWrapper = artifacts.require('TestExchangeWrapper');
    const TestLib = artifacts.require('TestLib');
    const TestPolynomialInterestSetter = artifacts.require('TestPolynomialInterestSetter');
    const TestSequencerUptimeFeedAggregator = artifacts.require('TestSequencerUptimeFeedAggregator');
    const TestWETH = artifacts.require('TestWETH');

    await Promise.all([
      // Test Tokens
      deployer.deploy(TokenA),
      deployer.deploy(TokenB),
      deployer.deploy(TokenC),
      deployer.deploy(TokenD),
      deployer.deploy(TokenE),
      deployer.deploy(TokenF),
      deployer.deploy(TestWETH, 'Wrapped Ether', 'WETH'),
      deployer.deploy(ErroringToken),
      deployer.deploy(MalformedToken),
      deployer.deploy(OmiseToken),
      // Test Contracts
      deployer.deploy(TestAccountRiskOverrideSetter),
      deployer.deploy(TestAutoTrader),
      deployer.deploy(TestChainlinkAggregator),
      deployer.deploy(TestDoubleExponentInterestSetter, getDoubleExponentParams(network)),
      deployer.deploy(TestExchangeWrapper),
      deployer.deploy(TestLib),
      deployer.deploy(TestPolynomialInterestSetter, getPolynomialParams(network)),
      deployer.deploy(TestSequencerUptimeFeedAggregator),
    ]);
  }
}

async function deployBaseProtocol(deployer, network) {
  const AdminImpl = artifacts.require('AdminImpl');
  const GettersImpl = artifacts.require('GettersImpl');
  const CallImpl = artifacts.require('CallImpl');
  const DepositImpl = artifacts.require('DepositImpl');
  const LiquidateOrVaporizeImpl = artifacts.require('LiquidateOrVaporizeImpl');
  const TradeImpl = artifacts.require('TradeImpl');
  const TransferImpl = artifacts.require('TransferImpl');
  const WithdrawalImpl = artifacts.require('WithdrawalImpl');

  await deployContractIfNecessary(artifacts, deployer, network, CallImpl);
  await deployContractIfNecessary(artifacts, deployer, network, DepositImpl);
  await deployContractIfNecessary(artifacts, deployer, network, LiquidateOrVaporizeImpl);
  await deployContractIfNecessary(artifacts, deployer, network, TradeImpl);
  await deployContractIfNecessary(artifacts, deployer, network, TransferImpl);
  await deployContractIfNecessary(artifacts, deployer, network, WithdrawalImpl);
  await deployContractIfNecessary(artifacts, deployer, network, AdminImpl);
  await deployContractIfNecessary(artifacts, deployer, network, GettersImpl);
}
