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
import { IOracleSentinel } from "./interfaces/IOracleSentinel.sol";
import { IPriceOracle } from "./interfaces/IPriceOracle.sol";

import { GettersImpl } from "./impl/GettersImpl.sol";

import { Account } from "./lib/Account.sol";
import { Decimal } from "./lib/Decimal.sol";
import { Interest } from "./lib/Interest.sol";
import { Monetary } from "./lib/Monetary.sol";
import { Storage } from "./lib/Storage.sol";
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
    // ============ Getters for Risk ============

    function getMarginRatio()
        public
        view
        returns (Decimal.D256 memory)
    {
        return GettersImpl.getMarginRatio(g_state);
    }

    function getMarginRatioForAccount(
        address liquidAccountOwner
    )
        external
        view
        returns (Decimal.D256 memory)
    {
        return GettersImpl.getMarginRatioForAccount(g_state, liquidAccountOwner);
    }

    function getLiquidationSpread()
        public
        view
        returns (Decimal.D256 memory)
    {
        return GettersImpl.getLiquidationSpread(g_state);
    }

    function getEarningsRate()
        public
        view
        returns (Decimal.D256 memory)
    {
        return GettersImpl.getEarningsRate(g_state);
    }

    function getMinBorrowedValue()
        public
        view
        returns (Monetary.Value memory)
    {
        return GettersImpl.getMinBorrowedValue(g_state);
    }

    function getAccountMaxNumberOfMarketsWithBalances()
        public
        view
        returns (uint256)
    {
        return GettersImpl.getAccountMaxNumberOfMarketsWithBalances(g_state);
    }

    function getOracleSentinel()
        public
        view
        returns (IOracleSentinel)
    {
        return GettersImpl.getOracleSentinel(g_state);
    }

    function getIsBorrowAllowed()
        public
        view
        returns (bool)
    {
        return GettersImpl.getIsBorrowAllowed(g_state);
    }

    function getIsLiquidationAllowed()
        public
        view
        returns (bool)
    {
        return GettersImpl.getIsLiquidationAllowed(g_state);
    }

    function getMarginRatioOverrideByAccountOwner(
        address accountOwner
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        return GettersImpl.getMarginRatioOverrideByAccountOwner(g_state, accountOwner);
    }

    function getLiquidationSpreadOverrideByAccountOwner(
        address accountOwner
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        return GettersImpl.getLiquidationSpreadOverrideByAccountOwner(g_state, accountOwner);
    }

    function getRiskLimits()
        public
        view
        returns (Storage.RiskLimits memory)
    {
        return GettersImpl.getRiskLimits(g_state);
    }

    // ============ Getters for Markets ============

    function getNumMarkets()
        public
        view
        returns (uint256)
    {
        return GettersImpl.getNumMarkets(g_state);
    }

    function getMarketTokenAddress(
        uint256 marketId
    )
        public
        view
        returns (address)
    {
        return GettersImpl.getMarketTokenAddress(g_state, marketId);
    }

    function getMarketIdByTokenAddress(
        address token
    )
        public
        view
        returns (uint256)
    {
        return GettersImpl.getMarketIdByTokenAddress(g_state, token);
    }

    function getMarketTotalPar(
        uint256 marketId
    )
        public
        view
        returns (Types.TotalPar memory)
    {
        return GettersImpl.getMarketTotalPar(g_state, marketId);
    }

    function getMarketTotalWei(
        uint256 marketId
    )
        public
        view
        returns (Types.TotalWei memory)
    {
        return GettersImpl.getMarketTotalWei(g_state, marketId);
    }

    function getMarketCachedIndex(
        uint256 marketId
    )
        public
        view
        returns (Interest.Index memory)
    {
        return GettersImpl.getMarketCachedIndex(g_state, marketId);
    }

    function getMarketCurrentIndex(
        uint256 marketId
    )
        public
        view
        returns (Interest.Index memory)
    {
        return GettersImpl.getMarketCurrentIndex(g_state, marketId);
    }

    function getMarketPriceOracle(
        uint256 marketId
    )
        public
        view
        returns (IPriceOracle)
    {
        return GettersImpl.getMarketPriceOracle(g_state, marketId);
    }

    function getMarketInterestSetter(
        uint256 marketId
    )
        public
        view
        returns (IInterestSetter)
    {
        return GettersImpl.getMarketInterestSetter(g_state, marketId);
    }

    function getMarketMarginPremium(
        uint256 marketId
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        return GettersImpl.getMarketMarginPremium(g_state, marketId);
    }

    function getMarketLiquidationSpreadPremium(
        uint256 marketId
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        return GettersImpl.getMarketLiquidationSpreadPremium(g_state, marketId);
    }

    function getMarketMaxSupplyWei(
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        return GettersImpl.getMarketMaxSupplyWei(g_state, marketId);
    }

    function getMarketMaxBorrowWei(
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        return GettersImpl.getMarketMaxBorrowWei(g_state, marketId);
    }

    function getMarketEarningsRateOverride(
        uint256 marketId
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        return GettersImpl.getMarketEarningsRateOverride(g_state, marketId);
    }

    function getMarketIsClosing(
        uint256 marketId
    )
        public
        view
        returns (bool)
    {
        return GettersImpl.getMarketIsClosing(g_state, marketId);
    }

    function getMarketPrice(
        uint256 marketId
    )
        public
        view
        returns (Monetary.Price memory)
    {
        return GettersImpl.getMarketPrice(g_state, marketId);
    }

    function getMarketBorrowInterestRatePerSecond(
        uint256 marketId
    )
        public
        view
        returns (Interest.Rate memory)
    {
        return GettersImpl.getMarketBorrowInterestRatePerSecond(g_state, marketId);
    }

    function getMarketBorrowInterestRateApr(
        uint256 marketId
    )
        public
        view
        returns (Interest.Rate memory)
    {
        return GettersImpl.getMarketBorrowInterestRateApr(g_state, marketId);
    }

    function getMarketSupplyInterestRateApr(
        uint256 marketId
    )
        public
        view
        returns (Interest.Rate memory)
    {
        return GettersImpl.getMarketSupplyInterestRateApr(g_state, marketId);
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
        return GettersImpl.getLiquidationSpreadForPair(g_state, liquidAccountOwner, heldMarketId, owedMarketId);
    }

    function getMarket(
        uint256 marketId
    )
        public
        view
        returns (Storage.Market memory)
    {
        return GettersImpl.getMarket(g_state, marketId);
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
        return GettersImpl.getMarketWithInfo(g_state, marketId);
    }

    function getNumExcessTokens(
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        return GettersImpl.getNumExcessTokens(g_state, marketId);
    }

    function getAccountPar(
        Account.Info memory account,
        uint256 marketId
    )
        public
        view
        returns (Types.Par memory)
    {
        return GettersImpl.getAccountPar(g_state, account, marketId);
    }

    function getAccountParNoMarketCheck(
        Account.Info memory account,
        uint256 marketId
    )
        public
        view
        returns (Types.Par memory)
    {
        return GettersImpl.getAccountParNoMarketCheck(g_state, account, marketId);
    }

    function getAccountWei(
        Account.Info memory account,
        uint256 marketId
    )
        public
        view
        returns (Types.Wei memory)
    {
        return GettersImpl.getAccountWei(g_state, account, marketId);
    }

    function getAccountStatus(
        Account.Info memory account
    )
        public
        view
        returns (Account.Status)
    {
        return GettersImpl.getAccountStatus(g_state, account);
    }

    function getAccountMarketsWithBalances(
        Account.Info memory account
    )
        public
        view
        returns (uint256[] memory)
    {
        return GettersImpl.getAccountMarketsWithBalances(g_state, account);
    }

    function getAccountNumberOfMarketsWithBalances(
        Account.Info memory account
    )
        public
        view
        returns (uint256)
    {
        return GettersImpl.getAccountNumberOfMarketsWithBalances(g_state, account);
    }

    function getAccountMarketWithBalanceAtIndex(
        Account.Info memory account,
        uint256 index
    )
        public
        view
        returns (uint256)
    {
        return GettersImpl.getAccountMarketWithBalanceAtIndex(g_state, account, index);
    }

    function getAccountNumberOfMarketsWithDebt(
        Account.Info memory account
    )
        public
        view
        returns (uint256)
    {
        return GettersImpl.getAccountNumberOfMarketsWithDebt(g_state, account);
    }

    function getAccountValues(
        Account.Info memory account
    )
        public
        view
        returns (Monetary.Value memory, Monetary.Value memory)
    {
        return GettersImpl.getAccountValues(g_state, account);
    }

    function getAdjustedAccountValues(
        Account.Info memory account
    )
        public
        view
        returns (Monetary.Value memory, Monetary.Value memory)
    {
        return GettersImpl.getAdjustedAccountValues(g_state, account);
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
        return GettersImpl.getAccountBalances(g_state, account);
    }

    function getIsLocalOperator(
        address owner,
        address operator
    )
        public
        view
        returns (bool)
    {
        return GettersImpl.getIsLocalOperator(g_state, owner, operator);
    }

    function getIsGlobalOperator(
        address operator
    )
        public
        view
        returns (bool)
    {
        return GettersImpl.getIsGlobalOperator(g_state, operator);
    }

    function getIsAutoTraderSpecial(
        address autoTrader
    )
        public
        view
        returns (bool)
    {
        return GettersImpl.getIsAutoTraderSpecial(g_state, autoTrader);
    }
}
