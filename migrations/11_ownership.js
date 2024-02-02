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
} = require('./helpers');

// ============ Contracts ============

const DolomiteMargin = artifacts.require('DolomiteMargin');
const SignedOperationProxy = artifacts.require('SignedOperationProxy');

// ============ Main Migration ============

const migration = async (deployer, network) => {
  if (!isDevNetwork(network)) {
    const delayedMultisig = getDelayedMultisigAddress(network);

    const deployedDolomiteMargin = await DolomiteMargin.deployed();
    await deployedDolomiteMargin.transferOwnership(delayedMultisig);

    if (isDevNetwork(network)) {
      const [
        deployedSignedOperationProxy,
      ] = await Promise.all([
        SignedOperationProxy.deployed(),
      ]);

      await Promise.all([
        deployedSignedOperationProxy.transferOwnership(delayedMultisig),
      ]);
    }
  }
};

module.exports = migration;
