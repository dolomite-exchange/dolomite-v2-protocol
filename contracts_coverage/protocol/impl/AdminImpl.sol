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

import { IERC20Detailed } from "../interfaces/IERC20Detailed.sol";
import { IAccountRiskOverrideSetter } from "../interfaces/IAccountRiskOverrideSetter.sol";
import { IInterestSetter } from "../interfaces/IInterestSetter.sol";
import { IOracleSentinel } from "../interfaces/IOracleSentinel.sol";
import { IPriceOracle } from "../interfaces/IPriceOracle.sol";

import { Decimal } from "../lib/Decimal.sol";
import { Interest } from "../lib/Interest.sol";
import { DolomiteMarginMath } from "../lib/DolomiteMarginMath.sol";
import { Monetary } from "../lib/Monetary.sol";
import { Require } from "../lib/Require.sol";
import { Storage } from "../lib/Storage.sol";
import { Token } from "../lib/Token.sol";
import { Types } from "../lib/Types.sol";


/**
 * @title AdminImpl
 * @author dYdX
 *
 * Administrative functions to keep the protocol updated
 */
library AdminImpl {
    using DolomiteMarginMath for uint256;
    using Storage for Storage.State;
    using Token for address;
    using Types for Types.Wei;

    // ============ Constants ============

    bytes32 constant FILE = "AdminImpl";

    // ============ Events ============

    event LogWithdrawExcessTokens(
        address token,
        uint256 amount
    );

    event LogWithdrawUnsupportedTokens(
        address token,
        uint256 amount
    );

    event LogAddMarket(
        uint256 marketId,
        address token
    );

    event LogSetIsClosing(
        uint256 marketId,
        bool isClosing
    );

    event LogSetPriceOracle(
        uint256 marketId,
        address priceOracle
    );

    event LogSetInterestSetter(
        uint256 marketId,
        address interestSetter
    );

    event LogSetMarginPremium(
        uint256 marketId,
        Decimal.D256 marginPremium
    );

    event LogSetLiquidationSpreadPremium(
        uint256 marketId,
        Decimal.D256 liquidationSpreadPremium
    );

    event LogSetMaxSupplyWei(
        uint256 marketId,
        Types.Wei maxSupplyWei
    );

    event LogSetMaxBorrowWei(
        uint256 marketId,
        Types.Wei maxBorrowWei
    );

    event LogSetEarningsRateOverride(
        uint256 marketId,
        Decimal.D256 earningsRateOverride
    );

    event LogSetMarginRatio(
        Decimal.D256 marginRatio
    );

    event LogSetLiquidationSpread(
        Decimal.D256 liquidationSpread
    );

    event LogSetEarningsRate(
        Decimal.D256 earningsRate
    );

    event LogSetMinBorrowedValue(
        Monetary.Value minBorrowedValue
    );

    event LogSetAccountMaxNumberOfMarketsWithBalances(
        uint256 accountMaxNumberOfMarketsWithBalances
    );

    event LogSetOracleSentinel(
        IOracleSentinel oracleSentinel
    );

    event LogSetAccountRiskOverrideSetter(
        address accountOwner,
        IAccountRiskOverrideSetter accountRiskOverrideSetter
    );

    event LogSetGlobalOperator(
        address operator,
        bool approved
    );

    event LogSetAutoTraderIsSpecial(
        address autoTrader,
        bool isSpecial
    );

    // ============ Token Functions ============

    function ownerWithdrawExcessTokens(
        Storage.State storage state,
        uint256 marketId,
        address recipient
    )
    public
    returns (uint256)
    {
        _validateMarketId(state, marketId);
        Types.Wei memory excessWei = state.getNumExcessTokens(marketId);

        if (!excessWei.isNegative()) { /* FOR COVERAGE TESTING */ }
        Require.that(!excessWei.isNegative(),
            FILE,
            "Negative excess"
        );

        address token = state.getToken(marketId);

        uint256 actualBalance = IERC20Detailed(token).balanceOf(address(this));
        if (excessWei.value > actualBalance) {
            excessWei.value = actualBalance;
        }

        token.transfer(recipient, excessWei.value);

        emit LogWithdrawExcessTokens(token, excessWei.value);

        return excessWei.value;
    }

    function ownerWithdrawUnsupportedTokens(
        Storage.State storage state,
        address token,
        address recipient
    )
    public
    returns (uint256)
    {
        _requireNoMarket(state, token);

        uint256 balance = IERC20Detailed(token).balanceOf(address(this));
        token.transfer(recipient, balance);

        emit LogWithdrawUnsupportedTokens(token, balance);

        return balance;
    }

    // ============ Market Functions ============

    function ownerAddMarket(
        Storage.State storage state,
        address token,
        IPriceOracle priceOracle,
        IInterestSetter interestSetter,
        Decimal.D256 memory marginPremium,
        Decimal.D256 memory liquidationSpreadPremium,
        uint256 maxSupplyWei,
        uint256 maxBorrowWei,
        Decimal.D256 memory earningsRateOverride,
        bool isClosing
    )
    public
    {
        _requireNoMarket(state, token);

        uint256 marketId = state.numMarkets;
        state.numMarkets += 1;

        state.markets[marketId].token = token;
        state.markets[marketId].index = Interest.newIndex();
        state.markets[marketId].isClosing = isClosing;
        state.tokenToMarketId[token] = marketId;

        emit LogAddMarket(marketId, token);
        if (isClosing) {
            emit LogSetIsClosing(marketId, isClosing);
        }

        _setPriceOracle(state, marketId, priceOracle);
        _setInterestSetter(state, marketId, interestSetter);
        _setMarginPremium(state, marketId, marginPremium);
        _setLiquidationSpreadPremium(state, marketId, liquidationSpreadPremium);
        _setMaxSupplyWei(state, marketId, maxSupplyWei);
        _setMaxBorrowWei(state, marketId, maxBorrowWei);
        _setEarningsRateOverride(state, marketId, earningsRateOverride);
    }

    function ownerSetIsClosing(
        Storage.State storage state,
        uint256 marketId,
        bool isClosing
    )
    public
    {
        _validateMarketId(state, marketId);

        state.markets[marketId].isClosing = isClosing;
        emit LogSetIsClosing(marketId, isClosing);
    }

    function ownerSetPriceOracle(
        Storage.State storage state,
        uint256 marketId,
        IPriceOracle priceOracle
    )
    public
    {
        _validateMarketId(state, marketId);
        _setPriceOracle(state, marketId, priceOracle);
    }

    function ownerSetInterestSetter(
        Storage.State storage state,
        uint256 marketId,
        IInterestSetter interestSetter
    )
    public
    {
        _validateMarketId(state, marketId);
        _setInterestSetter(state, marketId, interestSetter);
    }

    function ownerSetMarginPremium(
        Storage.State storage state,
        uint256 marketId,
        Decimal.D256 memory marginPremium
    )
    public
    {
        _validateMarketId(state, marketId);
        _setMarginPremium(state, marketId, marginPremium);
    }

    function ownerSetLiquidationSpreadPremium(
        Storage.State storage state,
        uint256 marketId,
        Decimal.D256 memory liquidationSpreadPremium
    )
    public
    {
        _validateMarketId(state, marketId);
        _setLiquidationSpreadPremium(state, marketId, liquidationSpreadPremium);
    }

    function ownerSetMaxSupplyWei(
        Storage.State storage state,
        uint256 marketId,
        uint256 maxSupplyWei
    )
    public
    {
        _validateMarketId(state, marketId);
        _setMaxSupplyWei(state, marketId, maxSupplyWei);
    }

    function ownerSetMaxBorrowWei(
        Storage.State storage state,
        uint256 marketId,
        uint256 maxBorrowWei
    )
    public
    {
        _validateMarketId(state, marketId);
        _setMaxBorrowWei(state, marketId, maxBorrowWei);
    }

    function ownerSetEarningsRateOverride(
        Storage.State storage state,
        uint256 marketId,
        Decimal.D256 memory earningsRateOverride
    )
    public
    {
        _validateMarketId(state, marketId);
        _setEarningsRateOverride(state, marketId, earningsRateOverride);
    }

    // ============ Risk Functions ============

    function ownerSetMarginRatio(
        Storage.State storage state,
        Decimal.D256 memory ratio
    )
    public
    {
        if (ratio.value <= state.riskLimits.marginRatioMax) { /* FOR COVERAGE TESTING */ }
        Require.that(ratio.value <= state.riskLimits.marginRatioMax,
            FILE,
            "Ratio too high"
        );
        if (ratio.value > state.riskParams.liquidationSpread.value) { /* FOR COVERAGE TESTING */ }
        Require.that(ratio.value > state.riskParams.liquidationSpread.value,
            FILE,
            "Ratio cannot be <= spread"
        );
        state.riskParams.marginRatio = ratio;
        emit LogSetMarginRatio(ratio);
    }

    function ownerSetLiquidationSpread(
        Storage.State storage state,
        Decimal.D256 memory spread
    )
    public
    {
        if (spread.value <= state.riskLimits.liquidationSpreadMax) { /* FOR COVERAGE TESTING */ }
        Require.that(spread.value <= state.riskLimits.liquidationSpreadMax,
            FILE,
            "Spread too high"
        );
        if (spread.value < state.riskParams.marginRatio.value) { /* FOR COVERAGE TESTING */ }
        Require.that(spread.value < state.riskParams.marginRatio.value,
            FILE,
            "Spread cannot be >= ratio"
        );
        state.riskParams.liquidationSpread = spread;
        emit LogSetLiquidationSpread(spread);
    }

    function ownerSetEarningsRate(
        Storage.State storage state,
        Decimal.D256 memory earningsRate
    )
    public
    {
        if (earningsRate.value <= state.riskLimits.earningsRateMax) { /* FOR COVERAGE TESTING */ }
        Require.that(earningsRate.value <= state.riskLimits.earningsRateMax,
            FILE,
            "Rate too high"
        );
        state.riskParams.earningsRate = earningsRate;
        emit LogSetEarningsRate(earningsRate);
    }

    function ownerSetMinBorrowedValue(
        Storage.State storage state,
        Monetary.Value memory minBorrowedValue
    )
    public
    {
        if (minBorrowedValue.value <= state.riskLimits.minBorrowedValueMax) { /* FOR COVERAGE TESTING */ }
        Require.that(minBorrowedValue.value <= state.riskLimits.minBorrowedValueMax,
            FILE,
            "Value too high"
        );
        state.riskParams.minBorrowedValue = minBorrowedValue;
        emit LogSetMinBorrowedValue(minBorrowedValue);
    }

    function ownerSetAccountMaxNumberOfMarketsWithBalances(
        Storage.State storage state,
        uint256 accountMaxNumberOfMarketsWithBalances
    ) public {
        if (accountMaxNumberOfMarketsWithBalances >= 2) { /* FOR COVERAGE TESTING */ }
        Require.that(accountMaxNumberOfMarketsWithBalances >= 2,
            FILE,
            "Acct MaxNumberOfMarkets too low"
        );
        state.riskParams.accountMaxNumberOfMarketsWithBalances = accountMaxNumberOfMarketsWithBalances;
        emit LogSetAccountMaxNumberOfMarketsWithBalances(accountMaxNumberOfMarketsWithBalances);
    }

    function ownerSetOracleSentinel(
        Storage.State storage state,
        IOracleSentinel oracleSentinel
    ) public {
        if (oracleSentinel.isBorrowAllowed() && oracleSentinel.isLiquidationAllowed()) { /* FOR COVERAGE TESTING */ }
        Require.that(oracleSentinel.isBorrowAllowed() && oracleSentinel.isLiquidationAllowed(),
            FILE,
            "Invalid oracle sentinel"
        );
        state.riskParams.oracleSentinel = oracleSentinel;
        emit LogSetOracleSentinel(oracleSentinel);
    }

    function ownerSetAccountRiskOverride(
        Storage.State storage state,
        address accountOwner,
        IAccountRiskOverrideSetter accountRiskOverrideSetter
    ) public {
        if (address(accountRiskOverrideSetter) != address(0)) {
            (
                Decimal.D256 memory marginRatio,
                Decimal.D256 memory liquidationSpread
            ) = accountRiskOverrideSetter.getAccountRiskOverride(accountOwner);
            state.validateAccountRiskOverrideValues(marginRatio, liquidationSpread);
        }

        state.riskParams.accountRiskOverrideSetterMap[accountOwner] = accountRiskOverrideSetter;
        emit LogSetAccountRiskOverrideSetter(accountOwner, accountRiskOverrideSetter);
    }

    // ============ Global Operator Functions ============

    function ownerSetGlobalOperator(
        Storage.State storage state,
        address operator,
        bool approved
    )
    public
    {
        state.globalOperators[operator] = approved;

        emit LogSetGlobalOperator(operator, approved);
    }

    function ownerSetAutoTraderSpecial(
        Storage.State storage state,
        address autoTrader,
        bool isSpecial
    )
    public
    {
        state.specialAutoTraders[autoTrader] = isSpecial;

        emit LogSetAutoTraderIsSpecial(autoTrader, isSpecial);
    }

    // ============ Private Functions ============

    function _setPriceOracle(
        Storage.State storage state,
        uint256 marketId,
        IPriceOracle priceOracle
    )
    private
    {
        // require oracle can return non-zero price
        address token = state.markets[marketId].token;

        if (priceOracle.getPrice(token).value != 0) { /* FOR COVERAGE TESTING */ }
        Require.that(priceOracle.getPrice(token).value != 0,
            FILE,
            "Invalid oracle price"
        );

        state.markets[marketId].priceOracle = priceOracle;

        emit LogSetPriceOracle(marketId, address(priceOracle));
    }

    function _setInterestSetter(
        Storage.State storage state,
        uint256 marketId,
        IInterestSetter interestSetter
    )
    private
    {
        // ensure interestSetter can return a value without reverting
        address token = state.markets[marketId].token;
        interestSetter.getInterestRate(token, 0, 0);

        state.markets[marketId].interestSetter = interestSetter;

        emit LogSetInterestSetter(marketId, address(interestSetter));
    }

    function _setMarginPremium(
        Storage.State storage state,
        uint256 marketId,
        Decimal.D256 memory marginPremium
    )
    private
    {
        if (marginPremium.value <= state.riskLimits.marginPremiumMax) { /* FOR COVERAGE TESTING */ }
        Require.that(marginPremium.value <= state.riskLimits.marginPremiumMax,
            FILE,
            "Margin premium too high"
        );
        state.markets[marketId].marginPremium = marginPremium;

        emit LogSetMarginPremium(marketId, marginPremium);
    }

    function _setLiquidationSpreadPremium(
        Storage.State storage state,
        uint256 marketId,
        Decimal.D256 memory liquidationSpreadPremium
    )
    private
    {
        if (liquidationSpreadPremium.value <= state.riskLimits.liquidationSpreadPremiumMax) { /* FOR COVERAGE TESTING */ }
        Require.that(liquidationSpreadPremium.value <= state.riskLimits.liquidationSpreadPremiumMax,
            FILE,
            "Spread premium too high"
        );
        state.markets[marketId].liquidationSpreadPremium = liquidationSpreadPremium;

        emit LogSetLiquidationSpreadPremium(marketId, liquidationSpreadPremium);
    }

    function _setMaxSupplyWei(
        Storage.State storage state,
        uint256 marketId,
        uint256 maxSupplyWei
    )
    private
    {
        Types.Wei memory maxSupplyWeiStruct = Types.Wei(true, maxSupplyWei.to128());
        state.markets[marketId].maxSupplyWei = maxSupplyWeiStruct;

        emit LogSetMaxSupplyWei(marketId, maxSupplyWeiStruct);
    }

    function _setMaxBorrowWei(
        Storage.State storage state,
        uint256 marketId,
        uint256 maxBorrowWei
    )
    private
    {
        Types.Wei memory maxBorrowWeiStruct = Types.Wei(false, maxBorrowWei.to128());
        state.markets[marketId].maxBorrowWei = maxBorrowWeiStruct;

        emit LogSetMaxBorrowWei(marketId, maxBorrowWeiStruct);
    }

    function _setEarningsRateOverride(
        Storage.State storage state,
        uint256 marketId,
        Decimal.D256 memory earningsRateOverride
    )
    private
    {
        if (earningsRateOverride.value <= state.riskLimits.earningsRateMax) { /* FOR COVERAGE TESTING */ }
        Require.that(earningsRateOverride.value <= state.riskLimits.earningsRateMax,
            FILE,
            "Earnings rate override too high"
        );

        state.markets[marketId].earningsRateOverride = earningsRateOverride;

        emit LogSetEarningsRateOverride(marketId, earningsRateOverride);
    }

    function _requireNoMarket(
        Storage.State storage state,
        address token
    )
    private
    view
    {
        // not-found case is marketId of 0. 0 is a valid market ID so we need to check market ID 0's token equality.
        uint marketId = state.tokenToMarketId[token];
        bool marketExists = token == state.markets[marketId].token;

        if (!marketExists) { /* FOR COVERAGE TESTING */ }
        Require.that(!marketExists,
            FILE,
            "Market exists"
        );
    }

    function _validateMarketId(
        Storage.State storage state,
        uint256 marketId
    )
    private
    view
    {
        if (marketId < state.numMarkets && state.markets[marketId].token != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(marketId < state.numMarkets && state.markets[marketId].token != address(0),
            FILE,
            "Invalid market",
            marketId
        );
    }
}
