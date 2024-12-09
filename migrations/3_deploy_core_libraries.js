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
  getContract,
  deployContractIfNecessary,
} = require('./helpers');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  await deployBaseProtocol(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployBaseProtocol(deployer, network) {
  // Base Protocol
  const callImpl = await getContract(network, artifacts.require('CallImpl'));
  const depositImpl = await getContract(network, artifacts.require('DepositImpl'));
  const liquidateOrVaporizeImpl = await getContract(network, artifacts.require('LiquidateOrVaporizeImpl'));
  const tradeImpl = await getContract(network, artifacts.require('TradeImpl'));
  const transferImpl = await getContract(network, artifacts.require('TransferImpl'));
  const withdrawalImpl = await getContract(network, artifacts.require('WithdrawalImpl'));

  let operationImpl;
  if (!isDevNetwork(network)) {
    operationImpl = artifacts.require('OperationImpl')
  } else {
    operationImpl = artifacts.require('TestOperationImpl');
  }

  operationImpl.link('CallImpl', callImpl.address);
  operationImpl.link('DepositImpl', depositImpl.address);
  operationImpl.link('LiquidateOrVaporizeImpl', liquidateOrVaporizeImpl.address);
  operationImpl.link('TradeImpl', tradeImpl.address);
  operationImpl.link('TransferImpl', transferImpl.address);
  operationImpl.link('WithdrawalImpl', withdrawalImpl.address);
  await deployContractIfNecessary(artifacts, deployer, network, operationImpl);

  const AlwaysOnlineOracleSentinel = artifacts.require('AlwaysOnlineOracleSentinel');
  await deployContractIfNecessary(artifacts, deployer, network, AlwaysOnlineOracleSentinel);
}
