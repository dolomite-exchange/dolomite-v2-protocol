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

import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


/**
 * @title   IBorrowPositionProxyV1
 * @author  Dolomite
 * @notice  Interface for allowing the transfer of assets between account numbers. Emits an event to allow for easy
 *          indexing of a subgraph for getting active borrow positions.
 */
interface IBorrowPositionProxyV1 {

    // ========================= Events =========================

    event BorrowPositionOpen(
        address indexed _borrower,
        uint256 indexed _borrowAccountNumber
    );

    // ========================= Functions =========================

    /**
     * @param _fromAccountNumber    The index from which `msg.sender` will be sourcing the deposit
     * @param _toAccountNumber      The index into which `msg.sender` will be depositing
     * @param _collateralMarketId   The ID of the market being deposited
     * @param _amountWei            The amount, in Wei, to deposit
     * @param _balanceCheckFlag     Flag used to check if `_fromAccountNumber`, `_toAccountNumber`, or both accounts can
     *                              go negative after the transfer settles. Setting the flag to
     *                              `AccountBalanceLib.BalanceCheckFlag.None=3` results in neither account being
     *                              checked.
     */
    function openBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _collateralMarketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @notice  This method can only be called once the user's debt has been reduced to zero. Sends all
     *          `_collateralMarketIds` from `_borrowAccountNumber` to `_toAccountNumber`.
     *
     * @param _borrowAccountNumber  The index from which `msg.sender` collateral will be withdrawn
     * @param _toAccountNumber      The index into which `msg.sender` will be depositing leftover collateral
     * @param _collateralMarketIds  The IDs of the markets being withdrawn, to close the position
     */
    function closeBorrowPosition(
        uint256 _borrowAccountNumber,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    ) external;

    /**
     * @param _fromAccountNumber    The index from which `msg.sender` will be withdrawing assets
     * @param _toAccountNumber      The index into which `msg.sender` will be depositing assets
     * @param _marketId             The ID of the market being transferred
     * @param _amountWei            The amount, in Wei, to transfer
     * @param _balanceCheckFlag     Flag used to check if `_fromAccountNumber`, `_toAccountNumber`, or both accounts can
     *                              go negative after the transfer settles. Setting the flag to
     *                              `AccountBalanceLib.BalanceCheckFlag.None=3` results in neither account being
     *                              checked.
     */
    function transferBetweenAccounts(
        uint256 _fromAccountNumber,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @param _fromAccountNumber    The index from which `msg.sender` will be depositing assets
     * @param _borrowAccountNumber  The index of the borrow position for that will receive the deposited assets
     * @param _marketId             The ID of the market being transferred
     * @param _balanceCheckFlag     Flag used to check if `_fromAccountNumber`, `_borrowAccountNumber`, or both accounts
     *                              can go negative after the transfer settles. Setting the flag to
     *                              `AccountBalanceLib.BalanceCheckFlag.None=3` results in neither account being
     *                              checked.
     */
    function repayAllForBorrowPosition(
        uint256 _fromAccountNumber,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;
}
