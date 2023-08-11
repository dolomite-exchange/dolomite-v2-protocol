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

import { Require } from "../../protocol/lib/Require.sol";

import { IOracleSentinel } from "../../protocol/interfaces/IOracleSentinel.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IChainlinkAggregator } from "../interfaces/IChainlinkAggregator.sol";


/**
 * @title ChainlinkOracleSentinel
 * @author Dolomite
 *
 * An implementation of the IOracleSentinel interface that gets data from the sequencer using Chainlink to check if it
 * is online.
 */
contract ChainlinkOracleSentinel is IOracleSentinel, OnlyDolomiteMargin {

    // ========================== Constants ========================

    bytes32 private constant FILE = "ChainlinkOracleSentinel";

    // ========================= Storage =========================

    IChainlinkAggregator public SEQUENCER_UPTIME_FEED;
    uint256 public gracePeriod;

    // ======================= Constructor =======================

    /**
     * @param _sequencerUptimeFeed  The contract for layer-2 that denotes whether or not the sequencer is currently
     *                              online.
     */
    constructor(
        address _sequencerUptimeFeed,
        address _dolomiteMargin
    )
        public
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        SEQUENCER_UPTIME_FEED = IChainlinkAggregator(_sequencerUptimeFeed);
    }

    // ===================== Admin Functions =====================

    function ownerSetGracePeriod(
        uint256 _gracePeriod
    ) external onlyDolomiteMarginOwner(msg.sender) {
        _ownerSetGracePeriod(_gracePeriod);
    }

    // ===================== Getter Functions =====================

    function isBorrowAllowed() external view returns (bool) {
        return _getIsSequencerOnlineAndGracePeriodHasPassed();
    }

    function isLiquidationAllowed() external view returns (bool) {
        return _getIsSequencerOnlineAndGracePeriodHasPassed();
    }

    // ===================== Internal Functions =====================

    function _ownerSetGracePeriod(
        uint256 _gracePeriod
    ) internal {
        if (_gracePeriod >= 10 minutes) { /* FOR COVERAGE TESTING */ }
        Require.that(_gracePeriod >= 10 minutes,
            FILE,
            "Grace period too low"
        );
        if (_gracePeriod <= 24 hours) { /* FOR COVERAGE TESTING */ }
        Require.that(_gracePeriod <= 24 hours,
            FILE,
            "Grace period too high"
        );
        gracePeriod = _gracePeriod;
        emit GracePeriodSet(_gracePeriod);
    }

    function _getIsSequencerOnlineAndGracePeriodHasPassed() internal view returns (bool) {
        (
            /* uint80 roundID */,
            int256 answer,
            uint256 startedAt,
            /* uint256 updatedAt */,
            /* uint80 answeredInRound */
        ) = SEQUENCER_UPTIME_FEED.latestRoundData();

        // Answer == 0: Sequencer is up
        // Answer == 1: Sequencer is down
        // logic is taken from the Chainlink docs: https://docs.chain.link/data-feeds/l2-sequencer-feeds
        return answer == 0 && startedAt + gracePeriod < block.timestamp;
    }
}
