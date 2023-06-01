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

import { IOracleSentinel } from "../../protocol/interfaces/IOracleSentinel.sol";

import { IChainlinkFlags } from "../interfaces/IChainlinkFlags.sol";


/**
 * @title ChainlinkOracleSentinel
 * @author Dolomite
 *
 * An implementation of the IOracleSentinel interface that gets data from the sequencer using Chainlink to check if it
 * is online.
 */
contract ChainlinkOracleSentinel is IOracleSentinel {

    // ========================== Constants ========================

    address private constant FLAG_ARBITRUM_SEQ_OFFLINE = address(bytes20(bytes32(uint256(keccak256("chainlink.flags.arbitrum-seq-offline")) - 1))); // solium-disable-line max-len

    // ========================= Storage =========================

    IChainlinkFlags public CHAINLINK_FLAGS;

    // ======================= Constructor =======================

    /**
     * @param _chainlinkFlags   The contract for layer-2 that denotes whether or not Chainlink oracles are currently
     *                          offline, meaning data is stale and any critical operations should not occur.
     */
    constructor(address _chainlinkFlags) public {
        CHAINLINK_FLAGS = IChainlinkFlags(_chainlinkFlags);
    }

    // ===================== Public Functions =====================

    function isBorrowAllowed() external view returns (bool) {
        return _isSequencerOnline();
    }

    function isLiquidationAllowed() external view returns (bool) {
        return _isSequencerOnline();
    }

    function _isSequencerOnline() internal view returns (bool) {
        // https://docs.chain.link/docs/l2-sequencer-flag/
        return !CHAINLINK_FLAGS.getFlag(FLAG_ARBITRUM_SEQ_OFFLINE); // !offline == online
    }
}
