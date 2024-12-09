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
  getChainId,
  getExpiryRampTime,
  setGlobalOperatorIfNecessary,
  deployContractIfNecessary,
  getContract,
} = require('./helpers');

// ============ Contracts ============

// Base Protocol
const DolomiteMargin = artifacts.require('DolomiteMargin');

// Test Contracts
const TestDolomiteMargin = artifacts.require('TestDolomiteMargin');

// Second-Layer Contracts
const BorrowPositionProxyV1 = artifacts.require('BorrowPositionProxyV1');
const BorrowPositionProxyV2 = artifacts.require('BorrowPositionProxyV2');
const DepositWithdrawalProxy = artifacts.require('DepositWithdrawalProxy');
const Expiry = artifacts.require('Expiry');
const GenericTraderProxyV1 = artifacts.require('GenericTraderProxyV1');
const GenericTraderProxyV1Lib = artifacts.require('GenericTraderProxyV1Lib');
const EventEmitterRegistry = artifacts.require('EventEmitterRegistry');
const SignedOperationProxy = artifacts.require('SignedOperationProxy');
const TransferProxy = artifacts.require('TransferProxy');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  await deploySecondLayer(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deploySecondLayer(deployer, network) {
  const dolomiteMargin = await getDolomiteMargin(network);

  const transferProxy = await deployContractIfNecessary(artifacts, deployer, network, TransferProxy, [
    dolomiteMargin.address,
  ]);
  const borrowPositionProxyV1 = await deployContractIfNecessary(artifacts, deployer, network, BorrowPositionProxyV1, [
    dolomiteMargin.address,
  ]);
  const borrowPositionProxyV2 = await deployContractIfNecessary(artifacts, deployer, network, BorrowPositionProxyV2, [
    dolomiteMargin.address,
  ]);
  const depositWithdrawalProxy = await deployContractIfNecessary(artifacts, deployer, network, DepositWithdrawalProxy, [
    dolomiteMargin.address,
  ]);
  const eventEmitter = await deployContractIfNecessary(artifacts, deployer, network, EventEmitterRegistry, [
    dolomiteMargin.address,
  ]);
  const expiry = await deployContractIfNecessary(artifacts, deployer, network, Expiry, [
    dolomiteMargin.address,
    getExpiryRampTime(network),
  ]);
  const genericTraderProxyV1Lib = await deployContractIfNecessary(
    artifacts,
    deployer,
    network,
    GenericTraderProxyV1Lib,
    [],
  );

  GenericTraderProxyV1.link('GenericTraderProxyV1Lib', genericTraderProxyV1Lib.address);
  const genericTraderProxyV1 = await deployContractIfNecessary(artifacts, deployer, network, GenericTraderProxyV1, [
    getChainId(network),
    eventEmitter.address,
    expiry.address,
    dolomiteMargin.address,
  ]);

  const signedOperationProxy = await deployContractIfNecessary(artifacts, deployer, network, SignedOperationProxy, [
    dolomiteMargin.address,
    getChainId(network),
  ]);

  if (isDevNetwork(network)) {
    await Promise.all([
      dolomiteMargin.ownerSetGlobalOperator(borrowPositionProxyV1.address, true),
      dolomiteMargin.ownerSetGlobalOperator(borrowPositionProxyV2.address, true),
      dolomiteMargin.ownerSetGlobalOperator(depositWithdrawalProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(expiry.address, true),
      dolomiteMargin.ownerSetGlobalOperator(genericTraderProxyV1.address, true),
      dolomiteMargin.ownerSetGlobalOperator(signedOperationProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(transferProxy.address, true),
    ]);
  } else {
    await setGlobalOperatorIfNecessary(dolomiteMargin, borrowPositionProxyV1.address);
    await setGlobalOperatorIfNecessary(dolomiteMargin, borrowPositionProxyV2.address);
    await setGlobalOperatorIfNecessary(dolomiteMargin, depositWithdrawalProxy.address);
    await setGlobalOperatorIfNecessary(dolomiteMargin, expiry.address);
    await setGlobalOperatorIfNecessary(dolomiteMargin, genericTraderProxyV1.address);
    await setGlobalOperatorIfNecessary(dolomiteMargin, transferProxy.address);
  }
}

async function getDolomiteMargin(network) {
  return getContract(network, isDevNetwork(network) ? TestDolomiteMargin : DolomiteMargin);
}
