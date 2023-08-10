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

import { IChainlinkAggregator } from "../external/interfaces/IChainlinkAggregator.sol";
import { IChainlinkAccessControlAggregator } from "../external/interfaces/IChainlinkAccessControlAggregator.sol";


/**
 * @dev Gets the latest price from the Chainlink Oracle Network. Amount of decimals depends on the base.
 */
contract TestLrcEthChainlinkAggregator is IChainlinkAggregator, IChainlinkAccessControlAggregator {

    function aggregator() external view returns (IChainlinkAccessControlAggregator) {
        // For the sake of simplicity, we implement the IChainlinkAccessControlAggregator interface here
        return IChainlinkAccessControlAggregator(address(this));
    }

    function decimals() external view returns (uint8) {
        return 8;
    }

    function maxAnswer() external view returns (int192) {
        return 95780971304118053647396689196894323976171195136475135;
    }

    function minAnswer() external view returns (int192) {
        return 1;
    }

    function latestRoundData()
    external
    view
    returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (0, 186390000000000, 0, block.timestamp, 0); // Ξ0.00018639
    }
}
