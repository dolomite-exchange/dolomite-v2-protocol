/*

    Copyright 2023 Dolomite.

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

import { IAccountRiskOverrideSetter } from "../protocol/interfaces/IAccountRiskOverrideSetter.sol";

import { Account } from "../protocol/lib/Account.sol";
import { Decimal } from "../protocol/lib/Decimal.sol";


/**
 * @title TestAccountRiskOverrideSetter
 * @author Dolomite
 *
 * Account risk override for testing
 */
contract TestAccountRiskOverrideSetter is IAccountRiskOverrideSetter {

    mapping (address => mapping(uint256 => Decimal.D256)) public g_marginRatioOverrides;
    mapping (address => mapping(uint256 => Decimal.D256)) public g_liquidationSpreadOverrides;

    function setAccountRiskOverride(
        Account.Info memory _account,
        Decimal.D256 memory _marginRatioOverride,
        Decimal.D256 memory _liquidationSpreadOverride
    )
        public
    {
        g_marginRatioOverrides[_account.owner][_account.number] = _marginRatioOverride;
        g_liquidationSpreadOverrides[_account.owner][_account.number] = _liquidationSpreadOverride;
    }

    function getAccountRiskOverride(
        Account.Info memory _account
    )
        public
        view
        returns
        (
            Decimal.D256 memory marginRatioOverride,
            Decimal.D256 memory liquidationSpreadOverride
        )
    {
        return (
            g_marginRatioOverrides[_account.owner][_account.number],
            g_liquidationSpreadOverrides[_account.owner][_account.number]
        );
    }
}
