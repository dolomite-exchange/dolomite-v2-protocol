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

import { Account } from "../../protocol/lib/Account.sol";


/**
 * @title AccountMarginHelper
 * @author Dolomite
 *
 * Library contract that has various utility functions for margin positions/accounts
 */
library AccountMarginLib {

    // ============ Constants ============

    bytes32 private constant FILE = "AccountMarginHelper";

    // ============ Functions ============

    /**
     *  Checks if an account is margin account by whether or not it's `>= 100` (since users have to split assets into
     *  segments of 32).
     */
    function isMarginAccount(
        uint256 _accountIndex
    ) internal pure returns (bool) {
        return _accountIndex >= 100;
    }

    /**
     *  Checks if an account is margin account by whether or not it's `>= 100` (since users have to split assets into
     *  segments of 32).
     */
    function isMarginAccount(
        Account.Info memory _account
    ) internal pure returns (bool) {
        return _account.number >= 100;
    }
}
