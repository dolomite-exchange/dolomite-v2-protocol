/*

    Copyright 2021 Dolomite.

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


interface IDepositWithdrawalProxy {

    /**
     * @param _toAccountIndex   The index into which `msg.sender` will be depositing
     * @param _marketId         The ID of the market being deposited
     * @param _amountWei        The amount, in Wei, to deposit. Use `uint(-1)` to deposit `msg.sender`'s entire balance
     */
    function depositWei(
        uint256 _toAccountIndex,
        uint256 _marketId,
        uint256 _amountWei
    ) external;

    /**
     * Same as `depositWei` but converts the `msg.sender`'s sent ETH into WETH before depositing into `DolomiteMargin`.
     *
     * @param _toAccountIndex The index into which `msg.sender` will be depositing
     */
    function depositETH(
        uint256 _toAccountIndex
    ) external payable;

    /**
     * @dev Same as `depositWei` but defaults to account index 0 to save additional call data
     *
     * @param _marketId     The ID of the market being deposited
     * @param _amountWei    The amount, in Wei, to deposit. Use `uint(-1)` to deposit `msg.sender`'s entire balance
     */
    function depositWeiIntoDefaultAccount(
        uint256 _marketId,
        uint256 _amountWei
    ) external;

    /**
     * Same as `depositWeiIntoDefaultAccount` but converts the `msg.sender`'s sent ETH into WETH before depositing into
     * `DolomiteMargin`.
     */
    function depositETHIntoDefaultAccount() external payable;

    /**
     * @param _fromAccountIndex The index from which `msg.sender` will be withdrawing
     * @param _marketId         The ID of the market being withdrawn
     * @param _amountWei        The amount, in Wei, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire
     *                          balance
     * @param _balanceCheckFlag Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that `_fromAccountIndex`
     *                          balance is non-negative after the withdrawal settles.
     */
    function withdrawWei(
        uint256 _fromAccountIndex,
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * Same as `withdrawWei` but for withdrawing ETH. The user will receive unwrapped ETH from DolomiteMargin.
     *
     * @param _fromAccountIndex     The index from which `msg.sender` will be withdrawing
     * @param _amountWei        The amount, in Wei, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire
     *                          balance.
     * @param _balanceCheckFlag Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that `_fromAccountIndex`
     *                          balance is non-negative after the withdrawal settles.
     */
    function withdrawETH(
        uint256 _fromAccountIndex,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @dev Same as `withdrawWei` but defaults to account index 0 to save additional call data
     *
     * @param _marketId         The ID of the market being withdrawn
     * @param _amountWei        The amount, in Wei, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire
     *                          balance
     * @param _balanceCheckFlag Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that `_fromAccountIndex`
     *                          balance is non-negative after the withdrawal settles.
     */
    function withdrawWeiFromDefaultAccount(
        uint256 _marketId,
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * Same as `withdrawWeiFromDefaultAccount` but for withdrawing ETH. The user will receive unwrapped ETH from
     * DolomiteMargin.
     *
     * @param _amountWei        The amount, in Wei, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire
     *                          balance
     * @param _balanceCheckFlag Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that `_fromAccountIndex`
     *                          balance is non-negative after the withdrawal settles.
     */
    function withdrawETHFromDefaultAccount(
        uint256 _amountWei,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @param _toAccountIndex   The index into which `msg.sender` will be depositing
     * @param _marketId         The ID of the market being deposited
     * @param _amountPar        The amount, in Par, to deposit.
     */
    function depositPar(
        uint256 _toAccountIndex,
        uint256 _marketId,
        uint256 _amountPar
    ) external;

    /**
     * @dev Same as `depositPar` but defaults to account index 0 to save additional call data
     *
     * @param _marketId     The ID of the market being deposited
     * @param _amountPar    The amount, in Par, to deposit.
     */
    function depositParIntoDefaultAccount(
        uint256 _marketId,
        uint256 _amountPar
    ) external;

    /**
     * @param _fromAccountIndex     The index from which `msg.sender` will be withdrawing
     * @param _marketId         The ID of the market being withdrawn
     * @param _amountPar        The amount, in Par, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire
     *                          balance
     * @param _balanceCheckFlag Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that `_fromAccountIndex`
     *                          balance is non-negative after the withdrawal settles.
     */
    function withdrawPar(
        uint256 _fromAccountIndex,
        uint256 _marketId,
        uint256 _amountPar,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;

    /**
     * @dev Same as `withdrawPar` but defaults to account index 0 to save additional call data
     *
     * @param _marketId         The ID of the market being withdrawn
     * @param _amountPar        The amount, in Par, to withdraw. Use `uint(-1)` to withdraw `msg.sender`'s entire balance
     * @param _balanceCheckFlag Use `BalanceCheckFlag.Both` or `BalanceCheckFlag.From` to check that `_fromAccountIndex`
     *                          balance is non-negative after the withdrawal settles.
     */
    function withdrawParFromDefaultAccount(
        uint256 _marketId,
        uint256 _amountPar,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external;
}
