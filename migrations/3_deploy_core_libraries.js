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

// ============ Main Migration ============

const migration = async (deployer, network) => {
  await deployBaseProtocol(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployBaseProtocol(deployer, network) {
  // Base Protocol
  const CallImpl = artifacts.require('CallImpl');
  const DepositImpl = artifacts.require('DepositImpl');
  const LiquidateOrVaporizeImpl = artifacts.require('LiquidateOrVaporizeImpl');
  const TradeImpl = artifacts.require('TradeImpl');
  const TransferImpl = artifacts.require('TransferImpl');
  const WithdrawalImpl = artifacts.require('WithdrawalImpl');

  let operationImpl;
  if (isDevNetwork(network)) {
    operationImpl = artifacts.require('OperationImpl')
  } else {
    operationImpl = artifacts.require('TestOperationImpl');
  }

  operationImpl.link('CallImpl', CallImpl.address);
  operationImpl.link('DepositImpl', DepositImpl.address);
  operationImpl.link('LiquidateOrVaporizeImpl', LiquidateOrVaporizeImpl.address);
  operationImpl.link('TradeImpl', TradeImpl.address);
  operationImpl.link('TransferImpl', TransferImpl.address);
  operationImpl.link('WithdrawalImpl', WithdrawalImpl.address);
  if (shouldOverwrite(operationImpl, network)) {
    await deployer.deploy(operationImpl);
  } else {
    await deployer.deploy(operationImpl, getNoOverwriteParams());
  }

  // Oracle Sentinels
  const AlwaysOnlineOracleSentinel = artifacts.require('AlwaysOnlineOracleSentinel');
  if (shouldOverwrite(AlwaysOnlineOracleSentinel, network)) {
    await deployer.deploy(AlwaysOnlineOracleSentinel);
  } else {
    await deployer.deploy(AlwaysOnlineOracleSentinel, getNoOverwriteParams());
  }
}
