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
import { ExcessivelySafeCall } from "../../protocol/lib/ExcessivelySafeCall.sol";
import { Require } from "../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IExpiry } from "../interfaces/IExpiry.sol";
import { IGenericTraderProxyBase } from "../interfaces/IGenericTraderProxyBase.sol";
import { IIsolationModeToken } from "../interfaces/IIsolationModeToken.sol";
import { ILiquidatorAssetRegistry } from "../interfaces/ILiquidatorAssetRegistry.sol";
import {IIsolationModeUnwrapperTrader} from "../interfaces/IIsolationModeUnwrapperTrader.sol";
import {IIsolationModeWrapperTrader} from "../interfaces/IIsolationModeWrapperTrader.sol";
import { IMarginPositionRegistry } from "../interfaces/IMarginPositionRegistry.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";


/**
 * @title   GenericTraderProxyBase
 * @author  Dolomite
 *
 * @dev Base contract with validation and utilities for trading any asset from an account
 */
contract GenericTraderProxyBase is IGenericTraderProxyBase {

    // ============ Constants ============

    bytes32 private constant FILE = "GenericTraderProxyBase";

    /// @dev The index of the trade account in the accounts array (for executing an operation)
    uint256 private constant TRADE_ACCOUNT_INDEX = 0;

    // ============ Internal Functions ============

    function _validateMarketIdPath(
        uint256[] memory _marketIdsPath
    ) internal pure {
        if (_marketIdsPath.length >= 2) { /* FOR COVERAGE TESTING */ }
        Require.that(_marketIdsPath.length >= 2,
            FILE,
            "Invalid market path length"
        );

        if (_marketIdsPath[0] != _marketIdsPath[_marketIdsPath.length - 1]) { /* FOR COVERAGE TESTING */ }
        Require.that(_marketIdsPath[0] != _marketIdsPath[_marketIdsPath.length - 1],
            FILE,
            "Duplicate markets in path"
        );
    }

    function _validateAmountWeisPath(
        uint256[] memory _marketIdsPath,
        uint256[] memory _amountWeisPath
    )
        internal
        pure
    {
        if (_marketIdsPath.length == _amountWeisPath.length) { /* FOR COVERAGE TESTING */ }
        Require.that(_marketIdsPath.length == _amountWeisPath.length,
            FILE,
            "Invalid amounts path length"
        );

        for (uint256 i = 0; i < _amountWeisPath.length; i++) {
            if (_amountWeisPath[i] > 0) { /* FOR COVERAGE TESTING */ }
            Require.that(_amountWeisPath[i] > 0,
                FILE,
                "Invalid amount at index",
                i
            );
        }
    }

    function _validateTraderParams(
        GenericTraderProxyCache memory _cache,
        uint256[] memory _marketIdsPath,
        Account.Info[] memory _makerAccounts,
        TraderParam[] memory _traderParamsPath
    )
        internal
        view
    {
        if (_marketIdsPath.length == _traderParamsPath.length + 1) { /* FOR COVERAGE TESTING */ }
        Require.that(_marketIdsPath.length == _traderParamsPath.length + 1,
            FILE,
            "Invalid traders params length"
        );

        for (uint256 i = 0; i < _traderParamsPath.length; i++) {
            _validateTraderParam(
                _cache,
                _marketIdsPath,
                _makerAccounts,
                _traderParamsPath[i],
                /* _index = */ i // solium-disable-line indentation
            );
        }
    }

    function _validateTraderParam(
        GenericTraderProxyCache memory _cache,
        uint256[] memory _marketIdsPath,
        Account.Info[] memory _makerAccounts,
        TraderParam memory _traderParam,
        uint256 _index
    )
        internal
        view
    {
        if (_traderParam.trader != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(_traderParam.trader != address(0),
            FILE,
            "Invalid trader at index",
            _index
        );

        uint256 marketId = _marketIdsPath[_index];
        uint256 nextMarketId = _marketIdsPath[_index + 1];
        _validateIsolationModeStatusForTraderParam(
            _cache,
            marketId,
            nextMarketId,
            _traderParam
        );
        _validateTraderTypeForTraderParam(
            _cache,
            marketId,
            nextMarketId,
            _traderParam,
            _index
        );
        _validateMakerAccountForTraderParam(
            _makerAccounts,
            _traderParam,
            _index
        );
    }

    function _validateIsolationModeStatusForTraderParam(
        GenericTraderProxyCache memory _cache,
        uint256 _marketId,
        uint256 _nextMarketId,
        TraderParam memory _traderParam
    ) internal view {
        if (_isIsolationModeMarket(_cache, _marketId)) {
            // If the current market is in isolation mode, the trader type must be for isolation mode assets
            if (_traderParam.traderType == TraderType.IsolationModeUnwrapper) { /* FOR COVERAGE TESTING */ }
            Require.that(_traderParam.traderType == TraderType.IsolationModeUnwrapper,
                FILE,
                "Invalid isolation mode unwrapper",
                _marketId,
                uint256(uint8(_traderParam.traderType))
            );

            if (_isIsolationModeMarket(_cache, _nextMarketId)) {
                // If the user is unwrapping into an isolation mode asset, the next market must trust this trader
                address isolationModeToken = _cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId);
                if (IIsolationModeToken(isolationModeToken).isTokenConverterTrusted(_traderParam.trader)) { /* FOR COVERAGE TESTING */ }
                Require.that(IIsolationModeToken(isolationModeToken).isTokenConverterTrusted(_traderParam.trader),
                    FILE,
                    "Invalid unwrap sequence",
                    _marketId,
                    _nextMarketId
                );
            }
        } else if (_isIsolationModeMarket(_cache, _nextMarketId)) {
            // If the next market is in isolation mode, the trader must wrap the current asset into the isolation asset.
            if (_traderParam.traderType == TraderType.IsolationModeWrapper) { /* FOR COVERAGE TESTING */ }
            Require.that(_traderParam.traderType == TraderType.IsolationModeWrapper,
                FILE,
                "Invalid isolation mode wrapper",
                _nextMarketId,
                uint256(uint8(_traderParam.traderType))
            );
        } else {
            // If neither asset is in isolation mode, the trader type must be for non-isolation mode assets
            if (_traderParam.traderType == TraderType.ExternalLiquidity|| _traderParam.traderType == TraderType.InternalLiquidity) { /* FOR COVERAGE TESTING */ }
            Require.that(_traderParam.traderType == TraderType.ExternalLiquidity
                    || _traderParam.traderType == TraderType.InternalLiquidity,
                FILE,
                "Invalid trader type",
                uint256(uint8(_traderParam.traderType))
            );
        }
    }

    function _validateTraderTypeForTraderParam(
        GenericTraderProxyCache memory _cache,
        uint256 _marketId,
        uint256 _nextMarketId,
        TraderParam memory _traderParam,
        uint256 _index
    ) internal view {
        if (TraderType.IsolationModeUnwrapper == _traderParam.traderType) {
            IIsolationModeUnwrapperTrader unwrapperTrader = IIsolationModeUnwrapperTrader(_traderParam.trader);
            address isolationModeToken = _cache.dolomiteMargin.getMarketTokenAddress(_marketId);
            if (unwrapperTrader.token() == isolationModeToken) { /* FOR COVERAGE TESTING */ }
            Require.that(unwrapperTrader.token() == isolationModeToken,
                FILE,
                "Invalid input for unwrapper",
                _index,
                _marketId
            );
            if (unwrapperTrader.isValidOutputToken(_cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId))) { /* FOR COVERAGE TESTING */ }
            Require.that(unwrapperTrader.isValidOutputToken(_cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId)),
                FILE,
                "Invalid output for unwrapper",
                _index + 1,
                _nextMarketId
            );
            if (IIsolationModeToken(isolationModeToken).isTokenConverterTrusted(_traderParam.trader)) { /* FOR COVERAGE TESTING */ }
            Require.that(IIsolationModeToken(isolationModeToken).isTokenConverterTrusted(_traderParam.trader),
                FILE,
                "Unwrapper trader not enabled",
                _traderParam.trader,
                _marketId
            );
        } else if (TraderType.IsolationModeWrapper == _traderParam.traderType) {
            IIsolationModeWrapperTrader wrapperTrader = IIsolationModeWrapperTrader(_traderParam.trader);
            address isolationModeToken = _cache.dolomiteMargin.getMarketTokenAddress(_nextMarketId);
            if (wrapperTrader.isValidInputToken(_cache.dolomiteMargin.getMarketTokenAddress(_marketId))) { /* FOR COVERAGE TESTING */ }
            Require.that(wrapperTrader.isValidInputToken(_cache.dolomiteMargin.getMarketTokenAddress(_marketId)),
                FILE,
                "Invalid input for wrapper",
                _index,
                _marketId
            );
            if (wrapperTrader.token() == isolationModeToken) { /* FOR COVERAGE TESTING */ }
            Require.that(wrapperTrader.token() == isolationModeToken,
                FILE,
                "Invalid output for wrapper",
                _index + 1,
                _nextMarketId
            );
            if (IIsolationModeToken(isolationModeToken).isTokenConverterTrusted(_traderParam.trader)) { /* FOR COVERAGE TESTING */ }
            Require.that(IIsolationModeToken(isolationModeToken).isTokenConverterTrusted(_traderParam.trader),
                FILE,
                "Wrapper trader not enabled",
                _traderParam.trader,
                _nextMarketId
            );
        }
    }

    function _validateMakerAccountForTraderParam(
        Account.Info[] memory _makerAccounts,
        TraderParam memory _traderParam,
        uint256 _index
    ) internal pure {
        if (TraderType.InternalLiquidity == _traderParam.traderType) {
            // The makerAccountOwner should be set if the traderType is InternalLiquidity
            if (_traderParam.makerAccountIndex < _makerAccounts.length&& _makerAccounts[_traderParam.makerAccountIndex].owner != address(0)) { /* FOR COVERAGE TESTING */ }
            Require.that(_traderParam.makerAccountIndex < _makerAccounts.length
                && _makerAccounts[_traderParam.makerAccountIndex].owner != address(0),
                FILE,
                "Invalid maker account owner",
                _index
            );
        } else {
            // The makerAccountOwner and makerAccountNumber is not used if the traderType is not InternalLiquidity
            if (_traderParam.makerAccountIndex == 0) { /* FOR COVERAGE TESTING */ }
            Require.that(_traderParam.makerAccountIndex == 0,
                FILE,
                "Invalid maker account owner",
                _index
            );
        }
    }

    function _getAccounts(
        GenericTraderProxyCache memory _cache,
        Account.Info[] memory _makerAccounts,
        address _tradeAccountOwner,
        uint256 _tradeAccountNumber
    )
        internal
        pure
        returns (Account.Info[] memory)
    {
        Account.Info[] memory accounts = new Account.Info[](_cache.traderAccountStartIndex + _makerAccounts.length);
        accounts[TRADE_ACCOUNT_INDEX] = Account.Info({
            owner: _tradeAccountOwner,
            number: _tradeAccountNumber
        });
        _appendTradersToAccounts(_cache, _makerAccounts, accounts);
        return accounts;
    }

    function _appendTradersToAccounts(
        GenericTraderProxyCache memory _cache,
        Account.Info[] memory _makerAccounts,
        Account.Info[] memory _accounts
    )
        internal
        pure
    {
        for (uint256 i = 0; i < _makerAccounts.length; i++) {
            _accounts[_cache.traderAccountStartIndex + i] = Account.Info({
                owner: _makerAccounts[i].owner,
                number: _makerAccounts[i].number
            });
        }
    }

    function _getActionsLengthForTraderParams(
        TraderParam[] memory _tradersPath
    )
        internal
        pure
        returns (uint256)
    {
        uint256 actionsLength = 0;
        for (uint256 i = 0; i < _tradersPath.length; i++) {
            if (TraderType.IsolationModeUnwrapper == _tradersPath[i].traderType) {
                actionsLength += IIsolationModeUnwrapperTrader(_tradersPath[i].trader).actionsLength();
            } else if (TraderType.IsolationModeWrapper == _tradersPath[i].traderType) {
                actionsLength += IIsolationModeUnwrapperTrader(_tradersPath[i].trader).actionsLength();
            } else {
                actionsLength += 1;
            }
        }
        return actionsLength;
    }

    function _appendTraderActions(
        Account.Info[] memory _accounts,
        Actions.ActionArgs[] memory _actions,
        GenericTraderProxyCache memory _cache,
        uint256[] memory _marketIdsPath,
        uint256[] memory _amountWeisPath,
        TraderParam[] memory _tradersPath
    )
        internal
        view
    {
        for (uint256 i = 0; i < _tradersPath.length; i++) {
            if (_tradersPath[i].traderType == TraderType.ExternalLiquidity) {
                _actions[_cache.actionsCursor++] = AccountActionLib.encodeExternalSellAction(
                    TRADE_ACCOUNT_INDEX,
                    _marketIdsPath[i],
                    _marketIdsPath[i + 1],
                    _tradersPath[i].trader,
                    _amountWeisPath[i],
                    _amountWeisPath[i + 1],
                    _tradersPath[i].tradeData
                );
            } else if (_tradersPath[i].traderType == TraderType.InternalLiquidity) {
                _actions[_cache.actionsCursor++] = AccountActionLib.encodeInternalTradeActionWithCustomData(
                    TRADE_ACCOUNT_INDEX,
                    /* _makerAccountId = */ _tradersPath[i].makerAccountIndex + _cache.traderAccountStartIndex,
                    _marketIdsPath[i],
                    _marketIdsPath[i + 1],
                    _tradersPath[i].trader,
                    _amountWeisPath[i],
                    _tradersPath[i].tradeData
                );
            } else if (_tradersPath[i].traderType == TraderType.IsolationModeUnwrapper) {
                IIsolationModeUnwrapperTrader unwrapperTrader = IIsolationModeUnwrapperTrader(_tradersPath[i].trader);
                Actions.ActionArgs[] memory unwrapperActions = unwrapperTrader.createActionsForUnwrapping(
                    TRADE_ACCOUNT_INDEX,
                    TRADE_ACCOUNT_INDEX,
                    _accounts[TRADE_ACCOUNT_INDEX].owner,
                    _accounts[TRADE_ACCOUNT_INDEX].owner,
                    /* _outputMarketId = */_marketIdsPath[i + 1], // solium-disable-line indentation
                    /* _inputMarketId = */ _marketIdsPath[i], // solium-disable-line indentation
                    /* _minOutputAmount = */ _amountWeisPath[i + 1], // solium-disable-line indentation
                    /* _inputAmount = */ _amountWeisPath[i], // solium-disable-line indentation,
                    _tradersPath[i].tradeData
                );
                for (uint256 j = 0; j < unwrapperActions.length; j++) {
                    _actions[_cache.actionsCursor++] = unwrapperActions[j];
                }
            } else {
                // Panic if the developer messed up the `else` statement here
              /*assert(_tradersPath[i].traderType == TraderType.IsolationModeWrapper);*/

                IIsolationModeWrapperTrader wrapperTrader = IIsolationModeWrapperTrader(_tradersPath[i].trader);
                Actions.ActionArgs[] memory wrapperActions = wrapperTrader.createActionsForWrapping(
                    TRADE_ACCOUNT_INDEX,
                    TRADE_ACCOUNT_INDEX,
                    _accounts[TRADE_ACCOUNT_INDEX].owner,
                    _accounts[TRADE_ACCOUNT_INDEX].owner,
                    /* _outputMarketId = */ _marketIdsPath[i + 1], // solium-disable-line indentation
                    /* _inputMarketId = */ _marketIdsPath[i], // solium-disable-line indentation
                    /* _minOutputAmount = */ _amountWeisPath[i + 1], // solium-disable-line indentation
                    /* _inputAmount = */ _amountWeisPath[i], // solium-disable-line indentation
                    _tradersPath[i].tradeData
                );
                for (uint256 j = 0; j < wrapperActions.length; j++) {
                    _actions[_cache.actionsCursor++] = wrapperActions[j];
                }
            }
        }
    }

    // ============ Private Functions ============

    function _isIsolationModeMarket(
        GenericTraderProxyCache memory _cache,
        uint256 _marketId
    ) private view returns (bool) {
        (bool isSuccess, bytes memory returnData) = ExcessivelySafeCall.safeStaticCall(
            _cache.dolomiteMargin.getMarketTokenAddress(_marketId),
            IIsolationModeToken(address(0)).isIsolationAsset.selector,
            bytes("")
        );
        return isSuccess && abi.decode(returnData, (bool));
    }
}
