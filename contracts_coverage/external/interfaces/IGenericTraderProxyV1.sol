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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";

import { IGenericTraderProxyBase } from "./IGenericTraderProxyBase.sol";


/**
 * @title IGenericTraderProxyV1
 * @author Dolomite
 *
 * Trader proxy interface for trading assets using any trader from msg.sender
 */
contract IGenericTraderProxyV1 is IGenericTraderProxyBase {

    // ============ Events ============

    event ZapExecuted(
        address indexed _accountOwner,
        uint256 _accountNumber,
        uint256[] _marketIdsPath,
        TraderParam[] _tradersPath
    );

    // ============ Structs ============

    struct TransferAmount {
        /// @dev The market ID to transfer
        uint256 marketId;
        /// @dev Note, setting to uint(-1) will transfer all of the user's balance.
        uint256 amountWei;
    }

    struct TransferCollateralParam {
        /// @dev The account number from which collateral will be transferred.
        uint256 fromAccountNumber;
        /// @dev The account number to which collateral will be transferred.
        uint256 toAccountNumber;
        /// @dev The transfers to execute after all of the trades.
        TransferAmount[] transferAmounts;
    }

    struct ExpiryParam {
        /// @dev The market ID whose expiry will be updated.
        uint256 marketId;
        /// @dev The new expiry time delta for the market. Setting this to `0` will reset the expiration.
        uint32 expiryTimeDelta;
    }

    struct UserConfig {
        uint256 deadline;
        AccountBalanceLib.BalanceCheckFlag balanceCheckFlag;
    }

    // ============ Functions ============

    /**
     * @dev     Swaps an exact amount of input (specified in the `_amountWeisPath[0]` parameter) for at least
     *          `_amountWeisPath[_amountWeisPath.length - 1]` of output.
     *
     * @param _tradeAccountNumber           The account number to use for msg.sender's trade
     * @param _marketIdsPath                The path of market IDs to use for each trade action. Length should be equal
     *                                      to `_tradersPath.length + 1`.
     * @param _inputAmountWei               The input amount (in wei) to use for the initial trade action. Setting this
     *                                      value to `uint(-1)` will use the user's full balance.
     * @param _minOutputAmountWei           The minimum output amount expected to be received by the user.
     * @param _tradersPath                  The path of traders to use for each trade action. Length should be equal to
     *                                      `_marketIdsPath.length - 1` and `_amountWeisPath.length - 1`.
     * @param _makerAccounts                The accounts that will be used for the maker side of the trades involving
     *                                      `TraderType.InternalLiquidity`.
     * @param _userConfig                   The user configuration for the trade. Setting the `balanceCheckFlag` to
     *                                      `BalanceCheckFlag.From` will check that the user's `_tradeAccountNumber`
     *                                      is non-negative after the trade. Setting the `balanceCheckFlag` to
     *                                      `BalanceCheckFlag.To` has no effect.
     */
    function swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        TraderParam[] calldata _tradersPath,
        Account.Info[] calldata _makerAccounts,
        UserConfig calldata _userConfig
    )
        external;

    /**
     * @dev     The same function as `swapExactInputForOutput`, but allows the caller transfer collateral and modify
     *          their position's expiration in the same transaction.
     *
     * @param _tradeAccountNumber           The account number to use for msg.sender's trade
     * @param _marketIdsPath                The path of market IDs to use for each trade action. Length should be equal
     *                                      to `_tradersPath.length + 1`.
     * @param _inputAmountWei               The input amount (in wei) to use for the initial trade action. Setting this
     *                                      value to `uint(-1)` will use the user's full balance.
     * @param _minOutputAmountWei           The minimum output amount expected to be received by the user.
     * @param _tradersPath                  The path of traders to use for each trade action. Length should be equal to
     *                                      `_marketIdsPath.length - 1` and `_amountWeisPath.length - 1`.
     * @param _makerAccounts                The accounts that will be used for the maker side of the trades involving
                                            `TraderType.InternalLiquidity`.
     * @param _transferCollateralParams     The parameters for transferring collateral in/out of the
     *                                      `_tradeAccountNumber` once the trades settle. One of
     *                                      `_params.fromAccountNumber` or `_params.toAccountNumber` must be equal to
     *                                      `_tradeAccountNumber`.
     * @param _expiryParams                 The parameters for modifying the expiration of the debt in the position.
     * @param _userConfig                   The user configuration for the trade. Setting the `balanceCheckFlag` to
     *                                      `BalanceCheckFlag.From` will check that the user's balance for inputMarket
     *                                      for `_tradeAccountNumber` is non-negative after the trade. Setting the
     *                                      `balanceCheckFlag` to `BalanceCheckFlag.To` will check that the user's
     *                                      balance for each `transferMarket` for `transferAccountNumber` is
     *                                      non-negative after.
     */
    function swapExactInputForOutputAndModifyPosition(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        IGenericTraderProxyBase.TraderParam[] calldata _tradersPath,
        Account.Info[] calldata _makerAccounts,
        TransferCollateralParam calldata _transferCollateralParams,
        ExpiryParam calldata _expiryParams,
        UserConfig calldata _userConfig
    )
        external;
}
