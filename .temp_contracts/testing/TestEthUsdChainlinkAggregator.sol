/*

    Copyright 2020 Dolomite.

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

import "../external/interfaces/IChainlinkAggregator.sol";

/**
 * @dev Gets the latest price from the Chainlink Oracle Network. Amount of decimals depends on the base.
 */
contract TestEthUsdChainlinkAggregator is IChainlinkAggregator {

    function latestAnswer() public view returns (int256) {
        // $211.40
        return 21140000000;
    }

}
