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

import {ILiquidityTokenUnwrapperTrader} from "../interfaces/ILiquidityTokenUnwrapperForLiquidation.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";

import { LiquidatorProxyV2WithExternalLiquidity } from "./LiquidatorProxyV2WithExternalLiquidity.sol";


/**
 * @title LiquidatorProxyV4WithExternalLiquidityToken
 * @author Dolomite
 *
 * Contract for liquidating other accounts in DolomiteMargin that use external LP token(s) (ones that are not native to
 * Dolomite) as collateral or debt. All collateral is atomically sold off via Paraswap liquidity aggregation.
 */
contract LiquidatorProxyV3WithLiquidityToken is LiquidatorProxyV2WithExternalLiquidity {

    // ============ Events ============

    event TokenUnwrapperForLiquidationSet(uint256 _marketId, address _liquidityTokenUnwrapper);

    // ============ Events ============

    struct LiquidatorProxyV3Cache {
        uint256 actionCursor;
        uint256 solidAccountId;
        uint256 liquidAccountId;
        uint256 initialOutputMarket;
        ILiquidityTokenUnwrapperTrader tokenUnwrapper;
        Actions.ActionArgs[] actions;
    }

    // ============ Constants ============

    bytes32 private constant FILE = "LiquidatorProxyV3";

    // ============ Storage ============

    mapping(uint256 => ILiquidityTokenUnwrapperTrader) public marketIdToTokenUnwrapperMap;

    // ============ Constructor ============

    constructor (
        address _expiryProxy,
        address _paraswapAugustusRouter,
        address _paraswapTransferProxy,
        address _dolomiteMargin,
        address _liquidatorAssetRegistry
    )
    public
    LiquidatorProxyV2WithExternalLiquidity(
        _expiryProxy,
        _paraswapAugustusRouter,
        _paraswapTransferProxy,
        _dolomiteMargin,
        _liquidatorAssetRegistry
    )
    {}

    function setMarketIdToTokenUnwrapperForLiquidationMap(
        uint256 _marketId,
        address _tokenUnwrapper
    ) external {
        if (msg.sender == DOLOMITE_MARGIN.owner()) { /* FOR COVERAGE TESTING */ }
        Require.that(msg.sender == DOLOMITE_MARGIN.owner(),
            FILE,
            "Only owner can call",
            msg.sender
        );
        marketIdToTokenUnwrapperMap[_marketId] = ILiquidityTokenUnwrapperTrader(_tokenUnwrapper);
        emit TokenUnwrapperForLiquidationSet(_marketId, _tokenUnwrapper);
    }

    // ============ Internal Functions ============

    function _constructActionsArray(
        LiquidatorProxyConstants memory _constants,
        LiquidatorProxyCache memory _proxyCache,
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        bytes memory _paraswapCallData
    )
    internal
    view
    returns (Actions.ActionArgs[] memory)
    {
        // TODO:    if the LP token is used as the `_owedMarket`, create a `wrapper` that wraps `initialOutputMarket`
        // TODO:    into the `_owedMarket`

        // This cache is created to prevent "stack too deep" errors
        LiquidatorProxyV3Cache memory v3Cache = LiquidatorProxyV3Cache({
            actionCursor: 0,
            solidAccountId: _solidAccountId,
            liquidAccountId: _liquidAccountId,
            initialOutputMarket: uint(-1),
            tokenUnwrapper: marketIdToTokenUnwrapperMap[_proxyCache.heldMarket],
            actions: new Actions.ActionArgs[](0)
        });

        if (address(v3Cache.tokenUnwrapper) != address(0)) {
            v3Cache.initialOutputMarket = v3Cache.tokenUnwrapper.outputMarketId();
            v3Cache.actions = new Actions.ActionArgs[](
                v3Cache.tokenUnwrapper.actionsLength() + (v3Cache.initialOutputMarket == _proxyCache.owedMarket ? 1 : 2)
            );
        } else {
            v3Cache.initialOutputMarket = _proxyCache.owedMarket;
            v3Cache.actions = new Actions.ActionArgs[](2);
        }

        _encodeLiquidateAction(_proxyCache, _constants, v3Cache);

        _encodeUnwrapAndSellActions(
            _proxyCache,
            _constants,
            v3Cache,
            _paraswapCallData
        );

        return v3Cache.actions;
    }

    function _encodeLiquidateAction(
        LiquidatorProxyCache memory _proxyCache,
        LiquidatorProxyConstants memory _constants,
        LiquidatorProxyV3Cache memory _v3Cache
    ) internal pure {
        if (_constants.expiry > 0) {
            // accountId is solidAccount; otherAccountId is liquidAccount
            _v3Cache.actions[_v3Cache.actionCursor++] = AccountActionLib.encodeExpiryLiquidateAction(
                _v3Cache.solidAccountId,
                _v3Cache.liquidAccountId,
                _proxyCache.owedMarket,
                _proxyCache.heldMarket,
                address(_constants.expiryProxy),
                _constants.expiry,
                _proxyCache.flipMarkets
            );
        } else {
            // accountId is solidAccount; otherAccountId is liquidAccount
            _v3Cache.actions[_v3Cache.actionCursor++] = AccountActionLib.encodeLiquidateAction(
                _v3Cache.solidAccountId,
                _v3Cache.liquidAccountId,
                _proxyCache.owedMarket,
                _proxyCache.heldMarket,
                _proxyCache.owedWeiToLiquidate
            );
        }
    }

    function _encodeUnwrapAndSellActions(
        LiquidatorProxyCache memory _proxyCache,
        LiquidatorProxyConstants memory _constants,
        LiquidatorProxyV3Cache memory _v3Cache,
        bytes memory _paraswapCallData
    ) internal view {
        if (address(_v3Cache.tokenUnwrapper) != address(0)) {
            // Get the actions for selling the `_cache.heldMarket` into `outputMarket`
            ILiquidityTokenUnwrapperTrader tokenUnwrapper = _v3Cache.tokenUnwrapper;
            Actions.ActionArgs[] memory unwrapActions = tokenUnwrapper.createActionsForUnwrappingForLiquidation(
                _v3Cache.solidAccountId,
                _v3Cache.liquidAccountId,
                _constants.solidAccount.owner,
                _constants.liquidAccount.owner,
                _proxyCache.owedMarket,
                _proxyCache.heldMarket,
                _proxyCache.owedWeiToLiquidate,
                _proxyCache.solidHeldUpdateWithReward
            );
            for (uint256 i = 0; i < unwrapActions.length; i++) {
                _v3Cache.actions[_v3Cache.actionCursor++] = unwrapActions[i];
            }

            // If the `outputMarket` is different from the `_cache.owedMarket`, sell the `outputMarket` into it.
            if (_proxyCache.owedMarket != _v3Cache.initialOutputMarket) {
                uint256 outputAmountFromPreviousStep = _v3Cache.tokenUnwrapper.getExchangeCost(
                    DOLOMITE_MARGIN.getMarketTokenAddress(_proxyCache.heldMarket),
                    DOLOMITE_MARGIN.getMarketTokenAddress(_v3Cache.initialOutputMarket),
                    _proxyCache.solidHeldUpdateWithReward,
                    bytes("")
                );
                _v3Cache.actions[_v3Cache.actionCursor++] = AccountActionLib.encodeExternalSellAction(
                    _v3Cache.solidAccountId,
                    _v3Cache.initialOutputMarket,
                    _proxyCache.owedMarket,
                    /* _trader = */ address(this), // solium-disable-line indentation
                    outputAmountFromPreviousStep, // liquidate whatever we get from the intermediate step
                    /* _amountOutMinWei = */ _proxyCache.owedWeiToLiquidate, // solium-disable-line indentation
                    _paraswapCallData
                );
            }
        } else {
            _v3Cache.actions[_v3Cache.actionCursor++] = AccountActionLib.encodeExternalSellAction(
                _v3Cache.solidAccountId,
                _proxyCache.heldMarket,
                _proxyCache.owedMarket,
                /* _trader = */ address(this), // solium-disable-line indentation
                _proxyCache.solidHeldUpdateWithReward,
                _proxyCache.owedWeiToLiquidate,
                _paraswapCallData
            );
        }
    }

}
