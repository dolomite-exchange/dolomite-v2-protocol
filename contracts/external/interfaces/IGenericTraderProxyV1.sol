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

import { IGenericTraderProxyBase } from "./IGenericTraderProxyBase.sol";


/**
 * @title IGenericTraderProxyV1
 * @author Dolomite
 *
 * Trader proxy interface for trading assets using any trader from msg.sender
 */
contract IGenericTraderProxyV1 is IGenericTraderProxyBase {

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

    // ============ Functions ============

    /**
     * @dev     Swaps an exact amount of input (specified in the `_amountWeisPath[0]` parameter) for at least
     *          `_amountWeisPath[_amountWeisPath.length - 1]` of output.
     *
     * @param _tradeAccountNumber           The account number to use for msg.sender's trade
     * @param _marketIdsPath                The path of market IDs to use for each trade action. Length should be equal
     *                                      to `_tradersPath.length + 1`.
     * @param _amountWeisPath               The path of amounts (in wei) to use for each trade action. Length should be
     *                                      equal to `_tradersPath.length + 1`. Setting a value to `uint(-1)` will use
     *                                      the user's full balance for the trade at that part in the path. Caution must
     *                                      be taken when using this parameter for frontends that call this function.
     * @param _tradersPath                  The path of traders to use for each trade action. Length should be equal to
     *                                      `_marketIdsPath.length - 1` and `_amountWeisPath.length - 1`.
     * @param _makerAccounts                The accounts that will be used for the maker side of the trades involving
     *                                      `TraderType.InternalLiquidity`.
     */
    function swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256[] calldata _amountWeisPath,
        IGenericTraderProxyBase.TraderParam[] calldata _tradersPath,
        Account.Info[] calldata _makerAccounts
    )
        external;

    /**
     * @dev     The same function as `swapExactInputForOutput`, but allows the caller transfer collateral and modify
     *          their position's expiration in the same transaction.
     *
     * @param _tradeAccountNumber           The account number to use for msg.sender's trade
     * @param _marketIdsPath                The path of market IDs to use for each trade action. Length should be equal
     *                                      to `_tradersPath.length + 1`.
     * @param _amountWeisPath               The path of amounts (in wei) to use for each trade action. Length should be
     *                                      equal to `_tradersPath.length + 1`. Setting a value to `uint(-1)` will use
     *                                      the user's full balance for the trade at that part in the path. Caution must
     *                                      be taken when using this parameter for frontends that call this function.
     * @param _tradersPath                  The path of traders to use for each trade action. Length should be equal to
     *                                      `_marketIdsPath.length - 1` and `_amountWeisPath.length - 1`.
     * @param _makerAccounts                The accounts that will be used for the maker side of the trades involving
                                            `TraderType.InternalLiquidity`.
     * @param _transferCollateralParams     The parameters for transferring collateral in/out of the
     *                                      `_tradeAccountNumber` once the trades settle. One of
     *                                      `_params.fromAccountNumber` or `_params.toAccountNumber` must be equal to
     *                                      `_tradeAccountNumber`.
     * @param _expiryParams                 The parameters for modifying the expiration of the debt in the position.
     */
    function swapExactInputForOutputAndModifyPosition(
        uint256 _tradeAccountNumber,
        uint256[] calldata _marketIdsPath,
        uint256[] calldata _amountWeisPath,
        IGenericTraderProxyBase.TraderParam[] calldata _tradersPath,
        Account.Info[] calldata _makerAccounts,
        TransferCollateralParam calldata _transferCollateralParams,
        ExpiryParam calldata _expiryParams
    )
        external;
}
