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

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";

import { IPriceOracle } from "../../protocol/interfaces/IPriceOracle.sol";
import { Monetary } from "../../protocol/lib/Monetary.sol";
import { Require } from "../../protocol/lib/Require.sol";

import { IChainlinkAggregator } from "../interfaces/IChainlinkAggregator.sol";
import { IChainlinkFlags } from "../interfaces/IChainlinkFlags.sol";


/**
 * @title ChainlinkPriceOracleV1
 * @author Dolomite
 *
 * An implementation of the IPriceOracle interface that makes Chainlink prices compatible with the protocol.
 */
contract ChainlinkPriceOracleV1 is IPriceOracle, Ownable {
    using SafeMath for uint;

    bytes32 private constant FILE = "ChainlinkPriceOracleV1";
    // solium-disable-next-line max-len
    address constant private FLAG_ARBITRUM_SEQ_OFFLINE = address(bytes20(bytes32(uint256(keccak256("chainlink.flags.arbitrum-seq-offline")) - 1)));

    event TokenInsertedOrUpdated(
        address indexed token,
        address indexed aggregator,
        address indexed tokenPair
    );

    mapping(address => IChainlinkAggregator) public tokenToAggregatorMap;
    mapping(address => uint8) public tokenToDecimalsMap;

    /// Defaults to USD if the value is the ZERO address
    mapping(address => address) public tokenToPairingMap;

    /// Should defaults to CHAINLINK_USD_DECIMALS when value is empty
    mapping(address => uint8) public tokenToAggregatorDecimalsMap;

    IChainlinkFlags public chainlinkFlags;

    uint8 public CHAINLINK_USD_DECIMALS = 8;
    uint8 public CHAINLINK_ETH_DECIMALS = 18;

    /**
     * Note, these arrays are set up, such that each index corresponds with one-another.
     *
     * @param _tokens               The tokens that are supported by this adapter.
     * @param _chainlinkAggregators The Chainlink aggregators that have on-chain prices.
     * @param _tokenDecimals        The number of decimals that each token has.
     * @param _tokenPairs           The token against which this token's value is compared using the aggregator. The
     *                              zero address means USD.
     * @param _aggregatorDecimals   The number of decimals that the value has that comes back from the corresponding
     *                              Chainlink Aggregator.
     * @param _chainlinkFlagsOrNull The contract for layer-2 that denotes whether or not Chainlink oracles are currently
     *                              offline, meaning data is stale and any critical operations should *not* occur. If
     *                              not on layer 2, this value can be set to `address(0)`.
     */
    constructor(
        address[] memory _tokens,
        address[] memory _chainlinkAggregators,
        uint8[] memory _tokenDecimals,
        address[] memory _tokenPairs,
        uint8[] memory _aggregatorDecimals,
        address _chainlinkFlagsOrNull
    ) public {
      /*require( // coverage-disable-line
            _tokens.length == _chainlinkAggregators.length,
            "invalid aggregators"
        );*/
      /*require( // coverage-disable-line
            _chainlinkAggregators.length == _tokenDecimals.length,
            "invalid token decimals"
        );*/
      /*require( // coverage-disable-line
            _tokenDecimals.length == _tokenPairs.length,
            "invalid token pairs"
        );*/
      /*require( // coverage-disable-line
            _tokenPairs.length == _aggregatorDecimals.length,
            "invalid aggregator decimals"
        );*/

        for (uint256 i = 0; i < _tokens.length; i++) {
            _insertOrUpdateOracleToken(
                _tokens[i],
                _tokenDecimals[i],
                _chainlinkAggregators[i],
                _aggregatorDecimals[i],
                _tokenPairs[i]
            );
        }

        chainlinkFlags = IChainlinkFlags(_chainlinkFlagsOrNull);
    }

    // ============ Admin Functions ============

    function insertOrUpdateOracleToken(
        address _token,
        uint8 _tokenDecimals,
        address _chainlinkAggregator,
        uint8 _aggregatorDecimals,
        address _tokenPair
    ) public onlyOwner {
        _insertOrUpdateOracleToken(
            _token,
            _tokenDecimals,
            _chainlinkAggregator,
            _aggregatorDecimals,
            _tokenPair
        );
    }

    // ============ Public Functions ============

    function getPrice(
        address _token
    )
    public
    view
    returns (Monetary.Price memory) {
        if (address(tokenToAggregatorMap[_token]) != address(0)) { /* FOR COVERAGE TESTING */ }
        Require.that(address(tokenToAggregatorMap[_token]) != address(0),
            FILE,
            "invalid token",
            _token
        );
        IChainlinkFlags _chainlinkFlags = chainlinkFlags;
        if (address(_chainlinkFlags) != address(0)) {
            // https://docs.chain.link/docs/l2-sequencer-flag/
            bool isFlagRaised = _chainlinkFlags.getFlag(FLAG_ARBITRUM_SEQ_OFFLINE);
            if (!isFlagRaised) { /* FOR COVERAGE TESTING */ }
            Require.that(!isFlagRaised,
                FILE,
                "Chainlink price oracles offline"
            );
        }

        uint256 rawChainlinkPrice = uint(tokenToAggregatorMap[_token].latestAnswer());
        address tokenPair = tokenToPairingMap[_token];

        // standardize the Chainlink price to be the proper number of decimals of (36 - tokenDecimals)
        uint256 standardizedPrice = standardizeNumberOfDecimals(
            tokenToDecimalsMap[_token],
            rawChainlinkPrice,
            tokenPair == address(0) ? CHAINLINK_USD_DECIMALS : tokenToAggregatorDecimalsMap[_token]
        );

        if (tokenPair == address(0)) {
            // The pair has a USD base, we are done.
            return Monetary.Price({value : standardizedPrice});
        } else {
            // The price we just got and converted is NOT against USD. So we need to get its pair's price against USD.
            // We can do so by recursively calling #getPrice using the `tokenPair` as the parameter instead of `token`.
            uint256 tokenPairStandardizedPrice = getPrice(tokenPair).value;
            // Standardize the price to use 36 decimals.
            uint256 tokenPairWith36Decimals = tokenPairStandardizedPrice.mul(10 ** uint(tokenToDecimalsMap[tokenPair]));
            // Now that the chained price uses 36 decimals (and thus is standardized), we can do easy math.
            return Monetary.Price({value : standardizedPrice.mul(tokenPairWith36Decimals).div(ONE_DOLLAR)});
        }
    }

    /**
     * Standardizes `value` to have `ONE_DOLLAR` - `tokenDecimals` number of decimals.
     */
    function standardizeNumberOfDecimals(
        uint8 _tokenDecimals,
        uint256 _value,
        uint8 _valueDecimals
    ) public pure returns (uint) {
        uint256 tokenDecimalsFactor = 10 ** uint(_tokenDecimals);
        uint256 priceFactor = IPriceOracle.ONE_DOLLAR.div(tokenDecimalsFactor);
        uint256 valueFactor = 10 ** uint(_valueDecimals);
        return _value.mul(priceFactor).div(valueFactor);
    }

    // ============ Internal Functions ============

    function _insertOrUpdateOracleToken(
        address _token,
        uint8 _tokenDecimals,
        address _chainlinkAggregator,
        uint8 _aggregatorDecimals,
        address _tokenPair
    ) internal {
        tokenToAggregatorMap[_token] = IChainlinkAggregator(_chainlinkAggregator);
        tokenToDecimalsMap[_token] = _tokenDecimals;
        if (_tokenPair != address(0)) {
            // The aggregator's price is NOT against USD. Therefore, we need to store what it's against as well as the
            // # of decimals the aggregator's price has.
            tokenToPairingMap[_token] = _tokenPair;
            tokenToAggregatorDecimalsMap[_token] = _aggregatorDecimals;
        }
        emit TokenInsertedOrUpdated(_token, _chainlinkAggregator, _tokenPair);
    }
}
