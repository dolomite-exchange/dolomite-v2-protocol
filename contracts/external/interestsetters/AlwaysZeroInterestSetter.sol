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

import { IInterestSetter } from "../../protocol/interfaces/IInterestSetter.sol";
import { Interest } from "../../protocol/lib/Interest.sol";


/**
 * @title   AlwaysZeroInterestSetter.sol
 * @author  Dolomite
 *
 * @notice  Always returns 0 for the interest rate, no matter what the state of the market is.
 */
contract AlwaysZeroInterestSetter is IInterestSetter {

    function getInterestRate(
        address /* token */,
        uint256 /* borrowWei */,
        uint256 /* supplyWei */
    )
    external
    view
    returns (Interest.Rate memory)
    {
        return Interest.Rate({
            value: 0
        });
    }
}
