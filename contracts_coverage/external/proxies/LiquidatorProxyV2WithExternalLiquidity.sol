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

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { IExpiry } from "../interfaces/IExpiry.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";

import { ParaswapTraderProxyWithBackup } from "./ParaswapTraderProxyWithBackup.sol";


/**
 * @title LiquidatorProxyV2WithExternalLiquidity
 * @author Dolomite
 *
 * Contract for liquidating other accounts in DolomiteMargin and atomically selling off collateral via Paraswap
 * liquidity aggregation
 */
contract LiquidatorProxyV2WithExternalLiquidity is ReentrancyGuard, ParaswapTraderProxyWithBackup {

    // ============ Constants ============

    bytes32 private constant FILE = "LiquidatorProxyV2";

    // ============ Storage ============

    IExpiry public EXPIRY_PROXY;

    // ============ Constructor ============

    constructor (
        address _expiryProxy,
        address _paraswapAugustusRouter,
        address _paraswapTransferProxy,
        address _dolomiteMargin,
        address _liquidatorAssetRegistry
    )
        public
        ParaswapTraderProxyWithBackup(
            _paraswapAugustusRouter,
            _paraswapTransferProxy,
            _dolomiteMargin,
            _liquidatorAssetRegistry
        )
    {
        EXPIRY_PROXY = IExpiry(_expiryProxy);
    }

    // ============ Public Functions ============

    /**
     * Liquidate liquidAccount using solidAccount. This contract and the msg.sender to this contract must both be
     * operators for the solidAccount.
     *
     * @param _solidAccount                 The account that will do the liquidating
     * @param _liquidAccount                The account that will be liquidated
     * @param _owedMarket                   The owed market whose borrowed value will be added to `owedWeiToLiquidate`
     * @param _heldMarket                   The held market whose collateral will be recovered to take on the debt of
     *                                      `owedMarket`
     * @param _expiry                       The time at which the position expires, if this liquidation is for closing
     *                                      an expired position. Else, 0.
     * @param _paraswapCallData             The calldata to be passed along to Paraswap's router for liquidation
     */
    function liquidate(
        Account.Info memory _solidAccount,
        Account.Info memory _liquidAccount,
        uint256 _owedMarket,
        uint256 _heldMarket,
        uint256 _expiry,
        bytes memory _paraswapCallData
    )
        public
        nonReentrant
        requireIsAssetWhitelistedForLiquidation(_heldMarket)
    {
        // put all values that will not change into a single struct
        LiquidatorProxyConstants memory constants;
        constants.dolomiteMargin = DOLOMITE_MARGIN;

        _checkConstants(
            constants,
            _liquidAccount,
            _owedMarket,
            _heldMarket,
            _expiry
        );

        constants.solidAccount = _solidAccount;
        constants.liquidAccount = _liquidAccount;
        constants.liquidMarkets = constants.dolomiteMargin.getAccountMarketsWithBalances(_liquidAccount);
        constants.markets = _getMarketInfos(
            constants.dolomiteMargin,
            constants.dolomiteMargin.getAccountMarketsWithBalances(_solidAccount),
            constants.liquidMarkets
        );
        constants.expiryProxy = _expiry > 0 ? EXPIRY_PROXY: IExpiry(address(0));
        constants.expiry = uint32(_expiry);

        LiquidatorProxyCache memory cache = _initializeCache(
            constants,
            _heldMarket,
            _owedMarket
        );

        // validate the msg.sender and that the liquidAccount can be liquidated
        _checkBasicRequirements(constants, _owedMarket);

        // get the max liquidation amount
        _calculateAndSetMaxLiquidationAmount(cache);

        Account.Info[] memory accounts = _constructAccountsArray(constants);

        // execute the liquidations
        constants.dolomiteMargin.operate(
            accounts,
            _constructActionsArray(
                constants,
                cache,
                /* _solidAccountId = */ 0, // solium-disable-line indentation
                /* _liquidAccount = */ 1, // solium-disable-line indentation
                _paraswapCallData
            )
        );
    }

    // ============ Internal Functions ============

    function _constructAccountsArray(
        LiquidatorProxyConstants memory _constants
    )
    internal
    pure
    returns (Account.Info[] memory)
    {
        Account.Info[] memory accounts = new Account.Info[](2);
        accounts[0] = _constants.solidAccount;
        accounts[1] = _constants.liquidAccount;
        return accounts;
    }

    function _constructActionsArray(
        LiquidatorProxyConstants memory _constants,
        LiquidatorProxyCache memory _cache,
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        bytes memory _paraswapCallData
    )
    internal
    view
    returns (Actions.ActionArgs[] memory)
    {
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](2);

        if (_constants.expiry > 0) {
            // First action is a trade for closing the expired account
            // accountId is solidAccount; otherAccountId is liquidAccount
            actions[0] = AccountActionLib.encodeExpiryLiquidateAction(
                _solidAccountId,
                _liquidAccountId,
                _cache.owedMarket,
                _cache.heldMarket,
                address(_constants.expiryProxy),
                _constants.expiry,
                _cache.flipMarkets
            );
        } else {
            // First action is a liquidation
            // accountId is solidAccount; otherAccountId is liquidAccount
            actions[0] = AccountActionLib.encodeLiquidateAction(
                _solidAccountId,
                _liquidAccountId,
                _cache.owedMarket,
                _cache.heldMarket,
                _cache.owedWeiToLiquidate
            );
        }

        actions[1] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _cache.heldMarket,
            _cache.owedMarket,
            /* _trader = */ address(this), // solium-disable-line indentation
            _cache.solidHeldUpdateWithReward,
            _cache.owedWeiToLiquidate,
            _paraswapCallData
        );

        return actions;
    }
}
