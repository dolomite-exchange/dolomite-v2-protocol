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
import { ILiquidityTokenUnwrapperTrader } from "../interfaces/ILiquidityTokenUnwrapperTrader.sol";
import { ILiquidityTokenWrapperTrader } from "../interfaces/ILiquidityTokenWrapperTrader.sol";
import { IMarginPositionRegistry } from "../interfaces/IMarginPositionRegistry.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";


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

    // ============ Storage ============

    IExpiry public EXPIRY;
    IMarginPositionRegistry public MARGIN_POSITION_REGISTRY;

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
        uint256[] memory _amountWeisPath,
        TraderParam[] memory _tradersPath,
        Account.Info[] memory _makerAccounts
    )
        public
        nonReentrant
    {
        GenericTraderProxyCache memory cache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN,
            // unused for this function
            isMarginDeposit: false,
            // unused for this function
            otherAccountNumber: 0,
            // traders go right after the trade account
            traderAccountStartIndex: 1,
            actionsCursor: 0,
            // unused for this function
            inputBalanceWeiBeforeOperate: Types.zeroWei(),
            // unused for this function
            outputBalanceWeiBeforeOperate: Types.zeroWei(),
            // unused for this function
            transferBalanceWeiBeforeOperate: Types.zeroWei()
        });
        _validateMarketIdPath(_marketIdsPath);
        _validateAmountWeisPath(_marketIdsPath, _amountWeisPath);
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

        uint256 traderActionsLength = _getActionsLengthForTraderParams(_tradersPath);
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](traderActionsLength);
        _appendTraderActions(
            accounts,
            actions,
            cache,
            _marketIdsPath,
            _amountWeisPath,
            _tradersPath,
            traderActionsLength
        );

        cache.dolomiteMargin.operate(accounts, actions);
    }

    function swapExactInputForOutputAndModifyPosition(
        uint256 _tradeAccountNumber,
        uint256[] memory _marketIdsPath,
        uint256[] memory _amountWeisPath,
        TraderParam[] memory _tradersPath,
        Account.Info[] memory _makerAccounts,
        TransferCollateralParam memory _transferCollateralParams,
        ExpiryParam memory _expiryParams
    )
        public
        nonReentrant
    {
        GenericTraderProxyCache memory cache = GenericTraderProxyCache({
            dolomiteMargin: DOLOMITE_MARGIN,
            isMarginDeposit: _tradeAccountNumber == _transferCollateralParams.toAccountNumber,
            otherAccountNumber: _tradeAccountNumber == _transferCollateralParams.toAccountNumber
                ? _transferCollateralParams.fromAccountNumber
                : _transferCollateralParams.toAccountNumber,
            // traders go right after the transfer account ("other account")
            traderAccountStartIndex: 2,
            actionsCursor: 0,
            inputBalanceWeiBeforeOperate: Types.zeroWei(),
            outputBalanceWeiBeforeOperate: Types.zeroWei(),
            transferBalanceWeiBeforeOperate: Types.zeroWei()
        });
        _validateMarketIdPath(_marketIdsPath);
        _validateAmountWeisPath(_marketIdsPath, _amountWeisPath);
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
        // the call to `_getAccounts` leaves accounts[1]equal to null, because it fills in the traders starting at the
        // `traderAccountCursor` index
        accounts[1] = Account.Info({
            owner: msg.sender,
            number: cache.otherAccountNumber
        });

        uint256 traderActionsLength = _getActionsLengthForTraderParams(_tradersPath);
        uint256 transferActionsLength = _getActionsLengthForTransferCollateralParam(_transferCollateralParams);
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](
            traderActionsLength + transferActionsLength + _getActionsLengthForExpiryParam(_expiryParams)
        );
        _appendTraderActions(
            accounts,
            actions,
            cache,
            _marketIdsPath,
            _amountWeisPath,
            _tradersPath,
            traderActionsLength
        );
        _appendTransferActions(
            actions,
            cache,
            _transferCollateralParams,
            _tradeAccountNumber,
            transferActionsLength
        );
        _appendExpiryActions(
            actions,
            cache,
            _expiryParams,
            /* _tradeAccount = */ accounts[0] // solium-disable-line indentation
        );

        // snapshot the balances before so they can be logged in `_logEvents`
        _snapshotBalancesInCache(
            cache,
            /* _tradeAccount = */ accounts[0], // solium-disable-line indentation
            _marketIdsPath,
            _transferCollateralParams
        );

        cache.dolomiteMargin.operate(accounts, actions);

        _logEvents(
            cache,
            /* _tradeAccount = */ accounts[0], // solium-disable-line indentation
            _marketIdsPath,
            _transferCollateralParams
        );
    }

    // ============ Internal Functions ============

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
            ? 0
            : 1;
        uint256 toAccountId = _transferCollateralParam.fromAccountNumber == _traderAccountNumber
            ? 1
            : 0;
        for (uint256 i = 0; i < _transferActionsLength; i++) {
            _actions[_cache.actionsCursor++] = AccountActionLib.encodeTransferAction(
                fromAccountId,
                toAccountId,
                _transferCollateralParam.transferAmounts[i].marketId,
                _transferCollateralParam.transferAmounts[i].amountWei
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
            /* _accountId = */ 0, // solium-disable-line indentation
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
}
