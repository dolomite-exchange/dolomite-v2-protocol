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

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IAutoTrader } from "../interfaces/IAutoTrader.sol";
import { ICallee } from "../interfaces/ICallee.sol";
import { Account } from "../lib/Account.sol";
import { Actions } from "../lib/Actions.sol";
import { Cache } from "../lib/Cache.sol";
import { Decimal } from "../lib/Decimal.sol";
import { EnumerableSet } from "../lib/EnumerableSet.sol";
import { Events } from "../lib/Events.sol";
import { Exchange } from "../lib/Exchange.sol";
import { Interest } from "../lib/Interest.sol";
import { DolomiteMarginMath } from "../lib/DolomiteMarginMath.sol";
import { Monetary } from "../lib/Monetary.sol";
import { Require } from "../lib/Require.sol";
import { Storage } from "../lib/Storage.sol";
import { Types } from "../lib/Types.sol";
import { CallImpl } from "./CallImpl.sol";
import { DepositImpl } from "./DepositImpl.sol";
import { LiquidateOrVaporizeImpl } from "./LiquidateOrVaporizeImpl.sol";
import { TradeImpl } from "./TradeImpl.sol";
import { TransferImpl } from "./TransferImpl.sol";
import { WithdrawalImpl } from "./WithdrawalImpl.sol";


/**
 * @title OperationImpl
 * @author dYdX
 *
 * Logic for processing actions
 */
library OperationImpl {
    using Cache for Cache.MarketCache;
    using EnumerableSet for EnumerableSet.Set;
    using SafeMath for uint256;
    using Storage for Storage.State;
    using Types for Types.Par;
    using Types for Types.Wei;

    // ============ Constants ============

    bytes32 private constant FILE = "OperationImpl";

    // ============ Public Functions ============

    function operate(
        Storage.State storage state,
        Account.Info[] memory accounts,
        Actions.ActionArgs[] memory actions
    )
        public
    {
        Events.logOperation();

        _verifyInputs(accounts, actions);

        (
            bool[] memory primaryAccounts,
            uint256[] memory numberOfMarketsWithBalancesPerAccount,
            Cache.MarketCache memory cache
        ) = _runPreprocessing(
            state,
            accounts,
            actions
        );

        _runActions(
            state,
            accounts,
            actions,
            cache
        );

        _verifyFinalState(
            state,
            accounts,
            primaryAccounts,
            numberOfMarketsWithBalancesPerAccount,
            cache
        );
    }

    // ============ Helper Functions ============

    function _verifyInputs(
        Account.Info[] memory accounts,
        Actions.ActionArgs[] memory actions
    )
        private
        pure
    {
        Require.that(
            accounts.length != 0,
            FILE,
            "Cannot have zero accounts"
        );
        Require.that(
            actions.length != 0,
            FILE,
            "Cannot have zero actions"
        );

        uint256 accountsLength = accounts.length;
        for (uint256 a; a < accountsLength; ++a) {
            for (uint256 b = a + 1; b < accountsLength; ++b) {
                Require.that(
                    !Account.equals(accounts[a], accounts[b]),
                    FILE,
                    "Cannot duplicate accounts",
                    accounts[a].owner,
                    accounts[a].number
                );
            }
        }
    }

    function _runPreprocessing(
        Storage.State storage state,
        Account.Info[] memory accounts,
        Actions.ActionArgs[] memory actions
    )
        private
        returns (
            bool[] memory,
            uint256[] memory,
            Cache.MarketCache memory
        )
    {
        bool[] memory primaryAccounts = new bool[](accounts.length);
        uint256[] memory numberOfMarketsWithBalancesPerAccount = new uint256[](accounts.length);
        Cache.MarketCache memory cache = Cache.create(state.numMarkets);

        // keep track of primary accounts and indexes that need updating
        uint256 actionsLength = actions.length;
        for (uint256 i; i < actionsLength; ++i) {
            Actions.ActionArgs memory arg = actions[i];
            Actions.ActionType actionType = arg.actionType;
            Actions.MarketLayout marketLayout = Actions.getMarketLayout(actionType);
            Actions.AccountLayout accountLayout = Actions.getAccountLayout(actionType);

            // parse out primary accounts
            if (accountLayout != Actions.AccountLayout.OnePrimary) {
                Require.that(
                    arg.accountId != arg.otherAccountId,
                    FILE,
                    "Duplicate accounts in action",
                    i
                );
                if (accountLayout == Actions.AccountLayout.TwoPrimary) {
                    primaryAccounts[arg.otherAccountId] = true;
                } else {
                    // accountLayout == Actions.AccountLayout.PrimaryAndSecondary
                    Require.that(
                        !primaryAccounts[arg.otherAccountId],
                        FILE,
                        "Requires non-primary account",
                        arg.otherAccountId
                    );
                }
            }
            primaryAccounts[arg.accountId] = true;

            // keep track of indexes to update
            if (marketLayout == Actions.MarketLayout.OneMarket) {
                _updateMarket(state, cache, arg.primaryMarketId);
            } else if (marketLayout == Actions.MarketLayout.TwoMarkets) {
                Require.that(
                    arg.primaryMarketId != arg.secondaryMarketId,
                    FILE,
                    "Duplicate markets in action",
                    i
                );
                _updateMarket(state, cache, arg.primaryMarketId);
                _updateMarket(state, cache, arg.secondaryMarketId);
            }
        }

        // get any other markets for which an account has a balance
        uint256 accountsLength = accounts.length;
        for (uint256 a = 0; a < accountsLength; a++) {
            uint[] memory marketIdsWithBalance = state.getMarketsWithBalances(accounts[a]);
            uint256 numMarketsWithBalance = marketIdsWithBalance.length;
            numberOfMarketsWithBalancesPerAccount[a] = numMarketsWithBalance;
            for (uint256 i; i < numMarketsWithBalance; ++i) {
                _updateMarket(state, cache, marketIdsWithBalance[i]);
            }
        }

        state.initializeCache(cache, /* fetchFreshIndex = */ false);

        uint256 numMarkets = cache.getNumMarkets();
        for (uint256 i; i < numMarkets; ++i) {
            Events.logOraclePrice(cache.getAtIndex(i));
        }

        return (primaryAccounts, numberOfMarketsWithBalancesPerAccount, cache);
    }

    function _updateMarket(
        Storage.State storage state,
        Cache.MarketCache memory cache,
        uint256 marketId
    )
        private
    {
        if (!cache.hasMarket(marketId)) {
            cache.set(marketId);
            Events.logIndexUpdate(marketId, state.updateIndex(marketId));
        }
    }

    function _runActions(
        Storage.State storage state,
        Account.Info[] memory accounts,
        Actions.ActionArgs[] memory actions,
        Cache.MarketCache memory cache
    )
        private
    {
        uint256 actionsLength = actions.length;
        for (uint256 i; i < actionsLength; ++i) {
            Actions.ActionArgs memory action = actions[i];
            Actions.ActionType actionType = action.actionType;

            if (actionType == Actions.ActionType.Deposit) {
                Actions.DepositArgs memory depositArgs = Actions.parseDepositArgs(accounts, action);
                DepositImpl.deposit(
                    state,
                    depositArgs,
                    cache.get(depositArgs.market).index
                );
            } else if (actionType == Actions.ActionType.Withdraw) {
                Actions.WithdrawArgs memory withdrawArgs = Actions.parseWithdrawArgs(accounts, action);
                WithdrawalImpl.withdraw(
                    state,
                    withdrawArgs,
                    cache.get(withdrawArgs.market).index
                );
            } else if (actionType == Actions.ActionType.Transfer) {
                Actions.TransferArgs memory transferArgs = Actions.parseTransferArgs(accounts, action);
                TransferImpl.transfer(
                    state,
                    transferArgs,
                    cache.get(transferArgs.market).index
                );
            } else if (actionType == Actions.ActionType.Buy) {
                Actions.BuyArgs memory buyArgs = Actions.parseBuyArgs(accounts, action);
                TradeImpl.buy(
                    state,
                    buyArgs,
                    cache.get(buyArgs.takerMarket).index,
                    cache.get(buyArgs.makerMarket).index
                );
            } else if (actionType == Actions.ActionType.Sell) {
                Actions.SellArgs memory sellArgs = Actions.parseSellArgs(accounts, action);
                TradeImpl.sell(
                    state,
                    sellArgs,
                    cache.get(sellArgs.takerMarket).index,
                    cache.get(sellArgs.makerMarket).index
                );
            } else if (actionType == Actions.ActionType.Trade) {
                Actions.TradeArgs memory tradeArgs = Actions.parseTradeArgs(accounts, action);
                TradeImpl.trade(
                    state,
                    tradeArgs,
                    cache.get(tradeArgs.inputMarket).index,
                    cache.get(tradeArgs.outputMarket).index
                );
            } else if (actionType == Actions.ActionType.Liquidate) {
                LiquidateOrVaporizeImpl.liquidate(
                    state,
                    cache,
                    Actions.parseLiquidateArgs(accounts, action)
                );
            } else if (actionType == Actions.ActionType.Vaporize) {
                LiquidateOrVaporizeImpl.vaporize(
                    state,
                    cache,
                    Actions.parseVaporizeArgs(accounts, action)
                );
            } else {
                assert(actionType == Actions.ActionType.Call);
                // solium-disable-next-line
                CallImpl.call(
                    state,
                    Actions.parseCallArgs(accounts, action)
                );
            }
        }
    }

    function _verifyFinalState(
        Storage.State storage state,
        Account.Info[] memory accounts,
        bool[] memory primaryAccounts,
        uint256[] memory numberOfMarketsWithBalancesPerAccount,
        Cache.MarketCache memory cache
    )
        private
    {
        bool isBorrowAllowed = state.riskParams.oracleSentinel.isBorrowAllowed();

        uint256 numMarkets = cache.getNumMarkets();
        for (uint256 i; i < numMarkets; ++i) {
            uint256 marketId = cache.getAtIndex(i).marketId;
            Types.TotalPar memory totalPar = state.getTotalPar(marketId);
            (
                Types.Wei memory totalSupplyWei,
                Types.Wei memory totalBorrowWei
            ) = Interest.totalParToWei(totalPar, cache.getAtIndex(i).index);

            Types.Wei memory maxBorrowWei = state.getMaxBorrowWei(marketId);
            Types.Wei memory maxSupplyWei = state.getMaxSupplyWei(marketId);

            // first check if the market is closing, borrowing is enabled, or if too much is being borrowed
            if (cache.getAtIndex(i).isClosing) {
                Require.that(
                    totalPar.borrow <= cache.getAtIndex(i).borrowPar,
                    FILE,
                    "Market is closing",
                    marketId
                );
            } else if (!isBorrowAllowed) {
                Require.that(
                    totalPar.borrow <= cache.getAtIndex(i).borrowPar,
                    FILE,
                    "Borrowing is currently disabled",
                    marketId
                );
            } else if (maxBorrowWei.value != 0) {
                // require total borrow is less than the max OR it scaled down
                Types.Par memory cachedBorrowPar = Types.Par({
                    sign: false,
                    value: cache.getAtIndex(i).borrowPar
                });
                Types.Wei memory cachedBorrowWei = Interest.parToWei(cachedBorrowPar, cache.getAtIndex(i).index);
                Require.that(
                    totalBorrowWei.value <= maxBorrowWei.value || totalBorrowWei.value <= cachedBorrowWei.value,
                    FILE,
                    "Total borrow exceeds max borrow",
                    marketId
                );
            }

            // check if too much is being supplied
            if (maxSupplyWei.value != 0) {
                // require total supply is less than the max OR it scaled down
                Types.Par memory cachedSupplyPar = Types.Par({
                    sign: true,
                    value: cache.getAtIndex(i).supplyPar
                });
                Types.Wei memory cachedSupplyWei = Interest.parToWei(cachedSupplyPar, cache.getAtIndex(i).index);
                Require.that(
                    totalSupplyWei.value <= maxSupplyWei.value || totalSupplyWei.value <= cachedSupplyWei.value,
                    FILE,
                    "Total supply exceeds max supply",
                    marketId
                );
            }

            // Log the current interest rate
            Interest.Rate memory rate = state.markets[marketId].interestSetter.getInterestRate(
                cache.getAtIndex(i).token,
                totalBorrowWei.value,
                totalSupplyWei.value
            );
            Events.logInterestRate(marketId, rate);
        }

        // verify account collateralization
        uint256 accountsLength = accounts.length;
        for (uint256 a = 0; a < accountsLength; a++) {
            Account.Info memory account = accounts[a];

            _verifyNumberOfMarketsWithBalances(state, account, numberOfMarketsWithBalancesPerAccount[a]);

            // don't check collateralization for non-primary accounts
            if (!primaryAccounts[a]) {
                continue;
            }

            // validate minBorrowedValue
            bool collateralized = state.isCollateralized(account, cache, /* requireMinBorrow = */ true);

            // check collateralization for primary accounts
            Require.that(
                collateralized,
                FILE,
                "Undercollateralized account",
                account.owner,
                account.number
            );

            // ensure status is normal for primary accounts
            if (state.getStatus(account) != Account.Status.Normal) {
                state.setStatus(account, Account.Status.Normal);
            }
        }
    }

    function _verifyNumberOfMarketsWithBalances(
        Storage.State storage state,
        Account.Info memory account,
        uint256 cachedNumberOfMarketsWithBalances
    )
        private view
    {
        // The account should either have less markets with balances than at the start of the transaction OR
        // less markets with balances than the max number of markets with balances per account
        uint256 actualNumberOfMarketsWithBalances = state.getNumberOfMarketsWithBalances(account);
        Require.that(
            actualNumberOfMarketsWithBalances <= cachedNumberOfMarketsWithBalances ||
            actualNumberOfMarketsWithBalances <= state.riskParams.accountMaxNumberOfMarketsWithBalances,
            FILE,
            "Too many non-zero balances",
            account.owner,
            account.number
        );
    }
}
