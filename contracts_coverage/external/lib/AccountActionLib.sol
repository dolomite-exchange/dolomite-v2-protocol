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

import { IExpiry } from "../interfaces/IExpiry.sol";

import { AccountBalanceLib } from "./AccountBalanceLib.sol";


/**
 * @title AccountActionLib
 * @author Dolomite
 *
 * Library contract that makes specific actions easy to call
 */
library AccountActionLib {

    // ============ Constants ============

    bytes32 private constant FILE = "AccountActionLib";

    uint256 constant ALL = uint256(-1);

    // ============ Functions ============

    function all() internal pure returns (uint256) {
        return ALL;
    }

    // ========================= Operation Functions =========================

    function deposit(
        IDolomiteMargin _dolomiteMargin,
        address _accountOwner,
        address _fromAccount,
        uint256 _toAccountNumber,
        uint256 _marketId,
        Types.AssetAmount memory _amount
    ) internal {
        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info({
            owner: _accountOwner,
            number: _toAccountNumber
        });

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = encodeDepositAction(
            /* _accountId = */ 0, // solium-disable-line indentation
            _marketId,
            _amount,
            _fromAccount
        );

        _dolomiteMargin.operate(accounts, actions);
    }

    /**
     *  Withdraws `_marketId` from `_fromAccount` to `_toAccount`
     */
    function withdraw(
        IDolomiteMargin _dolomiteMargin,
        address _accountOwner,
        uint256 _fromAccountNumber,
        address _toAccount,
        uint256 _marketId,
        Types.AssetAmount memory _amount,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) internal {
        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info({
            owner: _accountOwner,
            number: _fromAccountNumber
        });

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = encodeWithdrawalAction(
            /* _accountId = */ 0, // solium-disable-line indentation
            _marketId,
            _amount,
            _toAccount
        );

        _dolomiteMargin.operate(accounts, actions);

        if (
            _balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            AccountBalanceLib.verifyBalanceIsNonNegative(
                _dolomiteMargin,
                accounts[0].owner,
                _fromAccountNumber,
                _marketId
            );
        }
    }

    /**
     * Transfers `_marketId` from `_fromAccount` to `_toAccount`
     */
    function transfer(
        IDolomiteMargin _dolomiteMargin,
        address _fromAccountOwner,
        uint256 _fromAccountNumber,
        address _toAccountOwner,
        uint256 _toAccountNumber,
        uint256 _marketId,
        Types.AssetAmount memory _amount,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) internal {
        Account.Info[] memory accounts = new Account.Info[](2);
        accounts[0] = Account.Info({
            owner: _fromAccountOwner,
            number: _fromAccountNumber
        });
        accounts[1] = Account.Info({
            owner: _toAccountOwner,
            number: _toAccountNumber
        });

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](1);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Transfer,
            accountId: 0,
            amount: _amount,
            primaryMarketId: _marketId,
            secondaryMarketId: 0,
            otherAddress: address(0),
            otherAccountId: 1,
            data: bytes("")
        });

        _dolomiteMargin.operate(accounts, actions);

        if (
            _balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            AccountBalanceLib.verifyBalanceIsNonNegative(
                _dolomiteMargin,
                _fromAccountOwner,
                _fromAccountNumber,
                _marketId
            );
        }

        if (
            _balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.To
        ) {
            AccountBalanceLib.verifyBalanceIsNonNegative(
                _dolomiteMargin,
                _toAccountOwner,
                _toAccountNumber,
                _marketId
            );
        }
    }

    // ========================= Encoding Functions =========================

    function encodeCallAction(
        uint256 _accountId,
        address _callee,
        bytes memory _callData
    ) internal pure returns (Actions.ActionArgs memory) {
        return Actions.ActionArgs({
            actionType : Actions.ActionType.Call,
            accountId : _accountId,
            // solium-disable-next-line arg-overflow
            amount : Types.AssetAmount(true, Types.AssetDenomination.Wei, Types.AssetReference.Delta, 0),
            primaryMarketId : 0,
            secondaryMarketId : 0,
            otherAddress : _callee,
            otherAccountId : 0,
            data : _callData
        });
    }

    function encodeDepositAction(
        uint256 _accountId,
        uint256 _marketId,
        Types.AssetAmount memory _amount,
        address _fromAccount
    ) internal pure returns (Actions.ActionArgs memory) {
        return Actions.ActionArgs({
            actionType: Actions.ActionType.Deposit,
            accountId: _accountId,
            amount: _amount,
            primaryMarketId: _marketId,
            secondaryMarketId: 0,
            otherAddress: _fromAccount,
            otherAccountId: 0,
            data: bytes("")
        });
    }

    function encodeExpirationAction(
        Account.Info memory _account,
        uint256 _accountId,
        uint256 _owedMarketId,
        address _expiry,
        uint256 _expiryTimeDelta
    ) internal pure returns (Actions.ActionArgs memory) {
        if (_expiryTimeDelta == uint32(_expiryTimeDelta)) { /* FOR COVERAGE TESTING */ }
        Require.that(_expiryTimeDelta == uint32(_expiryTimeDelta),
            FILE,
            "invalid expiry time"
        );

        IExpiry.SetExpiryArg[] memory expiryArgs = new IExpiry.SetExpiryArg[](1);
        expiryArgs[0] = IExpiry.SetExpiryArg({
            account : _account,
            marketId : _owedMarketId,
            timeDelta : uint32(_expiryTimeDelta),
            forceUpdate : true
        });

        return encodeCallAction(
            _accountId,
            _expiry,
            abi.encode(IExpiry.CallFunctionType.SetExpiry, expiryArgs)
        );
    }

    function encodeExpiryLiquidateAction(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        uint256 _owedMarketId,
        uint256 _heldMarketId,
        address _expiryProxy,
        uint32 _expiry,
        uint256 _solidHeldUpdateWithReward,
        uint256 _owedWeiToLiquidate,
        bool _flipMarkets
    ) internal pure returns (Actions.ActionArgs memory) {
        Types.AssetAmount memory assetAmount;
        if (!_flipMarkets) {
            // Make the amount positive so the liquid account's owedMarket goes up (gets repaid).
            assetAmount = Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: _owedWeiToLiquidate
            });
        } else {
          /*assert(_flipMarkets);*/
            // Make the amount negative so the liquid account's heldMarket goes down (gets spent to repay owedMarket).
            assetAmount = Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: _solidHeldUpdateWithReward
            });
        }

        return Actions.ActionArgs({
            actionType: Actions.ActionType.Trade,
            accountId: _solidAccountId,
            amount: assetAmount,
            primaryMarketId: !_flipMarkets ? _owedMarketId : _heldMarketId,
            secondaryMarketId: !_flipMarkets ? _heldMarketId : _owedMarketId,
            otherAddress: _expiryProxy,
            otherAccountId: _liquidAccountId,
            data: abi.encode(_owedMarketId, _expiry)
        });
    }

    function encodeInternalTradeAction(
        uint256 _fromAccountId,
        uint256 _toAccountId,
        uint256 _primaryMarketId,
        uint256 _secondaryMarketId,
        address _traderAddress,
        uint256 _amountInWei,
        uint256 _amountOutMinWei
    ) internal pure returns (Actions.ActionArgs memory) {
        return Actions.ActionArgs({
            actionType : Actions.ActionType.Trade,
            accountId : _fromAccountId,
            // solium-disable-next-line arg-overflow
            amount : Types.AssetAmount(true, Types.AssetDenomination.Wei, Types.AssetReference.Delta, _amountInWei),
            primaryMarketId : _primaryMarketId,
            secondaryMarketId : _secondaryMarketId,
            otherAddress : _traderAddress,
            otherAccountId : _toAccountId,
            data : abi.encode(_amountOutMinWei)
        });
    }

    function encodeInternalTradeActionWithCustomData(
        uint256 _fromAccountId,
        uint256 _toAccountId,
        uint256 _primaryMarketId,
        uint256 _secondaryMarketId,
        address _traderAddress,
        uint256 _amountInWei,
        bytes memory _orderData
    ) internal pure returns (Actions.ActionArgs memory) {
        // internal trades calculate inputAmount based on `_toAccountId` (the maker account), so the sign should be
        // positive to reflect this
        return Actions.ActionArgs({
            actionType: Actions.ActionType.Trade,
            accountId: _fromAccountId,
            amount: Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: _amountInWei
            }),
            primaryMarketId: _primaryMarketId,
            secondaryMarketId: _secondaryMarketId,
            otherAddress: _traderAddress,
            otherAccountId: _toAccountId,
            data: _orderData
        });
    }

    function encodeLiquidateAction(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        uint256 _owedMarketId,
        uint256 _heldMarketId,
        uint256 _owedWeiToLiquidate
    ) internal pure returns (Actions.ActionArgs memory) {
        return Actions.ActionArgs({
            actionType: Actions.ActionType.Liquidate,
            accountId: _solidAccountId,
            amount: Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: _owedWeiToLiquidate
            }),
            primaryMarketId: _owedMarketId,
            secondaryMarketId: _heldMarketId,
            otherAddress: address(0),
            otherAccountId: _liquidAccountId,
            data: new bytes(0)
        });
    }

    function encodeExternalSellAction(
        uint256 _fromAccountId,
        uint256 _primaryMarketId,
        uint256 _secondaryMarketId,
        address _trader,
        uint256 _amountInWei,
        uint256 _amountOutMinWei,
        bytes memory _orderData
    ) internal pure returns (Actions.ActionArgs memory) {
        return Actions.ActionArgs({
            actionType : Actions.ActionType.Sell,
            accountId : _fromAccountId,
            amount : Types.AssetAmount({
                sign : false,
                denomination : Types.AssetDenomination.Wei,
                ref : _amountInWei == ALL ? Types.AssetReference.Target : Types.AssetReference.Delta,
                value : _amountInWei == ALL ? 0 : _amountInWei
            }),
            primaryMarketId : _primaryMarketId,
            secondaryMarketId : _secondaryMarketId,
            otherAddress : _trader,
            otherAccountId : 0,
            data : abi.encode(_amountOutMinWei, _orderData)
        });
    }

    function encodeTransferAction(
        uint256 _fromAccountId,
        uint256 _toAccountId,
        uint256 _marketId,
        uint256 _amountWei
    ) internal pure returns (Actions.ActionArgs memory) {
        Types.AssetAmount memory assetAmount;
        if (_amountWei == uint(- 1)) {
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
                _amountWei
            );
        }
        return Actions.ActionArgs({
            actionType : Actions.ActionType.Transfer,
            accountId : _fromAccountId,
            amount : assetAmount,
            primaryMarketId : _marketId,
            secondaryMarketId : 0,
            otherAddress : address(0),
            otherAccountId : _toAccountId,
            data : bytes("")
        });
    }

    function encodeWithdrawalAction(
        uint256 _accountId,
        uint256 _marketId,
        Types.AssetAmount memory _amount,
        address _toAccount
    ) internal pure returns (Actions.ActionArgs memory) {
        return Actions.ActionArgs({
            actionType: Actions.ActionType.Withdraw,
            accountId: _accountId,
            amount: _amount,
            primaryMarketId: _marketId,
            secondaryMarketId: 0,
            otherAddress: _toAccount,
            otherAccountId: 0,
            data: bytes("")
        });
    }
}
