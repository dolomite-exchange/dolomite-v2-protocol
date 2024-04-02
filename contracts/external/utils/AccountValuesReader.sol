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
import { Decimal } from "../../protocol/lib/Decimal.sol";
import { Monetary } from "../../protocol/lib/Monetary.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { HasLiquidatorRegistry } from "../helpers/HasLiquidatorRegistry.sol";
import { LiquidatorProxyBase } from "../helpers/LiquidatorProxyBase.sol";


/**
 * @title AccountValuesReader
 * @author Dolomite
 *
 * Contract for getting an account's values on ArbitrumOne to avoid the stale index bug.
 */
contract AccountValuesReader is LiquidatorProxyBase {

    // ============ Constants ============

    bytes32 private constant FILE = "AccountValuesReader";

    // ============ Storage ============

    IDolomiteMargin public DOLOMITE_MARGIN;

    // ============ Constructor ============

    constructor (
        address _dolomiteMargin,
        address _liquidatorAssetRegistry
    )
        public
        HasLiquidatorRegistry(_liquidatorAssetRegistry)
    {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    function getAccountValues(
        Account.Info memory account
    ) public view returns (Monetary.Value memory supply, Monetary.Value memory borrow) {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN;
        uint256[] memory marketIds = dolomiteMargin.getAccountMarketsWithBalances(account);
        (supply, borrow) = _getAccountValues(
            dolomiteMargin,
            _getMarketInfos(dolomiteMargin, marketIds, new uint256[](0)),
            account,
            marketIds,
            Decimal.D256({ value: 0 })
        );
    }

    function getAdjustedAccountValues(
        Account.Info memory account
    ) public view returns (Monetary.Value memory supply, Monetary.Value memory borrow) {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN;
        uint256[] memory marketIds = dolomiteMargin.getAccountMarketsWithBalances(account);
        (supply, borrow) = _getAdjustedAccountValues(
            dolomiteMargin,
            _getMarketInfos(dolomiteMargin, marketIds, new uint256[](0)),
            account,
            marketIds,
            Decimal.D256({ value: 0 })
        );
    }
}
