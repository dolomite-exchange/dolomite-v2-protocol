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

import { IAccountRiskOverrideGetter } from "../protocol/interfaces/IAccountRiskOverrideGetter.sol";

import { Decimal } from "../protocol/lib/Decimal.sol";


/**
 * @title TestAccountRiskOverrideGetter
 * @author Dolomite
 *
 * Account risk override for testing
 */
contract TestAccountRiskOverrideGetter is IAccountRiskOverrideGetter {

    mapping (address => Decimal.D256) public g_marginRatioOverrides;
    mapping (address => Decimal.D256) public g_liquidationSpreadOverrides;

    function setAccountRiskOverride(
        address _accountOwner,
        Decimal.D256 _marginRatioOverride,
        Decimal.D256 _liquidationSpreadOverride
    )
        external
    {
        g_marginRatioOverrides[_accountOwner] = _marginRatioOverride;
        g_liquidationSpreadOverrides[_accountOwner] = _liquidationSpreadOverride;
    }

    function getAccountRiskOverride(
        address _accountOwner
    )
        external
        view
        returns
        (
            Decimal.D256 memory marginRatioOverride,
            Decimal.D256 memory liquidationSpreadOverride
        )
    {
        return (
            g_marginRatioOverrides[_accountOwner],
            g_liquidationSpreadOverrides[_accountOwner]
        );
    }
}
