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
  shouldOverwrite,
  getNoOverwriteParams,
  getExpiryRampTime,
  isMantleNetwork,
  isXLayerNetwork,
  setGlobalOperatorIfNecessary,
} = require('./helpers');
const { getWrappedCurrencyAddress } = require('./token_helpers');

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
const PayableProxy = artifacts.require('PayableProxy');
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

  if (shouldOverwrite(TransferProxy, network)) {
    await deployer.deploy(TransferProxy, dolomiteMargin.address);
  } else {
    await deployer.deploy(TransferProxy, getNoOverwriteParams());
  }

  if (shouldOverwrite(BorrowPositionProxyV1, network)) {
    await deployer.deploy(BorrowPositionProxyV1, dolomiteMargin.address);
  } else {
    await deployer.deploy(BorrowPositionProxyV1, getNoOverwriteParams());
  }

  if (shouldOverwrite(BorrowPositionProxyV2, network)) {
    await deployer.deploy(BorrowPositionProxyV2, dolomiteMargin.address);
  } else {
    await deployer.deploy(BorrowPositionProxyV2, getNoOverwriteParams());
  }

  if (shouldOverwrite(DepositWithdrawalProxy, network)) {
    await deployer.deploy(DepositWithdrawalProxy, dolomiteMargin.address);
  } else {
    await deployer.deploy(DepositWithdrawalProxy, getNoOverwriteParams());
  }

  if (shouldOverwrite(EventEmitterRegistry, network)) {
    await deployer.deploy(EventEmitterRegistry, dolomiteMargin.address);
  } else {
    await deployer.deploy(EventEmitterRegistry, getNoOverwriteParams());
  }

  if (shouldOverwrite(Expiry, network)) {
    await deployer.deploy(Expiry, dolomiteMargin.address, getExpiryRampTime(network));
  } else {
    await deployer.deploy(Expiry, getNoOverwriteParams());
  }

  if (shouldOverwrite(GenericTraderProxyV1Lib, network)) {
    await deployer.deploy(GenericTraderProxyV1Lib);
  } else {
    await deployer.deploy(GenericTraderProxyV1, getNoOverwriteParams());
  }

  if (shouldOverwrite(GenericTraderProxyV1, network)) {
    GenericTraderProxyV1.link('GenericTraderProxyV1Lib', GenericTraderProxyV1Lib.address);
    await deployer.deploy(GenericTraderProxyV1, Expiry.address, EventEmitterRegistry.address, dolomiteMargin.address);
  } else {
    await deployer.deploy(GenericTraderProxyV1, getNoOverwriteParams());
  }

  if (shouldOverwrite(SignedOperationProxy, network)) {
    await deployer.deploy(SignedOperationProxy, dolomiteMargin.address, getChainId(network));
  } else {
    await deployer.deploy(SignedOperationProxy, getNoOverwriteParams());
  }

  if (isDevNetwork(network)) {
    await Promise.all([
      dolomiteMargin.ownerSetGlobalOperator(BorrowPositionProxyV1.address, true),
      dolomiteMargin.ownerSetGlobalOperator(BorrowPositionProxyV2.address, true),
      dolomiteMargin.ownerSetGlobalOperator(DepositWithdrawalProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(Expiry.address, true),
      dolomiteMargin.ownerSetGlobalOperator(GenericTraderProxyV1.address, true),
      dolomiteMargin.ownerSetGlobalOperator(PayableProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(SignedOperationProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(TransferProxy.address, true),
    ]);
  } else {
    await setGlobalOperatorIfNecessary(dolomiteMargin, BorrowPositionProxyV1.address);
    await setGlobalOperatorIfNecessary(dolomiteMargin, BorrowPositionProxyV2.address);
    await setGlobalOperatorIfNecessary(dolomiteMargin, DepositWithdrawalProxy.address);
    await setGlobalOperatorIfNecessary(dolomiteMargin, Expiry.address);
    await setGlobalOperatorIfNecessary(dolomiteMargin, GenericTraderProxyV1.address);
    await setGlobalOperatorIfNecessary(dolomiteMargin, TransferProxy.address);
  }
}

async function getDolomiteMargin(network) {
  if (isDevNetwork(network)) {
    return TestDolomiteMargin.deployed();
  }
  return DolomiteMargin.deployed();
}
