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
 * @title   IBorrowPositionProxyV2
 * @author  Dolomite
 * @notice  Similar to IBorrowPositionProxyV1, but allows for transferring positions/assets between wallets. Useful
 *          for wallets that need to manage isolated assets in an owned-vault. All of the below write-functions require
 *          the caller to be authorized to make an invocation.
 */
interface IBorrowPositionProxyV2 {

    // ========================= Functions =========================

    /**
     * @notice  Opens a borrow position for the given `to account` while sourcing funds from `from account`. The caller
     *          must be authorized to call this function.
     *
     * @param _fromAccountOwner     The account from which the user will be sourcing the deposit
     * @param _fromAccountNumber    The index from which `_toAccountOwner` will be sourcing the deposit
     * @param _toAccountOwner       The account into which `_fromAccountOwner` will be depositing
     * @param _toAccountNumber      The index into which `_fromAccountOwner` will be depositing
     * @param _collateralMarketId   The ID of the market being deposited
     * @param _amountWei            The amount, in Wei, to deposit
     * @param _balanceCheckFlag     Flag used to check if `_fromAccountNumber`, `_toAccountNumber`, or both accounts can
     *                              go negative after the transfer settles. Setting the flag to
     *                              `AccountBalanceLib.BalanceCheckFlag.None=3` results in neither account being
     *                              checked.
     */
    function openBorrowPositionWithDifferentAccounts(
        address _fromAccountOwner,
        uint256 _fromAccountNumber,
        address _toAccountOwner,
        uint256 _toAccountNumber,
        uint256 _collateralMarketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @notice  This method can only be called once the user's debt has been reduced to zero. Sends all
     *          `_collateralMarketIds` from `_borrowAccountNumber` to `_toAccountNumber`. The caller must be authorized
     *           to call this function.
     *
     * @param _borrowAccountOwner   The account from which collateral will be withdrawn
     * @param _borrowAccountNumber  The index from which `msg.sender` collateral will be withdrawn
     * @param _toAccountOwner       The account into which `_borrowAccountOwner` will be depositing leftover collateral
     * @param _toAccountNumber      The index into which `_borrowAccountOwner` will be depositing leftover collateral
     * @param _collateralMarketIds  The IDs of the markets being withdrawn, to close the position
     */
    function closeBorrowPositionWithDifferentAccounts(
        address _borrowAccountOwner,
        uint256 _borrowAccountNumber,
        address _toAccountOwner,
        uint256 _toAccountNumber,
        uint256[] calldata _collateralMarketIds
    ) external;

    /**
     * @notice  Transfers assets to a given `to account` while sourcing funds from `from account`. The caller must be
     *          authorized to call this function.
     *
     * @param _fromAccountOwner     The account from which assets will be withdrawn
     * @param _fromAccountNumber    The index from which `msg.sender` will be withdrawing assets
     * @param _toAccountOwner       The account to which assets will be deposited
     * @param _toAccountNumber      The index into which `msg.sender` will be depositing assets
     * @param _marketId             The ID of the market being transferred
     * @param _amountWei            The amount, in Wei, to transfer
     * @param _balanceCheckFlag     Flag used to check if `_fromAccountNumber`, `_toAccountNumber`, or both accounts can
     *                              go negative after the transfer settles. Setting the flag to
     *                              `AccountBalanceLib.BalanceCheckFlag.None=3` results in neither account being
     *                              checked.
     */
    function transferBetweenAccountsWithDifferentAccounts(
        address _fromAccountOwner,
        uint256 _fromAccountNumber,
        address _toAccountOwner,
        uint256 _toAccountNumber,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @notice  Repays a borrow position for the given `borrow account` while sourcing funds from `from account`. The
     *          caller must be authorized to call this function.
     *
     * @param _fromAccountOwner     The account from which assets will be withdrawn for repayment
     * @param _fromAccountNumber    The index from which `msg.sender` will be depositing assets
     * @param _borrowAccountOwner   The account of the borrow position that will receive the deposited assets
     * @param _borrowAccountNumber  The index of the borrow position for that will receive the deposited assets
     * @param _marketId             The ID of the market being transferred
     * @param _balanceCheckFlag     Flag used to check if `_fromAccountNumber`, `_borrowAccountNumber`, or both accounts
     *                              can go negative after the transfer settles. Setting the flag to
     *                              `AccountBalanceLib.BalanceCheckFlag.None=3` results in neither account being
     *                              checked.
     */
    function repayAllForBorrowPositionWithDifferentAccounts(
        address _fromAccountOwner,
        uint256 _fromAccountNumber,
        address _borrowAccountOwner,
        uint256 _borrowAccountNumber,
        uint256 _marketId,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;
}
