/*

    Copyright 2022 Dolomite.

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

pragma solidity ^0.5.7;
pragma experimental ABIEncoderV2;


/**
 * @title IChainlinkAutomation
 * @author Dolomite
 *
 * @dev Chainlink Automation enables conditional execution of your smart contracts functions through a hyper-reliable
 *      and decentralized automation platform that uses the same external network of node operators that secures
 *      billions in value. The documentation is copied from Chainlink's official smart contract documentation
 */
contract IChainlinkAutomation {

    /**
     * @notice  The  method that is simulated by keepers to see if any work actually needs to be performed. This method
     *          does does not actually need to be executable, and since it is only ever simulated it can consume a lot
     *          of gas.
     * @dev     To ensure that it is never called, you may want to add the `cannotExecute` modifier from `KeeperBase` to
     *          your implementation of this method.
     * @param   _checkData      specified in the upkeep registration so it is always the same for a registered upkeep.
     *                          This can easily be broken down into specific arguments using `abi.decode`, so multiple
     *                          up-keeps can be registered on the  same contract and easily differentiated by the
     *                          contract.
     * @return  upkeepNeeded    A boolean to indicate whether the keeper should call `performUpkeep` or not.
     * @return  performData    The bytes that the keeper should call `performUpkeep` with, if upkeep is needed. If you
     *                          would like to encode data to decode later, try `abi.encode`.
     */
    function checkUpkeep(bytes calldata _checkData) external returns (bool upkeepNeeded, bytes memory performData);

    /**
     * @notice  The method that is actually executed by the keepers, via the registry. The data returned by the
     *          `checkUpkeep` simulation will be passed into this method to actually be executed.
     * @dev     The input to this method should not be trusted, and the caller of the method should not even be
     *          restricted to any single registry. Anyone should be able call it, and the input should be validated,
     *          there is no guarantee that the data passed in is the _performData returned from checkUpkeep. This could
     *          happen due to malicious keepers, racing keepers, or simply a state change while the `performUpkeep`
     *          transaction is waiting for confirmation. Always validate the data passed in.
     * @param   _performData    The data which was passed back from the `_checkData` simulation. If it is encoded, it
     *                          can easily be decoded into other types by calling `abi.decode`. This data should not be
     *                          trusted, and should be validated against the contract's current state.
     */
    function performUpkeep(bytes calldata _performData) external;
}
