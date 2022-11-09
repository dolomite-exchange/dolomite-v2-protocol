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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { AccountBalanceHelper } from "./AccountBalanceHelper.sol";


/**
 * @title AccountActionHelper
 * @author Dolomite
 *
 * Library contract that makes specific actions easy to call
 */
library AccountActionHelper {

    // ============ Constants ============

    bytes32 constant FILE = "AccountActionHelper";

    // ============ Functions ============

    function deposit(
        IDolomiteMargin _dolomiteMargin,
        address _accountOwner,
        address _fromAccount,
        uint256 _toAccountIndex,
        uint256 _marketId,
        Types.AssetAmount memory _amount
    ) internal {
        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info({
        owner: _accountOwner,
        number: _toAccountIndex
        });

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Deposit,
            accountId: 0,
            amount: _amount,
            primaryMarketId: _marketId,
            secondaryMarketId: 0,
            otherAddress: _fromAccount,
            otherAccountId: 0,
            data: bytes("")
        });

        _dolomiteMargin.operate(accounts, actions);
    }

    /**
     *  Withdraws `_marketId` from `_fromAccount` to `_toAccount`
     */
    function withdraw(
        IDolomiteMargin _dolomiteMargin,
        address _accountOwner,
        uint256 _fromAccountIndex,
        address _toAccount,
        uint256 _marketId,
        Types.AssetAmount memory _amount,
        AccountBalanceHelper.BalanceCheckFlag _balanceCheckFlag
    ) internal {
        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info({
            owner: _accountOwner,
            number: _fromAccountIndex
        });

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Withdraw,
            accountId: 0,
            amount: _amount,
            primaryMarketId: _marketId,
            secondaryMarketId: 0,
            otherAddress: _toAccount,
            otherAccountId: 0,
            data: bytes("")
        });

        _dolomiteMargin.operate(accounts, actions);

        if (
            _balanceCheckFlag == AccountBalanceHelper.BalanceCheckFlag.Both
            || _balanceCheckFlag == AccountBalanceHelper.BalanceCheckFlag.From
        ) {
            AccountBalanceHelper.verifyBalanceIsNonNegative(
                _dolomiteMargin,
                accounts[0].owner,
                _fromAccountIndex,
                _marketId
            );
        }
    }

    function encodeTradeAction(
        uint256 _fromAccountIndex,
        uint256 _toAccountIndex,
        uint256 _primaryMarketId,
        uint256 _secondaryMarketId,
        address _traderAddress,
        uint256 _amountInWei,
        uint256 _amountOutWei
    ) internal pure returns (Actions.ActionArgs memory) {
        return Actions.ActionArgs({
        actionType : Actions.ActionType.Trade,
        accountId : _fromAccountIndex,
        // solium-disable-next-line arg-overflow
        amount : Types.AssetAmount(true, Types.AssetDenomination.Wei, Types.AssetReference.Delta, _amountInWei),
        primaryMarketId : _primaryMarketId,
        secondaryMarketId : _secondaryMarketId,
        otherAddress : _traderAddress,
        otherAccountId : _toAccountIndex,
        data : abi.encode(_amountOutWei)
        });
    }

    function encodeTransferAction(
        uint256 _fromAccountId,
        uint256 _toAccountId,
        uint256 _marketId,
        uint256 _amount
    ) internal pure returns (Actions.ActionArgs memory) {
        Types.AssetAmount memory assetAmount;
        if (_amount == uint(- 1)) {
            assetAmount = Types.AssetAmount(
                true,
                Types.AssetDenomination.Wei,
                Types.AssetReference.Target,
                0
            );
        } else {
            assetAmount = Types.AssetAmount(
                false,
                Types.AssetDenomination.Wei,
                Types.AssetReference.Delta,
                _amount
            );
        }
        return Actions.ActionArgs({
            actionType : Actions.ActionType.Transfer,
            accountId : _fromAccountId,
            amount : assetAmount,
            primaryMarketId : _marketId,
            secondaryMarketId : uint(- 1),
            otherAddress : address(0),
            otherAccountId : _toAccountId,
            data : bytes("")
        });
    }
}