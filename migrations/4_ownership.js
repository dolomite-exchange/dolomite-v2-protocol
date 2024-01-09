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
  getDelayedMultisigAddress,
  getGnosisSafeAddress,
} = require('./helpers');

// ============ Contracts ============

const DolomiteMargin = artifacts.require('DolomiteMargin');
const SignedOperationProxy = artifacts.require('SignedOperationProxy');
const SimpleFeeOwner = artifacts.require('SimpleFeeOwner');
const DolomiteAmmFactory = artifacts.require('DolomiteAmmFactory');
const AmmRebalancerProxyV1 = artifacts.require('AmmRebalancerProxyV1');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  if (!isDevNetwork(network)) {
    const delayedMultisig = getDelayedMultisigAddress(network);

    const deployedDolomiteMargin = await DolomiteMargin.deployed();
    await deployedDolomiteMargin.transferOwnership(delayedMultisig);

    if (isDevNetwork(network)) {
      const [
        dolomiteAmmFactory,
        deployedAmmRebalancerProxyV1,
        deployedSignedOperationProxy,
        deployedSimpleFeeOwner,
      ] = await Promise.all([
        DolomiteAmmFactory.deployed(),
        AmmRebalancerProxyV1.deployed(),
        SignedOperationProxy.deployed(),
        SimpleFeeOwner.deployed(),
      ]);

      await Promise.all([
        dolomiteAmmFactory.setFeeToSetter(delayedMultisig),
        deployedSignedOperationProxy.transferOwnership(delayedMultisig),
        deployedSimpleFeeOwner.transferOwnership(delayedMultisig),
      ]);

      const gnosisSafe = getGnosisSafeAddress(network);
      await Promise.all([
        deployedAmmRebalancerProxyV1.transferOwnership(gnosisSafe),
      ]);

      const uniswapV2Factory = await UniswapV2Factory.deployed();
      await uniswapV2Factory.setFeeToSetter(delayedMultisig);
    }
  }
};

module.exports = migration;
