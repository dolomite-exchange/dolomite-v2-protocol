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

import { IAccountRiskOverrideSetter } from "../interfaces/IAccountRiskOverrideSetter.sol";
import { IInterestSetter } from "../interfaces/IInterestSetter.sol";
import { IOracleSentinel } from "../interfaces/IOracleSentinel.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";

import { Account } from "../lib/Account.sol";
import { Cache } from "../lib/Cache.sol";
import { Decimal } from "../lib/Decimal.sol";
import { DolomiteMarginMath } from "../lib/DolomiteMarginMath.sol";
import { Interest } from "../lib/Interest.sol";
import { Monetary } from "../lib/Monetary.sol";
import { Require } from "../lib/Require.sol";
import { Storage } from "../lib/Storage.sol";
import { Token } from "../lib/Token.sol";
import { Types } from "../lib/Types.sol";


/**
 * @title GettersImpl
 * @author Dolomite
 *
 * Getter functions for data retrieval
 */
library GettersImpl {
    using Cache for Cache.MarketCache;
    using DolomiteMarginMath for uint256;
    using Storage for Storage.State;
    using Token for address;
    using Types for Types.Wei;

    // ============ Constants ============

    bytes32 constant FILE = "GettersImpl";

    uint256 constant SECONDS_PER_YEAR = 365 days;

    // ============ Public Functions ============

    function getMarginRatio(
        Storage.State storage state
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        return state.riskParams.marginRatio;
    }

    function getMarginRatioForAccount(
        Storage.State storage state,
        address accountOwner
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        (Decimal.D256 memory marginRatio,) = state.getAccountRiskOverride(accountOwner);
        if (marginRatio.value == 0) {
            marginRatio = state.riskParams.marginRatio;
        }
        return marginRatio;
    }

    function getLiquidationSpread(
        Storage.State storage state
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        return state.riskParams.liquidationSpread;
    }

    function getEarningsRate(
        Storage.State storage state
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        return state.riskParams.earningsRate;
    }

    function getMinBorrowedValue(
        Storage.State storage state
    )
        public
        view
        returns (Monetary.Value memory)
    {
        return state.riskParams.minBorrowedValue;
    }

    function getAccountMaxNumberOfMarketsWithBalances(
        Storage.State storage state
    )
        public
        view
        returns (uint256)
    {
        return state.riskParams.accountMaxNumberOfMarketsWithBalances;
    }

    function getOracleSentinel(
        Storage.State storage state
    )
        public
        view
        returns (IOracleSentinel)
    {
        return state.riskParams.oracleSentinel;
    }

    function getIsBorrowAllowed(
        Storage.State storage state
    )
        public
        view
        returns (bool)
    {
        return state.riskParams.oracleSentinel.isBorrowAllowed();
    }

    function getIsLiquidationAllowed(
        Storage.State storage state
    )
        public
        view
        returns (bool)
    {
        return state.riskParams.oracleSentinel.isLiquidationAllowed();
    }

    function getAccountRiskOverrideSetterByAccountOwner(
        Storage.State storage state,
        address accountOwner
    )
        public
        view
        returns (IAccountRiskOverrideSetter)
    {
        return state.riskParams.accountRiskOverrideSetterMap[accountOwner];
    }

    function getAccountRiskOverrideByAccountOwner(
        Storage.State storage state,
        address accountOwner
    )
        public
        view
        returns (Decimal.D256 memory marginRatioOverride, Decimal.D256 memory liquidationSpreadOverride)
    {
        (marginRatioOverride, liquidationSpreadOverride) = state.getAccountRiskOverride(accountOwner);
    }

    function getMarginRatioOverrideByAccountOwner(
        Storage.State storage state,
        address accountOwner
    )
        public
        view
        returns (Decimal.D256 memory marginRatioOverride)
    {
        (marginRatioOverride,) = state.getAccountRiskOverride(accountOwner);
    }

    function getLiquidationSpreadOverrideByAccountOwner(
        Storage.State storage state,
        address accountOwner
    )
        public
        view
        returns (Decimal.D256 memory liquidationSpreadOverride)
    {
        (, liquidationSpreadOverride) = state.getAccountRiskOverride(accountOwner);
    }

    function getRiskLimits(
        Storage.State storage state
    )
        public
        view
        returns (Storage.RiskLimits memory)
    {
        return state.riskLimits;
    }

    function getNumMarkets(
        Storage.State storage state
    )
        public
        view
        returns (uint256)
    {
        return state.numMarkets;
    }

    function getMarketTokenAddress(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (address)
    {
        _requireValidMarket(state, marketId);
        return state.getToken(marketId);
    }

    function getMarketIdByTokenAddress(
        Storage.State storage state,
        address token
    )
        public
        view
        returns (uint256)
    {
        _requireValidToken(state, token);
        return state.tokenToMarketId[token];
    }

    function getMarketIsClosing(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (bool)
    {
        _requireValidMarket(state, marketId);
        return state.markets[marketId].isClosing;
    }

    function getMarketPrice(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Monetary.Price memory)
    {
        _requireValidMarket(state, marketId);
        return state.fetchPrice(marketId, state.getToken(marketId));
    }

    function getMarketTotalPar(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Types.TotalPar memory)
    {
        _requireValidMarket(state, marketId);
        return state.getTotalPar(marketId);
    }

    function getMarketTotalWei(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Types.TotalWei memory)
    {
        _requireValidMarket(state, marketId);
        Types.TotalPar memory totalPar = getMarketTotalPar(state, marketId);
        Interest.Index memory index = getMarketCurrentIndex(state, marketId);
        (Types.Wei memory supplyWei, Types.Wei memory borrowWei) = Interest.totalParToWei(totalPar, index);

        return Types.TotalWei({
            borrow: borrowWei.value.to128(),
            supply: supplyWei.value.to128()
        });
    }

    function getMarketCachedIndex(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Interest.Index memory)
    {
        _requireValidMarket(state, marketId);
        return state.getIndex(marketId);
    }

    function getMarketCurrentIndex(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Interest.Index memory)
    {
        _requireValidMarket(state, marketId);
        return state.fetchNewIndex(marketId, state.getIndex(marketId));
    }

    function getMarketPriceOracle(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (IPriceOracle)
    {
        _requireValidMarket(state, marketId);
        return state.markets[marketId].priceOracle;
    }

    function getMarketInterestSetter(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (IInterestSetter)
    {
        _requireValidMarket(state, marketId);
        return state.markets[marketId].interestSetter;
    }

    function getMarketMarginPremium(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        _requireValidMarket(state, marketId);
        return state.markets[marketId].marginPremium;
    }

    function getMarketLiquidationSpreadPremium(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        _requireValidMarket(state, marketId);
        return state.markets[marketId].liquidationSpreadPremium;
    }

    function getMarketMaxSupplyWei(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        _requireValidMarket(state, marketId);
        return state.markets[marketId].maxSupplyWei;
    }

    function getMarketMaxBorrowWei(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        _requireValidMarket(state, marketId);
        return state.markets[marketId].maxBorrowWei;
    }

    function getMarketEarningsRateOverride(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        _requireValidMarket(state, marketId);
        return state.markets[marketId].earningsRateOverride;
    }

    function getMarketBorrowInterestRatePerSecond(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Interest.Rate memory)
    {
        _requireValidMarket(state, marketId);
        return state.fetchInterestRate(
            marketId,
            state.getIndex(marketId)
        );
    }

    function getMarketBorrowInterestRateApr(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Interest.Rate memory)
    {
        Interest.Rate memory rate = getMarketBorrowInterestRatePerSecond(state, marketId);
        rate.value = rate.value * SECONDS_PER_YEAR;
        return rate;
    }

    function getMarketSupplyInterestRateApr(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Interest.Rate memory)
    {
        Types.TotalWei memory totalWei = getMarketTotalWei(state, marketId);
        if (totalWei.supply == 0) {
            return Interest.Rate({
                value: 0
            });
        }

        Interest.Rate memory borrowRate = getMarketBorrowInterestRateApr(state, marketId);
        Decimal.D256 memory earningsRate = getMarketEarningsRateOverride(state, marketId);
        if (earningsRate.value == 0) {
            earningsRate = getEarningsRate(state);
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

    function getLiquidationSpreadForAccountAndPair(
        Storage.State storage state,
        address accountOwner,
        uint256 heldMarketId,
        uint256 owedMarketId
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        _requireValidMarket(state, heldMarketId);
        _requireValidMarket(state, owedMarketId);
        return state.getLiquidationSpreadForAccountAndPair(accountOwner, heldMarketId, owedMarketId);
    }

    function getMarket(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Storage.Market memory)
    {
        _requireValidMarket(state, marketId);
        return state.markets[marketId];
    }

    function getMarketWithInfo(
        Storage.State storage state,
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
        _requireValidMarket(state, marketId);
        return (
            getMarket(state, marketId),
            getMarketCurrentIndex(state, marketId),
            getMarketPrice(state, marketId),
            getMarketBorrowInterestRatePerSecond(state, marketId)
        );
    }

    function getNumExcessTokens(
        Storage.State storage state,
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        _requireValidMarket(state, marketId);
        return state.getNumExcessTokens(marketId);
    }

    function getAccountPar(
        Storage.State storage state,
        Account.Info memory account,
        uint256 marketId
    )
        public
        view
        returns (Types.Par memory)
    {
        _requireValidMarket(state, marketId);
        return state.getPar(account, marketId);
    }

    function getAccountWei(
        Storage.State storage state,
        Account.Info memory account,
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        _requireValidMarket(state, marketId);
        return Interest.parToWei(
            state.getPar(account, marketId),
            state.fetchNewIndex(marketId, state.getIndex(marketId))
        );
    }

    function getAccountStatus(
        Storage.State storage state,
        Account.Info memory account
    )
        public
        view
        returns (Account.Status)
    {
        return state.getStatus(account);
    }

    function getAccountMarketsWithBalances(
        Storage.State storage state,
        Account.Info memory account
    )
        public
        view
        returns (uint256[] memory)
    {
        return state.getMarketsWithBalances(account);
    }

    function getAccountNumberOfMarketsWithBalances(
        Storage.State storage state,
        Account.Info memory account
    )
        public
        view
        returns (uint256)
    {
        return state.getNumberOfMarketsWithBalances(account);
    }

    function getAccountMarketWithBalanceAtIndex(
        Storage.State storage state,
        Account.Info memory account,
        uint256 index
    )
        public
        view
        returns (uint256)
    {
        return state.getAccountMarketWithBalanceAtIndex(account, index);
    }

    function getAccountNumberOfMarketsWithDebt(
        Storage.State storage state,
        Account.Info memory account
    )
        public
        view
        returns (uint256)
    {
        return state.getAccountNumberOfMarketsWithDebt(account);
    }

    function getAccountValues(
        Storage.State storage state,
        Account.Info memory account
    )
        public
        view
        returns (Monetary.Value memory, Monetary.Value memory)
    {
        return _getAccountValuesInternal(state, account, /* adjustForLiquidity = */ false);
    }

    function getAdjustedAccountValues(
        Storage.State storage state,
        Account.Info memory account
    )
        public
        view
        returns (Monetary.Value memory, Monetary.Value memory)
    {
        return _getAccountValuesInternal(state, account, /* adjustForLiquidity = */ true);
    }

    function getAccountBalances(
        Storage.State storage state,
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
        uint256[] memory markets = state.getMarketsWithBalances(account);
        address[] memory tokens = new address[](markets.length);
        Types.Par[] memory pars = new Types.Par[](markets.length);
        Types.Wei[] memory weis = new Types.Wei[](markets.length);

        for (uint256 i = 0; i < markets.length; i++) {
            tokens[i] = getMarketTokenAddress(state, markets[i]);
            pars[i] = getAccountPar(state, account, markets[i]);
            weis[i] = getAccountWei(state, account, markets[i]);
        }

        return (
            markets,
            tokens,
            pars,
            weis
        );
    }

    function getIsLocalOperator(
        Storage.State storage state,
        address owner,
        address operator
    )
        public
        view
        returns (bool)
    {
        return state.isLocalOperator(owner, operator);
    }

    function getIsGlobalOperator(
        Storage.State storage state,
        address operator
    )
        public
        view
        returns (bool)
    {
        return state.isGlobalOperator(operator);
    }

    function getIsAutoTraderSpecial(
        Storage.State storage state,
        address autoTrader
    )
        public
        view
        returns (bool)
    {
        return state.isAutoTraderSpecial(autoTrader);
    }

    // ============ Internal/Private Helper Functions ============

    /**
     * Revert if marketId is invalid.
     */
    function _requireValidMarket(
        Storage.State storage state,
        uint256 marketId
    )
    internal
    view
    {
        Require.that(
            marketId < state.numMarkets && state.markets[marketId].token != address(0),
            FILE,
            "Invalid market"
        );
    }

    function _requireValidToken(
        Storage.State storage state,
        address token
    )
    private
    view
    {
        Require.that(
            token == state.markets[state.tokenToMarketId[token]].token,
            FILE,
            "Invalid token"
        );
    }

    /**
     * Private helper for getting the monetary values of an account.
     */
    function _getAccountValuesInternal(
        Storage.State storage state,
        Account.Info memory account,
        bool adjustForLiquidity
    )
    private
    view
    returns (Monetary.Value memory, Monetary.Value memory)
    {
        uint256[] memory markets = state.getMarketsWithBalances(account);

        // populate cache
        Cache.MarketCache memory cache = Cache.create(markets.length);
        for (uint256 i = 0; i < markets.length; i++) {
            cache.set(markets[i]);
        }
        state.initializeCache(cache, /* fetchFreshIndex = */ true);

        return state.getAccountValues(account, cache, adjustForLiquidity);
    }
}
