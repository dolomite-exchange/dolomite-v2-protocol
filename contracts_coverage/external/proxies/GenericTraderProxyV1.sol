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

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Events } from "../../protocol/lib/Events.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { GenericTraderProxyBase } from "../helpers/GenericTraderProxyBase.sol";
import { HasLiquidatorRegistry } from "../helpers/HasLiquidatorRegistry.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IExpiry } from "../interfaces/IExpiry.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeUnwrapperTrader } from "../interfaces/IIsolationModeUnwrapperTrader.sol";
import { IIsolationModeWrapperTrader } from "../interfaces/IIsolationModeWrapperTrader.sol";
import { IMarginPositionRegistry } from "../interfaces/IMarginPositionRegistry.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


/**
 * @title   GenericTraderProxyV1
 * @author  Dolomite
 *
 * @dev Proxy contract for trading any asset from msg.sender
 */
contract GenericTraderProxyV1 is IGenericTraderProxyV1, GenericTraderProxyBase, OnlyDolomiteMargin, ReentrancyGuard {
    using Types for Types.Wei;

    // ============ Constants ============

    bytes32 private constant FILE = "GenericTraderProxyV1";
    uint256 private constant TRANSFER_ACCOUNT_ID = 2;

    // ============ Storage ============

    IExpiry public EXPIRY;
    IMarginPositionRegistry public MARGIN_POSITION_REGISTRY;

    // ============ Modifiers ============

    modifier notExpired(uint256 _deadline) {
        if (_deadline >= block.timestamp) { /* FOR COVERAGE TESTING */ }
        Require.that(_deadline >= block.timestamp,
            FILE,
            "Deadline expired",
            _deadline,
            block.timestamp
        );
        _;
    }

    // ============ Constructor ============

    constructor (
        address _expiry,
        address _marginPositionRegistry,
        address _dolomiteMargin
    )
    public
    OnlyDolomiteMargin(
        _dolomiteMargin
    )
    {
        EXPIRY = IExpiry(_expiry);
        MARGIN_POSITION_REGISTRY = IMarginPositionRegistry(_marginPositionRegistry);
    }

    // ============ Public Functions ============

    function swapExactInputForOutput(
        uint256 _tradeAccountNumber,
        uint256[] memory _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        TraderParam[] memory _tradersPath,
        Account.Info[] memory _makerAccounts,
        UserConfig memory _userConfig
    )
        public
        nonReentrant
        notExpired(_userConfig.deadline)
    {
        GenericTraderProxyCache memory cache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN,
            // unused for this function
            isMarginDeposit: false,
            // unused for this function
            otherAccountNumber: 0,
            // traders go right after the trade account and zap account
            traderAccountStartIndex: ZAP_ACCOUNT_ID + 1,
            actionsCursor: 0,
            // unused for this function
            inputBalanceWeiBeforeOperate: Types.zeroWei(),
            // unused for this function
            outputBalanceWeiBeforeOperate: Types.zeroWei(),
            // unused for this function
            transferBalanceWeiBeforeOperate: Types.zeroWei()
        });
        _validateMarketIdPath(_marketIdsPath);
        _validateAmountWeis(_inputAmountWei, _minOutputAmountWei);
        _validateTraderParams(
            cache,
            _marketIdsPath,
            _makerAccounts,
            _tradersPath
        );

        Account.Info[] memory accounts = _getAccounts(
            cache,
            _makerAccounts,
            /* _tradeAccountOwner = */ msg.sender, // solium-disable-line indentation
            _tradeAccountNumber
        );
        _validateZapAccount(cache, accounts[ZAP_ACCOUNT_ID], _marketIdsPath);

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](_getActionsLengthForTraderParams(_tradersPath));
        _appendTraderActions(
            accounts,
            actions,
            cache,
            _marketIdsPath,
            _inputAmountWei,
            _minOutputAmountWei,
            _tradersPath
        );

        cache.dolomiteMargin.operate(accounts, actions);

        if (
            _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            // Check that the trader's balance is not negative for the input market
            AccountBalanceLib.verifyBalanceIsNonNegative(
                cache.dolomiteMargin,
                accounts[TRADE_ACCOUNT_ID].owner,
                accounts[TRADE_ACCOUNT_ID].number,
                _marketIdsPath[0]
            );
        }
    }

    function swapExactInputForOutputAndModifyPosition(
        uint256 _tradeAccountNumber,
        uint256[] memory _marketIdsPath,
        uint256 _inputAmountWei,
        uint256 _minOutputAmountWei,
        TraderParam[] memory _tradersPath,
        Account.Info[] memory _makerAccounts,
        TransferCollateralParam memory _transferCollateralParams,
        ExpiryParam memory _expiryParams,
        UserConfig memory _userConfig
    )
        public
        nonReentrant
        notExpired(_userConfig.deadline)
    {
        GenericTraderProxyCache memory cache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN,
            isMarginDeposit: _tradeAccountNumber == _transferCollateralParams.toAccountNumber,
            otherAccountNumber: _tradeAccountNumber == _transferCollateralParams.toAccountNumber
                ? _transferCollateralParams.fromAccountNumber
                : _transferCollateralParams.toAccountNumber,
            // traders go right after the trade account, the zap account, and the transfer account ("other account")
            traderAccountStartIndex: TRANSFER_ACCOUNT_ID + 1,
            actionsCursor: 0,
            inputBalanceWeiBeforeOperate: Types.zeroWei(),
            outputBalanceWeiBeforeOperate: Types.zeroWei(),
            transferBalanceWeiBeforeOperate: Types.zeroWei()
        });
        _validateMarketIdPath(_marketIdsPath);
        _validateAmountWeis(_inputAmountWei, _minOutputAmountWei);
        _validateTraderParams(
            cache,
            _marketIdsPath,
            _makerAccounts,
            _tradersPath
        );
        _validateTransferParams(cache, _transferCollateralParams, _tradeAccountNumber);

        Account.Info[] memory accounts = _getAccounts(
            cache,
            _makerAccounts,
            /* _tradeAccountOwner = */ msg.sender, // solium-disable-line indentation
            _tradeAccountNumber
        );
        // the call to `_getAccounts` leaves accounts[TRANSFER_ACCOUNT_ID] equal to null, because it fills in the
        // traders starting at the `traderAccountCursor` index
        accounts[TRANSFER_ACCOUNT_ID] = Account.Info({
            owner: msg.sender,
            number: cache.otherAccountNumber
        });
        _validateZapAccount(cache, accounts[ZAP_ACCOUNT_ID], _marketIdsPath);

        uint256 transferActionsLength = _getActionsLengthForTransferCollateralParam(_transferCollateralParams);
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](
            _getActionsLengthForTraderParams(_tradersPath)
                + transferActionsLength
                + _getActionsLengthForExpiryParam(_expiryParams)
        );
        // solium-disable indentation
        {
            // To avoid the "stack too deep" error, we rearrange the stack
            uint256[] memory marketIdsPathForStackTooDeep = _marketIdsPath;
            uint256 inputAmountWeiForStackTooDeep = _inputAmountWei;
            uint256 minOutputAmountWeiForStackTooDeep = _minOutputAmountWei;
            TraderParam[] memory tradersPathForStackTooDeep = _tradersPath;
            _appendTraderActions(
                accounts,
                actions,
                cache,
                marketIdsPathForStackTooDeep,
                inputAmountWeiForStackTooDeep,
                minOutputAmountWeiForStackTooDeep,
                tradersPathForStackTooDeep
            );
        }
        {
            // To avoid the "stack too deep" error, we rearrange the stack
            uint256 tradeAccountNumberForStackTooDeep = _tradeAccountNumber;
            _appendTransferActions(
                actions,
                cache,
                _transferCollateralParams,
                tradeAccountNumberForStackTooDeep,
                transferActionsLength
            );
        }
        // solium-enable indentation
        _appendExpiryActions(
            actions,
            cache,
            _expiryParams,
            /* _tradeAccount = */ accounts[TRADE_ACCOUNT_ID] // solium-disable-line indentation
        );

        // snapshot the balances before so they can be logged in `_logEvents`
        _snapshotBalancesInCache(
            cache,
            /* _tradeAccount = */ accounts[TRADE_ACCOUNT_ID], // solium-disable-line indentation
            _marketIdsPath,
            _transferCollateralParams
        );

        cache.dolomiteMargin.operate(accounts, actions);

        _logEvents(
            cache,
            /* _tradeAccount = */ accounts[TRADE_ACCOUNT_ID], // solium-disable-line indentation
            _marketIdsPath,
            _transferCollateralParams
        );

        if (
            _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            // Check that the trader's balance is not negative for the input market
            uint256 inputMarketId = _marketIdsPath[0];
            AccountBalanceLib.verifyBalanceIsNonNegative(
                cache.dolomiteMargin,
                accounts[TRADE_ACCOUNT_ID].owner,
                accounts[TRADE_ACCOUNT_ID].number,
                inputMarketId
            );
        }

        if (
            _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _userConfig.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.To
        ) {
            for (uint256 i = 0; i < _transferCollateralParams.transferAmounts.length; i++) {
                AccountBalanceLib.verifyBalanceIsNonNegative(
                    cache.dolomiteMargin,
                    accounts[TRANSFER_ACCOUNT_ID].owner,
                    accounts[TRANSFER_ACCOUNT_ID].number,
                    _transferCollateralParams.transferAmounts[i].marketId
                );
            }
        }
    }

    // ============ Internal Functions ============

    function _logEvents(
        GenericTraderProxyCache memory _cache,
        Account.Info memory _tradeAccount,
        uint256[] memory _marketIdsPath,
        TransferCollateralParam memory _param
    ) internal {
        Events.BalanceUpdate memory inputBalanceUpdate;
        // solium-disable indentation
        {
            Types.Wei memory inputBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
                _tradeAccount,
                /* _inputToken = */ _marketIdsPath[0]
            );
            inputBalanceUpdate = Events.BalanceUpdate({
                deltaWei: inputBalanceWeiAfter.sub(_cache.inputBalanceWeiBeforeOperate),
                newPar: _cache.dolomiteMargin.getAccountPar(_tradeAccount, _marketIdsPath[0])
            });
        }
        // solium-enable indentation

        Events.BalanceUpdate memory outputBalanceUpdate;
        // solium-disable indentation
        {
            Types.Wei memory outputBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
                _tradeAccount,
                /* _outputToken = */ _marketIdsPath[_marketIdsPath.length - 1]
            );
            outputBalanceUpdate = Events.BalanceUpdate({
                deltaWei: outputBalanceWeiAfter.sub(_cache.outputBalanceWeiBeforeOperate),
                newPar: _cache.dolomiteMargin.getAccountPar(_tradeAccount, _marketIdsPath[_marketIdsPath.length - 1])
            });
        }
        // solium-enable indentation

        Events.BalanceUpdate memory marginBalanceUpdate;
        // solium-disable indentation
        {
            Types.Wei memory marginBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
                _tradeAccount,
                /* _transferToken = */_param.transferAmounts[0].marketId
            );
            marginBalanceUpdate = Events.BalanceUpdate({
                deltaWei: marginBalanceWeiAfter.sub(_cache.transferBalanceWeiBeforeOperate),
                newPar: _cache.dolomiteMargin.getAccountPar(
                _tradeAccount,
                _param.transferAmounts[0].marketId
            )
            });
        }
        // solium-enable indentation

        if (_cache.isMarginDeposit) {
            MARGIN_POSITION_REGISTRY.emitMarginPositionOpen(
                _tradeAccount.owner,
                _tradeAccount.number,
                /* _inputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[0]),
                /* _outputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[_marketIdsPath.length - 1]),
                /* _depositToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_param.transferAmounts[0].marketId),
                inputBalanceUpdate,
                outputBalanceUpdate,
                marginBalanceUpdate
            );
        } else {
            MARGIN_POSITION_REGISTRY.emitMarginPositionClose(
                _tradeAccount.owner,
                _tradeAccount.number,
                /* _inputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[0]),
                /* _outputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[_marketIdsPath.length - 1]),
                /* _withdrawalToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_param.transferAmounts[0].marketId),
                inputBalanceUpdate,
                outputBalanceUpdate,
                marginBalanceUpdate
            );
        }
    }

    function _appendExpiryActions(
        Actions.ActionArgs[] memory _actions,
        GenericTraderProxyCache memory _cache,
        ExpiryParam memory _param,
        Account.Info memory _tradeAccount
    )
    internal
    view
    {
        if (_param.expiryTimeDelta == 0) {
            // Don't append it if there's no expiry
            return;
        }

        _actions[_cache.actionsCursor++] = AccountActionLib.encodeExpirationAction(
            _tradeAccount,
            TRADE_ACCOUNT_ID,
            _param.marketId,
            address(EXPIRY),
            _param.expiryTimeDelta
        );
    }

    function _snapshotBalancesInCache(
        GenericTraderProxyCache memory _cache,
        Account.Info memory _tradeAccount,
        uint256[] memory _marketIdsPath,
        TransferCollateralParam memory _param
    ) internal view {
        _cache.inputBalanceWeiBeforeOperate = _cache.dolomiteMargin.getAccountWei(
            _tradeAccount,
            _marketIdsPath[0]
        );
        _cache.outputBalanceWeiBeforeOperate = _cache.dolomiteMargin.getAccountWei(
            _tradeAccount,
            _marketIdsPath[_marketIdsPath.length - 1]
        );
        _cache.transferBalanceWeiBeforeOperate = _cache.dolomiteMargin.getAccountWei(
            _tradeAccount,
            _param.transferAmounts[0].marketId
        );
    }

    function _validateTransferParams(
        GenericTraderProxyCache memory _cache,
        TransferCollateralParam memory _param,
        uint256 _tradeAccountNumber
    )
        internal
        pure
    {
        if (_param.transferAmounts.length > 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_param.transferAmounts.length > 0,
            FILE,
            "Invalid transfer amounts length"
        );
        if (_param.fromAccountNumber != _param.toAccountNumber) { /* FOR COVERAGE TESTING */ }
        Require.that(_param.fromAccountNumber != _param.toAccountNumber,
            FILE,
            "Cannot transfer to same account"
        );
        if (_tradeAccountNumber == _param.fromAccountNumber ||  _tradeAccountNumber == _param.toAccountNumber) { /* FOR COVERAGE TESTING */ }
        Require.that(_tradeAccountNumber == _param.fromAccountNumber ||  _tradeAccountNumber == _param.toAccountNumber,
            FILE,
            "Invalid trade account number"
        );
        _cache.otherAccountNumber = _tradeAccountNumber == _param.toAccountNumber
            ? _param.fromAccountNumber
            : _param.toAccountNumber;

        for (uint256 i = 0; i < _param.transferAmounts.length; i++) {
            if (_param.transferAmounts[i].amountWei > 0) { /* FOR COVERAGE TESTING */ }
            Require.that(_param.transferAmounts[i].amountWei > 0,
                FILE,
                "Invalid transfer amount at index",
                i
            );
        }
    }

    function _getActionsLengthForTransferCollateralParam(
        TransferCollateralParam memory _param
    )
        internal
        pure
        returns (uint256)
    {
        return _param.transferAmounts.length;
    }

    function _getActionsLengthForExpiryParam(
        ExpiryParam memory _param
    )
        internal
        pure
        returns (uint256)
    {
        if (_param.expiryTimeDelta == 0) {
            return 0;
        } else {
            return 1;
        }
    }

    function _appendTransferActions(
        Actions.ActionArgs[] memory _actions,
        GenericTraderProxyCache memory _cache,
        TransferCollateralParam memory _transferCollateralParam,
        uint256 _traderAccountNumber,
        uint256 _transferActionsLength
    )
        internal
        pure
    {
        // the `_traderAccountNumber` is always `accountId=0`
        uint256 fromAccountId = _transferCollateralParam.fromAccountNumber == _traderAccountNumber
            ? TRADE_ACCOUNT_ID
            : TRANSFER_ACCOUNT_ID;
        uint256 toAccountId = _transferCollateralParam.fromAccountNumber == _traderAccountNumber
            ? TRANSFER_ACCOUNT_ID
            : TRADE_ACCOUNT_ID;
        for (uint256 i = 0; i < _transferActionsLength; i++) {
            _actions[_cache.actionsCursor++] = AccountActionLib.encodeTransferAction(
                fromAccountId,
                toAccountId,
                _transferCollateralParam.transferAmounts[i].marketId,
                _transferCollateralParam.transferAmounts[i].amountWei
            );
        }
    }

    function _otherAccountId() internal pure returns (uint256) {
        return ZAP_ACCOUNT_ID;
    }
}
