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

import { Admin } from "./Admin.sol";
import { Getters } from "./Getters.sol";
import { Operation } from "./Operation.sol";
import { Permission } from "./Permission.sol";

import { AdminImpl } from "./impl/AdminImpl.sol";

import { IDolomiteMargin } from "./interfaces/IDolomiteMargin.sol";
import { IOracleSentinel } from "./interfaces/IOracleSentinel.sol";

import { Decimal } from "./lib/Decimal.sol";
import { Monetary } from "./lib/Monetary.sol";
import { Storage } from "./lib/Storage.sol";


/**
 * @title DolomiteMargin
 * @author dYdX
 *
 * Main contract that inherits from other contracts
 */
contract DolomiteMargin is
    IDolomiteMargin,
    Admin,
    Getters,
    Operation,
    Permission
{
    // ============ Constructor ============

    constructor(
        Storage.RiskLimits memory riskLimits,
        Decimal.D256 memory marginRatio,
        Decimal.D256 memory liquidationSpread,
        Decimal.D256 memory earningsRate,
        Monetary.Value memory minBorrowedValue,
        uint256 accountMaxNumberOfMarketsWithBalances,
        IOracleSentinel oracleSentinel,
        uint256 callbackGasLimit
    )
        public
    {
        g_state.riskLimits = riskLimits;
        AdminImpl.ownerSetMarginRatio(g_state, marginRatio);
        AdminImpl.ownerSetLiquidationSpread(g_state, liquidationSpread);
        AdminImpl.ownerSetEarningsRate(g_state, earningsRate);
        AdminImpl.ownerSetMinBorrowedValue(g_state, minBorrowedValue);
        AdminImpl.ownerSetAccountMaxNumberOfMarketsWithBalances(g_state, accountMaxNumberOfMarketsWithBalances);
        AdminImpl.ownerSetOracleSentinel(g_state, oracleSentinel);
        AdminImpl.ownerSetCallbackGasLimit(g_state, callbackGasLimit);
    }
}
