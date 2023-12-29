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

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IInterestSetter } from "../../protocol/interfaces/IInterestSetter.sol";
import { Interest } from "../../protocol/lib/Interest.sol";


/**
 * @title   AAVECopyCatStableCoinInterestSetter.sol
 * @author  Dolomite
 *
 * @notice  Copies AAVE's interest rate model on Arbitrum for stable coins up until 90% utilization (since Dolomite's
 *          markets are smaller). After 90% utilization, scales up to 100% APR.
 */
contract AAVECopyCatStableCoinInterestSetter is IInterestSetter {
    using SafeMath for uint256;

    uint256 constant ONE_HUNDRED_PERCENT = 1e18;
    uint256 constant NINETY_PERCENT = 9e17;
    uint256 constant TEN_PERCENT = 1e17;
    uint256 constant SECONDS_IN_A_YEAR = 60 * 60 * 24 * 365;
    uint256 constant NINETY_SIX_PERCENT = 96e16;
    uint256 constant FOUR_PERCENT = 4e16;

    function getInterestRate(
        address /* token */,
        uint256 _borrowWei,
        uint256 _supplyWei
    )
    external
    view
    returns (Interest.Rate memory)
    {
        if (_borrowWei == 0) {
            return Interest.Rate({
               value: 0
            });
        } else if (_supplyWei == 0) {
            return Interest.Rate({
                value: ONE_HUNDRED_PERCENT / SECONDS_IN_A_YEAR
            });
        }

        uint256 utilization = _borrowWei.mul(ONE_HUNDRED_PERCENT).div(_supplyWei);
        if (utilization >= ONE_HUNDRED_PERCENT) {
            return Interest.Rate({
                value: ONE_HUNDRED_PERCENT / SECONDS_IN_A_YEAR
            });
        } else if (utilization > NINETY_PERCENT) {
            // interest is equal to 4% + linear progress to 100% APR
            uint256 interestToAdd = NINETY_SIX_PERCENT.mul(utilization.sub(NINETY_PERCENT)).div(TEN_PERCENT);
            return Interest.Rate({
                value: interestToAdd.add(FOUR_PERCENT).div(SECONDS_IN_A_YEAR)
            });
        } else {
            return Interest.Rate({
                value: FOUR_PERCENT.mul(utilization).div(NINETY_PERCENT).div(SECONDS_IN_A_YEAR)
            });
        }
    }
}
