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

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Decimal } from "../../protocol/lib/Decimal.sol";
import { Interest } from "../../protocol/lib/Interest.sol";
import { DolomiteMarginMath } from "../../protocol/lib/DolomiteMarginMath.sol";
import { Monetary } from "../../protocol/lib/Monetary.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Time } from "../../protocol/lib/Time.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { HasLiquidatorRegistry } from "../helpers/LiquidatorProxyBase.sol";
import { LiquidatorProxyBase } from "../helpers/LiquidatorProxyBase.sol";

import { IExpiry } from "../interfaces/IExpiry.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";

import { DolomiteAmmRouterProxy } from "./DolomiteAmmRouterProxy.sol";


/**
 * @title LiquidatorProxyV1WithAmm
 * @author Dolomite
 *
 * Contract for liquidating other accounts in DolomiteMargin and atomically selling off collateral via Dolomite AMM
 * markets.
 */
contract LiquidatorProxyV1WithAmm is ReentrancyGuard, LiquidatorProxyBase {
    using DolomiteMarginMath for uint256;
    using SafeMath for uint256;
    using Types for Types.Par;
    using Types for Types.Wei;

    // ============ Constants ============

    bytes32 constant FILE = "LiquidatorProxyV1WithAmm";

    // ============ Events ============

    /**
     * @param solidAccountOwner         The liquidator's address
     * @param solidAccountOwner         The liquidator's account number
     * @param heldMarket                The held market (collateral) that will be received by the liquidator
     * @param heldDeltaWeiWithReward    The amount of heldMarket the liquidator will receive, including the reward
     *                                  (positive number)
     * @param profitHeldWei             The amount of profit the liquidator will realize by performing the liquidation
     *                                  and atomically selling off the collateral. Can be negative or positive.
     * @param owedMarket                The debt market that will be received by the liquidator
     * @param owedDeltaWei              The amount of owedMarket that will be received by the liquidator (negative
     *                                  number)
     */
    event LogLiquidateWithAmm(
        address indexed solidAccountOwner,
        uint256 solidAccountNumber,
        uint256 heldMarket,
        uint256 heldDeltaWeiWithReward,
        Types.Wei profitHeldWei, // calculated as `heldWeiWithReward - soldHeldWeiToBreakEven`
        uint256 owedMarket,
        uint256 owedDeltaWei
    );

    // ============ Storage ============

    IDolomiteMargin public DOLOMITE_MARGIN;
    DolomiteAmmRouterProxy public ROUTER_PROXY;
    IExpiry public EXPIRY_PROXY;

    // ============ Constructor ============

    constructor (
        address dolomiteMargin,
        address dolomiteAmmRouterProxy,
        address expiryProxy,
        address _liquidatorAssetRegistry
    )
        public
        HasLiquidatorRegistry(_liquidatorAssetRegistry)
    {
        DOLOMITE_MARGIN = IDolomiteMargin(dolomiteMargin);
        ROUTER_PROXY = DolomiteAmmRouterProxy(dolomiteAmmRouterProxy);
        EXPIRY_PROXY = IExpiry(expiryProxy);
    }

    // ============ Public Functions ============

    /**
     * Liquidate liquidAccount using solidAccount. This contract and the msg.sender to this contract
     * must both be operators for the solidAccount.
     *
     * @param _solidAccount                 The account that will do the liquidating
     * @param _liquidAccount                The account that will be liquidated
     * @param _owedMarket                   The owed market whose borrowed value will be added to `owedWeiToLiquidate`
     * @param _heldMarket                   The held market whose collateral will be recovered to take on the debt of
     *                                      `owedMarket`
     * @param _tokenPath                    The path through which the trade will be routed to recover the collateral
     * @param _expiry                       The time at which the position expires, if this liquidation is for closing
     *                                      an expired position. Else, 0.
     * @param _minOwedOutputAmount          The minimum amount that should be outputted by the trade from heldWei to
     *                                      owedWei. Used to prevent sandwiching and mem-pool other attacks. Only used
     *                                      if `revertOnFailToSellCollateral` is set to `false` and the collateral
     *                                      cannot cover the `liquidAccount`'s debt.
     * @param _revertOnFailToSellCollateral True to revert the transaction completely if all collateral from the
     *                                      liquidation cannot repay the owed debt. False to swallow the error and sell
     *                                      whatever is possible. If set to false, the liquidator must have sufficient
     *                                      assets to be prevent becoming liquidated or under-collateralized.
     */
    function liquidate(
        Account.Info memory _solidAccount,
        Account.Info memory _liquidAccount,
        uint256 _owedMarket,
        uint256 _heldMarket,
        address[] memory _tokenPath,
        uint256 _expiry,
        uint256 _minOwedOutputAmount,
        bool _revertOnFailToSellCollateral
    )
        public
        nonReentrant
        requireIsAssetWhitelistedForLiquidation(_owedMarket)
        requireIsAssetWhitelistedForLiquidation(_heldMarket)
    {
        // put all values that will not change into a single struct
        LiquidatorProxyConstants memory constants;
        constants.dolomiteMargin = DOLOMITE_MARGIN;
        constants.solidAccount = _solidAccount;
        constants.liquidAccount = _liquidAccount;
        constants.heldMarket = _heldMarket;
        constants.owedMarket = _owedMarket;

        _checkConstants(constants, _expiry);

        constants.liquidMarkets = constants.dolomiteMargin.getAccountMarketsWithBalances(constants.liquidAccount);
        constants.markets = _getMarketInfos(
            constants.dolomiteMargin,
            constants.dolomiteMargin.getAccountMarketsWithBalances(_solidAccount),
            constants.liquidMarkets
        );
        constants.expiryProxy = _expiry > 0 ? EXPIRY_PROXY: IExpiry(address(0)); // don't read EXPIRY; it's not needed
        constants.expiry = uint32(_expiry);

        LiquidatorProxyCache memory cache = _initializeCache(constants);

        // validate the msg.sender and that the liquidAccount can be liquidated
        _checkRequirements(
            constants,
            _heldMarket,
            _owedMarket,
            _tokenPath
        );

        // get the max liquidation amount
        _calculateAndSetMaxLiquidationAmount(cache);

        uint256 totalSolidHeldWei = cache.solidHeldUpdateWithReward;
        if (cache.solidHeldWei.sign) {
            // If the solid account has held wei, add the amount the solid account will receive from liquidation to its
            // total held wei
            // We do this so we can accurately track how much the solid account has (and will have after the swap), in
            // case we need to input it exactly to Router#getParamsForSwapExactTokensForTokens
            totalSolidHeldWei = totalSolidHeldWei.add(cache.solidHeldWei.value);
        }

        address[] memory tokenPathInFrontOfStack = _tokenPath; // used to prevent "stack too deep" error
        (
            Account.Info[] memory accountsForTrade,
            Actions.ActionArgs[] memory actions
        ) = ROUTER_PROXY.getParamsForSwapTokensForExactTokens(
            constants.solidAccount.owner,
            constants.solidAccount.number,
            /* _amountInMaxWei = */ uint(- 1), // solium-disable-line indentation
            cache.owedWeiToLiquidate, // the amount of owedMarket that needs to be repaid. Exact output amount
            tokenPathInFrontOfStack
        );

        if (cache.solidHeldUpdateWithReward >= actions[0].amount.value) {
            uint256 profit = cache.solidHeldUpdateWithReward.sub(actions[0].amount.value);
            emit LogLiquidateWithAmm(
                constants.solidAccount.owner,
                constants.solidAccount.number,
                constants.heldMarket,
                cache.solidHeldUpdateWithReward,
                Types.Wei(true, profit),
                constants.owedMarket,
                cache.owedWeiToLiquidate
            );
        } else {
            if (!_revertOnFailToSellCollateral) { /* FOR COVERAGE TESTING */ }
            Require.that(!_revertOnFailToSellCollateral,
                FILE,
                "totalSolidHeldWei is too small",
                totalSolidHeldWei,
                actions[0].amount.value
            );

            // This value needs to be calculated before `actions` is overwritten below with the new swap parameters
            uint256 profit = actions[0].amount.value.sub(cache.solidHeldUpdateWithReward);
            (accountsForTrade, actions) = ROUTER_PROXY.getParamsForSwapExactTokensForTokens(
                constants.solidAccount.owner,
                constants.solidAccount.number,
                totalSolidHeldWei, // inputWei
                _minOwedOutputAmount,
                tokenPathInFrontOfStack
            );

            emit LogLiquidateWithAmm(
                constants.solidAccount.owner,
                constants.solidAccount.number,
                constants.heldMarket,
                cache.solidHeldUpdateWithReward,
                Types.Wei(false, profit),
                constants.owedMarket,
                cache.owedWeiToLiquidate
            );
        }

        Account.Info[] memory accounts = _constructAccountsArray(constants, accountsForTrade);

        // execute the liquidations
        constants.dolomiteMargin.operate(
            accounts,
            _constructActionsArray(
                constants,
                cache,
                /* _solidAccountId = */ 0, // solium-disable-line indentation
                /* _liquidAccount = */ accounts.length - 1, // solium-disable-line indentation
                actions
            )
        );
    }

    // ============ Internal Functions ============

    /**
     * Make some basic checks before attempting to liquidate an account.
     *  - Ensure `tokenPath` is aligned with `heldMarket` and `owedMarket`
     *  - Basic checks by calling `checkBasicRequirements`
     */
    function _checkRequirements(
        LiquidatorProxyConstants memory _constants,
        uint256 _heldMarket,
        uint256 _owedMarket,
        address[] memory _tokenPath
    )
    internal
    view {
        if (_constants.dolomiteMargin.getMarketIdByTokenAddress(_tokenPath[0]) == _heldMarket) { /* FOR COVERAGE TESTING */ }
        Require.that(_constants.dolomiteMargin.getMarketIdByTokenAddress(_tokenPath[0]) == _heldMarket,
            FILE,
            "0-index token path incorrect",
            _tokenPath[0]
        );

        if (_constants.dolomiteMargin.getMarketIdByTokenAddress(_tokenPath[_tokenPath.length - 1]) == _owedMarket) { /* FOR COVERAGE TESTING */ }
        Require.that(_constants.dolomiteMargin.getMarketIdByTokenAddress(_tokenPath[_tokenPath.length - 1]) == _owedMarket,
            FILE,
            "last-index token path incorrect",
            _tokenPath[_tokenPath.length - 1]
        );

        _checkBasicRequirements(_constants);
    }

    function _constructAccountsArray(
        LiquidatorProxyConstants memory _constants,
        Account.Info[] memory _accountsForTrade
    )
    internal
    pure
    returns (Account.Info[] memory)
    {
        Account.Info[] memory accounts = new Account.Info[](_accountsForTrade.length + 1);
        for (uint256 i = 0; i < _accountsForTrade.length; i++) {
            accounts[i] = _accountsForTrade[i];
        }
      /*assert(
            accounts[0].owner == _constants.solidAccount.owner &&
            accounts[0].number == _constants.solidAccount.number
        );*/

        accounts[accounts.length - 1] = _constants.liquidAccount;
        return accounts;
    }

    function _constructActionsArray(
        LiquidatorProxyConstants memory _constants,
        LiquidatorProxyCache memory _cache,
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        Actions.ActionArgs[] memory _actionsForTrade
    )
    internal
    pure
    returns (Actions.ActionArgs[] memory)
    {
        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](_actionsForTrade.length + 1);

        if (_constants.expiry > 0) {
            // First action is a trade for closing the expired account
            // accountId is solidAccount; otherAccountId is liquidAccount
            actions[0] = AccountActionLib.encodeExpiryLiquidateAction(
                _solidAccountId,
                _liquidAccountId,
                _constants.owedMarket,
                _constants.heldMarket,
                address(_constants.expiryProxy),
                _constants.expiry,
                _cache.solidHeldUpdateWithReward,
                _cache.owedWeiToLiquidate,
                _cache.flipMarketsForExpiration
            );
        } else {
            // First action is a liquidation
            // accountId is solidAccount; otherAccountId is liquidAccount
            actions[0] = AccountActionLib.encodeLiquidateAction(
                _solidAccountId,
                _liquidAccountId,
                _constants.owedMarket,
                _constants.heldMarket,
                _cache.owedWeiToLiquidate
            );
        }

        for (uint256 i = 0; i < _actionsForTrade.length; i++) {
            actions[i + 1] = _actionsForTrade[i];
        }

        return actions;
    }
}
