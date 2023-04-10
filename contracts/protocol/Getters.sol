/*

    Copyright 2019 dYdX Trading Inc.

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

import { IDolomiteMargin } from "./interfaces/IDolomiteMargin.sol";
import { IInterestSetter } from "./interfaces/IInterestSetter.sol";
import { IPriceOracle } from "./interfaces/IPriceOracle.sol";

import { Account } from "./lib/Account.sol";
import { Cache } from "./lib/Cache.sol";
import { Decimal } from "./lib/Decimal.sol";
import { DolomiteMarginMath } from "./lib/DolomiteMarginMath.sol";
import { EnumerableSet } from "./lib/EnumerableSet.sol";
import { Interest } from "./lib/Interest.sol";
import { Monetary } from "./lib/Monetary.sol";
import { Require } from "./lib/Require.sol";
import { Storage } from "./lib/Storage.sol";
import { Token } from "./lib/Token.sol";
import { Types } from "./lib/Types.sol";

import { State } from "./State.sol";


/**
 * @title Getters
 * @author dYdX
 *
 * Public read-only functions that allow transparency into the state of DolomiteMargin
 */
contract Getters is
    IDolomiteMargin,
    State
{
    using Cache for Cache.MarketCache;
    using DolomiteMarginMath for uint256;
    using Storage for Storage.State;
    using Types for Types.Par;
    using EnumerableSet for EnumerableSet.Set;

    // ============ Constants ============

    bytes32 FILE = "Getters";

    uint256 public constant SECONDS_PER_YEAR = 31_536_000;

    // ============ Getters for Risk ============

    function getMarginRatio()
        public
        view
        returns (Decimal.D256 memory)
    {
        return g_state.riskParams.marginRatio;
    }

    function getMarginRatioForAccount(
        address liquidAccountOwner
    )
        external
        view
        returns (Decimal.D256 memory)
    {
        Decimal.D256 memory ratio =  g_state.riskParams.marginRatioOverrideMap[liquidAccountOwner];
        if (ratio.value == 0) {
            ratio = g_state.riskParams.marginRatio;
        }
        return ratio;
    }

    function getLiquidationSpread()
        public
        view
        returns (Decimal.D256 memory)
    {
        return g_state.riskParams.liquidationSpread;
    }

    function getEarningsRate()
        public
        view
        returns (Decimal.D256 memory)
    {
        return g_state.riskParams.earningsRate;
    }

    function getMinBorrowedValue()
        public
        view
        returns (Monetary.Value memory)
    {
        return g_state.riskParams.minBorrowedValue;
    }

    function getAccountMaxNumberOfMarketsWithBalances()
        public
        view
        returns (uint256)
    {
        return g_state.riskParams.accountMaxNumberOfMarketsWithBalances;
    }

    function getMarginRatioOverrideByAccountOwner(
        address accountOwner
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        return g_state.riskParams.marginRatioOverrideMap[accountOwner];
    }

    function getLiquidationSpreadOverrideByAccountOwner(
        address accountOwner
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        return g_state.riskParams.liquidationSpreadOverrideMap[accountOwner];
    }

    function getRiskLimits()
        public
        view
        returns (Storage.RiskLimits memory)
    {
        return g_state.riskLimits;
    }

    // ============ Getters for Markets ============

    function getNumMarkets()
        public
        view
        returns (uint256)
    {
        return g_state.numMarkets;
    }

    function getMarketTokenAddress(
        uint256 marketId
    )
        public
        view
        returns (address)
    {
        _requireValidMarket(marketId);
        return g_state.getToken(marketId);
    }

    function getMarketIdByTokenAddress(
        address token
    )
        public
        view
        returns (uint256)
    {
        _requireValidToken(token);
        return g_state.tokenToMarketId[token];
    }

    function getMarketTotalPar(
        uint256 marketId
    )
        public
        view
        returns (Types.TotalPar memory)
    {
        _requireValidMarket(marketId);
        return g_state.getTotalPar(marketId);
    }

    function getMarketTotalWei(
        uint256 marketId
    )
        public
        view
        returns (Types.TotalWei memory)
    {
        _requireValidMarket(marketId);

        Types.TotalPar memory totalPar = g_state.getTotalPar(marketId);
        Interest.Index memory index = getMarketCurrentIndex(marketId);
        (Types.Wei memory supplyWei, Types.Wei memory borrowWei) = Interest.totalParToWei(totalPar, index);

        return Types.TotalWei({
            borrow: borrowWei.value.to128(),
            supply: supplyWei.value.to128()
        });
    }

    function getMarketCachedIndex(
        uint256 marketId
    )
        public
        view
        returns (Interest.Index memory)
    {
        _requireValidMarket(marketId);
        return g_state.getIndex(marketId);
    }

    function getMarketCurrentIndex(
        uint256 marketId
    )
        public
        view
        returns (Interest.Index memory)
    {
        _requireValidMarket(marketId);
        return g_state.fetchNewIndex(marketId, g_state.getIndex(marketId));
    }

    function getMarketPriceOracle(
        uint256 marketId
    )
        public
        view
        returns (IPriceOracle)
    {
        _requireValidMarket(marketId);
        return g_state.markets[marketId].priceOracle;
    }

    function getMarketInterestSetter(
        uint256 marketId
    )
        public
        view
        returns (IInterestSetter)
    {
        _requireValidMarket(marketId);
        return g_state.markets[marketId].interestSetter;
    }

    function getMarketMarginPremium(
        uint256 marketId
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        _requireValidMarket(marketId);
        return g_state.markets[marketId].marginPremium;
    }

    function getMarketLiquidationSpreadPremium(
        uint256 marketId
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        _requireValidMarket(marketId);
        return g_state.markets[marketId].liquidationSpreadPremium;
    }

    function getMarketMaxSupplyWei(
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        _requireValidMarket(marketId);
        return g_state.markets[marketId].maxSupplyWei;
    }

    function getMarketMaxBorrowWei(
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        _requireValidMarket(marketId);
        return g_state.markets[marketId].maxBorrowWei;
    }

    function getMarketEarningsRateOverride(
        uint256 marketId
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        _requireValidMarket(marketId);
        return g_state.markets[marketId].earningsRateOverride;
    }

    function getMarketIsClosing(
        uint256 marketId
    )
        public
        view
        returns (bool)
    {
        _requireValidMarket(marketId);
        return g_state.markets[marketId].isClosing;
    }

    function getMarketPrice(
        uint256 marketId
    )
        public
        view
        returns (Monetary.Price memory)
    {
        _requireValidMarket(marketId);
        return g_state.fetchPrice(marketId, g_state.getToken(marketId));
    }

    function getMarketBorrowInterestRate(
        uint256 marketId
    )
        public
        view
        returns (Interest.Rate memory)
    {
        _requireValidMarket(marketId);
        return g_state.fetchInterestRate(
            marketId,
            g_state.getIndex(marketId)
        );
    }

    function getMarketBorrowInterestRateApr(
        uint256 marketId
    )
        public
        view
        returns (Interest.Rate memory)
    {
        _requireValidMarket(marketId);
        Interest.Rate memory rate = getMarketBorrowInterestRate(marketId);
        rate.value = rate.value * SECONDS_PER_YEAR;
        return rate;
    }

    function getMarketSupplyInterestRateApr(
        uint256 marketId
    )
        public
        view
        returns (Interest.Rate memory)
    {
        _requireValidMarket(marketId);
        Types.TotalWei memory totalWei = getMarketTotalWei(marketId);
        if (totalWei.supply == 0) {
            return Interest.Rate({
                value: 0
            });
        }

        Interest.Rate memory borrowRate = getMarketBorrowInterestRateApr(marketId);
        Decimal.D256 memory earningsRate = g_state.markets[marketId].earningsRateOverride;
        if (earningsRate.value == 0) {
            earningsRate = g_state.riskParams.earningsRate;
        }

        uint256 supplyRate = Decimal.mul(borrowRate.value, earningsRate);
        if (totalWei.borrow < totalWei.supply) {
            // scale down the interest by the amount being supplied. Why? Because interest is only being paid on
            // the borrowWei, which means it's split amongst all of the supplyWei. Scaling it down normalizes it
            // for the suppliers to share what's being paid by borrowers
            supplyRate = supplyRate.getPartial(totalWei.borrow, totalWei.supply);
        }

        return Interest.Rate({
            value: supplyRate
        });
    }

    function getLiquidationSpreadForPair(
        address liquidAccountOwner,
        uint256 heldMarketId,
        uint256 owedMarketId
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        _requireValidMarket(heldMarketId);
        _requireValidMarket(owedMarketId);
        return g_state.getLiquidationSpreadForPair(liquidAccountOwner, heldMarketId, owedMarketId);
    }

    function getMarket(
        uint256 marketId
    )
        public
        view
        returns (Storage.Market memory)
    {
        _requireValidMarket(marketId);
        return g_state.markets[marketId];
    }

    function getMarketWithInfo(
        uint256 marketId
    )
        public
        view
        returns (
            Storage.Market memory,
            Interest.Index memory,
            Monetary.Price memory,
            Interest.Rate memory
        )
    {
        _requireValidMarket(marketId);
        return (
            getMarket(marketId),
            getMarketCurrentIndex(marketId),
            getMarketPrice(marketId),
            getMarketBorrowInterestRate(marketId)
        );
    }

    function getNumExcessTokens(
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        _requireValidMarket(marketId);
        return g_state.getNumExcessTokens(marketId);
    }

    function getAccountPar(
        Account.Info memory account,
        uint256 marketId
    )
        public
        view
        returns (Types.Par memory)
    {
        _requireValidMarket(marketId);
        return g_state.getPar(account, marketId);
    }

    function getAccountParNoMarketCheck(
        Account.Info memory account,
        uint256 marketId
    )
        public
        view
        returns (Types.Par memory)
    {
        return g_state.getPar(account, marketId);
    }

    function getAccountWei(
        Account.Info memory account,
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        _requireValidMarket(marketId);
        return Interest.parToWei(
            g_state.getPar(account, marketId),
            g_state.fetchNewIndex(marketId, g_state.getIndex(marketId))
        );
    }

    function getAccountStatus(
        Account.Info memory account
    )
        public
        view
        returns (Account.Status)
    {
        return g_state.getStatus(account);
    }

    function getAccountMarketsWithBalances(
        Account.Info memory account
    )
        public
        view
        returns (uint256[] memory)
    {
        return g_state.getMarketsWithBalances(account);
    }

    function getAccountNumberOfMarketsWithBalances(
        Account.Info memory account
    )
        public
        view
        returns (uint256)
    {
        return g_state.getNumberOfMarketsWithBalances(account);
    }

    function getAccountMarketWithBalanceAtIndex(
        Account.Info memory account,
        uint256 index
    )
        public
        view
        returns (uint256)
    {
        return g_state.getAccountMarketWithBalanceAtIndex(account, index);
    }

    function getAccountNumberOfMarketsWithDebt(
        Account.Info memory account
    )
        public
        view
        returns (uint256)
    {
        return g_state.getAccountNumberOfMarketsWithDebt(account);
    }

    function getAccountValues(
        Account.Info memory account
    )
        public
        view
        returns (Monetary.Value memory, Monetary.Value memory)
    {
        return _getAccountValuesInternal(account, /* adjustForLiquidity = */ false);
    }

    function getAdjustedAccountValues(
        Account.Info memory account
    )
        public
        view
        returns (Monetary.Value memory, Monetary.Value memory)
    {
        return _getAccountValuesInternal(account, /* adjustForLiquidity = */ true);
    }

    function getAccountBalances(
        Account.Info memory account
    )
        public
        view
        returns (
            uint[] memory,
            address[] memory,
            Types.Par[] memory,
            Types.Wei[] memory
        )
    {
        uint256[] memory markets = g_state.getMarketsWithBalances(account);
        address[] memory tokens = new address[](markets.length);
        Types.Par[] memory pars = new Types.Par[](markets.length);
        Types.Wei[] memory weis = new Types.Wei[](markets.length);

        for (uint256 i = 0; i < markets.length; i++) {
            tokens[i] = getMarketTokenAddress(markets[i]);
            pars[i] = getAccountPar(account, markets[i]);
            weis[i] = getAccountWei(account, markets[i]);
        }

        return (
            markets,
            tokens,
            pars,
            weis
        );
    }

    function getIsLocalOperator(
        address owner,
        address operator
    )
        public
        view
        returns (bool)
    {
        return g_state.isLocalOperator(owner, operator);
    }

    function getIsGlobalOperator(
        address operator
    )
        public
        view
        returns (bool)
    {
        return g_state.isGlobalOperator(operator);
    }

    function getIsAutoTraderSpecial(
        address autoTrader
    )
        public
        view
        returns (bool)
    {
        return g_state.isAutoTraderSpecial(autoTrader);
    }

    // ============ Internal/Private Helper Functions ============

    /**
     * Revert if marketId is invalid.
     */
    function _requireValidMarket(
        uint256 marketId
    )
        internal
        view
    {
        Require.that(
            marketId < g_state.numMarkets && g_state.markets[marketId].token != address(0),
            FILE,
            "Invalid market"
        );
    }

    function _requireValidToken(
        address token
    )
        private
        view
    {
        Require.that(
            token == g_state.markets[g_state.tokenToMarketId[token]].token,
            FILE,
            "Invalid token"
        );
    }

    /**
     * Private helper for getting the monetary values of an account.
     */
    function _getAccountValuesInternal(
        Account.Info memory account,
        bool adjustForLiquidity
    )
        private
        view
        returns (Monetary.Value memory, Monetary.Value memory)
    {
        uint256[] memory markets = g_state.getMarketsWithBalances(account);

        // populate cache
        Cache.MarketCache memory cache = Cache.create(markets.length);
        for (uint256 i = 0; i < markets.length; i++) {
            cache.set(markets[i]);
        }
        g_state.initializeCache(cache);

        return g_state.getAccountValues(account, cache, adjustForLiquidity);
    }
}
