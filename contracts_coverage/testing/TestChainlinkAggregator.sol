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
pragma experimental ABIEncoderV2;

import { IChainlinkAccessControlAggregator } from "../external/interfaces/IChainlinkAccessControlAggregator.sol";
import { IChainlinkAggregator } from "../external/interfaces/IChainlinkAggregator.sol";


contract TestChainlinkAggregator is IChainlinkAggregator, IChainlinkAccessControlAggregator {

    int256 internal _latestAnswer;
    uint256 internal _lastUpdatedAt;
    int192 internal _minAnswer;
    int192 internal _maxAnswer;

    constructor() public {
        _minAnswer = 1;
        _maxAnswer = 95780971304118053647396689196894323976171195136475135;
    }

    function setLatestAnswer(
        int256 __latestAnswer
    ) external {
        _latestAnswer = __latestAnswer;
        _lastUpdatedAt = block.timestamp;
    }

    function setMinAnswer(int192 __minAnswer) external {
        _minAnswer = __minAnswer;
    }

    function setMaxAnswer(int192 __maxAnswer) external {
        _maxAnswer = __maxAnswer;
    }

    function aggregator() external view returns (IChainlinkAccessControlAggregator) {
        // For the sake of simplicity, we implement the IChainlinkAccessControlAggregator interface here
        return IChainlinkAccessControlAggregator(address(this));
    }

    function decimals() external view returns (uint8) {
        return 8;
    }

    function minAnswer() external view returns (int192) {
        return _minAnswer;
    }

    function maxAnswer() external view returns (int192) {
        return _maxAnswer;
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
            0,
            _lastUpdatedAt,
            0
        );
    }
}
