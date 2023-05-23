/*

    Copyright 2023 Dolomite.

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

import { Events } from "../../protocol/lib/Events.sol";


/**
 * @title IMarginPositionRegistry
 * @author Dolomite
 *
 * An implementation for an upgradeable proxy for emitting margin position-related events. Useful for indexing margin
 * positions from a singular address.
 */
interface IMarginPositionRegistry {

    // ============ Events ============

    /**
     * @notice This is emitted when a margin position is initially opened
     *
     * @param accountOwner          The address of the account that opened the position
     * @param accountNumber         The account number of the account that opened the position
     * @param inputToken            The token that was sold to purchase the collateral. This should be the owed token
     * @param outputToken           The token that was purchased with the debt. This should be the held token
     * @param depositToken          The token that was deposited as collateral. This should be the held token
     * @param inputBalanceUpdate    The amount of inputToken that was sold to purchase the outputToken
     * @param outputBalanceUpdate   The amount of outputToken that was purchased with the inputToken
     * @param marginDepositUpdate   The amount of depositToken that was deposited as collateral
     */
    event MarginPositionOpen(
        address indexed accountOwner,
        uint256 indexed accountNumber,
        address inputToken,
        address outputToken,
        address depositToken,
        Events.BalanceUpdate inputBalanceUpdate,
        Events.BalanceUpdate outputBalanceUpdate,
        Events.BalanceUpdate marginDepositUpdate
    );

    /**
     * @notice This is emitted when a margin position is (partially) closed
     *
     * @param accountOwner              The address of the account that opened the position
     * @param accountNumber             The account number of the account that opened the position
     * @param inputToken                The token that was sold to purchase the debt. This should be the held token
     * @param outputToken               The token that was purchased with the collateral. This should be the owed token
     * @param withdrawalToken           The token that was withdrawn as collateral. This should be the held token
     * @param inputBalanceUpdate        The amount of inputToken that was sold to purchase the outputToken
     * @param outputBalanceUpdate       The amount of outputToken that was purchased with the inputToken
     * @param marginWithdrawalUpdate    The amount of withdrawalToken that was deposited as collateral
     */
    event MarginPositionClose(
        address indexed accountOwner,
        uint256 indexed accountNumber,
        address inputToken,
        address outputToken,
        address withdrawalToken,
        Events.BalanceUpdate inputBalanceUpdate,
        Events.BalanceUpdate outputBalanceUpdate,
        Events.BalanceUpdate marginWithdrawalUpdate
    );

    // ============ Functions ============

    /**
     * @notice Emits a MarginPositionOpen event
     *
     * @param _accountOwner          The address of the account that opened the position
     * @param _accountNumber         The account number of the account that opened the position
     * @param _inputToken            The token that was sold to purchase the collateral. This should be the owed token
     * @param _outputToken           The token that was purchased with the debt. This should be the held token
     * @param _depositToken          The token that was deposited as collateral. This should be the held token
     * @param _inputBalanceUpdate    The amount of inputToken that was sold to purchase the outputToken
     * @param _outputBalanceUpdate   The amount of outputToken that was purchased with the inputToken
     * @param _marginDepositUpdate   The amount of depositToken that was deposited as collateral
     */
    function emitMarginPositionOpen(
        address _accountOwner,
        uint256 _accountNumber,
        address _inputToken,
        address _outputToken,
        address _depositToken,
        Events.BalanceUpdate calldata _inputBalanceUpdate,
        Events.BalanceUpdate calldata _outputBalanceUpdate,
        Events.BalanceUpdate calldata _marginDepositUpdate
    )
    external;

    /**
     * @notice Emits a MarginPositionClose event
     *
     * @param _accountOwner             The address of the account that opened the position
     * @param _accountNumber            The account number of the account that opened the position
     * @param _inputToken               The token that was sold to purchase the debt. This should be the held token
     * @param _outputToken              The token that was purchased with the collateral. This should be the owed token
     * @param _withdrawalToken          The token that was withdrawn as collateral. This should be the held token
     * @param _inputBalanceUpdate       The amount of inputToken that was sold to purchase the outputToken
     * @param _outputBalanceUpdate      The amount of outputToken that was purchased with the inputToken
     * @param _marginWithdrawalUpdate   The amount of withdrawalToken that was deposited as collateral
     */
    function emitMarginPositionClose(
        address _accountOwner,
        uint256 _accountNumber,
        address _inputToken,
        address _outputToken,
        address _withdrawalToken,
        Events.BalanceUpdate calldata _inputBalanceUpdate,
        Events.BalanceUpdate calldata _outputBalanceUpdate,
        Events.BalanceUpdate calldata _marginWithdrawalUpdate
    )
    external;
}
