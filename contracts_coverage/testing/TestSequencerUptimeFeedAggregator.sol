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

import { IChainlinkAggregator } from "../external/interfaces/IChainlinkAggregator.sol";
import { IChainlinkAccessControlAggregator } from "../external/interfaces/IChainlinkAccessControlAggregator.sol";


contract TestSequencerUptimeFeedAggregator is IChainlinkAggregator {

    int256 internal _latestAnswer;
    uint256 internal _lastStartedAt;
    uint256 internal _lastUpdatedAt;

    function aggregator() external view returns (IChainlinkAccessControlAggregator) {
        // For the sake of simplicity, we implement the IChainlinkAccessControlAggregator interface here
        return IChainlinkAccessControlAggregator(address(0));
    }

    function decimals() external view returns (uint8) {
        return 0;
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
        return (
            0,
            _latestAnswer,
            _lastStartedAt,
            _lastUpdatedAt,
            0
        );
    }

    function setLatestAnswer(
        int256 __latestAnswer
    )
    public {
        _latestAnswer = __latestAnswer;
        _lastStartedAt = block.timestamp;
        _lastUpdatedAt = block.timestamp;
    }
}
