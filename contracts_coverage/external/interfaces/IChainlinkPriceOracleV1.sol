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

import { IPriceOracle } from "../../protocol/interfaces/IPriceOracle.sol";

import { IChainlinkAggregator } from "../interfaces/IChainlinkAggregator.sol";


/**
 * @title IChainlinkPriceOracleV1
 * @author Dolomite
 *
 * An implementation of the IPriceOracle interface that makes Chainlink prices compatible with the protocol.
 */
contract IChainlinkPriceOracleV1 is IPriceOracle {

    // ============ Events ============

    event StalenessDurationUpdated(uint256 stalenessDuration);

    event TokenInsertedOrUpdated(
        address indexed token,
        address indexed aggregator,
        address indexed tokenPair
    );

    // ============ Admin Functions ============

    /**
     * @dev Sets the new `stalenessThreshold`. This function can only be called by the owner of DolomiteMargin.
     *
     * @param _stalenessThreshold   The duration of time that must pass before a price is considered stale from a
     *                              Chainlink Aggregator
     */
    function ownerSetStalenessThreshold(
        uint256 _stalenessThreshold
    )
        external;

    /**
     * @dev Insert or update a token in the oracle. This function can only be called by the owner of DolomiteMargin.
     *
     * @param _token                The token whose Chainlink aggregator should be inserted or updated
     * @param _tokenDecimals        The number of decimals that this token has
     * @param _chainlinkAggregator  The Chainlink aggregator that corresponds with this token
     * @param _tokenPair            The token pair that corresponds with this token. The zero address means USD.
     */
    function ownerInsertOrUpdateOracleToken(
        address _token,
        uint8 _tokenDecimals,
        address _chainlinkAggregator,
        address _tokenPair
    )
        external;

    // ============ Getter Functions ============

    /**
     *
     * @param  _token  The token whose Chainlink aggregator should be retrieved
     * @return         The aggregator that corresponds with this token
     */
    function getAggregatorByToken(address _token) external view returns (IChainlinkAggregator);

    /**
     * @param _token  The token whose decimals should be retrieved
     * @return        The number of decimals that this token has
     */
    function getDecimalsByToken(address _token) external view returns (uint8);

    /**
     * @param _token        The token whose token pair should be retrieved
     * @return _tokenPair   The token pair that corresponds with this token. The zero address means USD.
     */
    function getTokenPairByToken(address _token) external view returns (address _tokenPair);

    /**
     * @return The duration of time that must pass before a price is considered stale from a Chainlink Aggregator
     */
    function stalenessThreshold() external view returns (uint256);
}
