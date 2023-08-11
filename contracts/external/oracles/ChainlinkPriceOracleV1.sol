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

import { Monetary } from "../../protocol/lib/Monetary.sol";
import { Require } from "../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IChainlinkAggregator } from "../interfaces/IChainlinkAggregator.sol";
import { IChainlinkAccessControlAggregator } from "../interfaces/IChainlinkAccessControlAggregator.sol";
import { IChainlinkPriceOracleV1 } from "../interfaces/IChainlinkPriceOracleV1.sol";


/**
 * @title ChainlinkPriceOracleV1
 * @author Dolomite
 *
 * An implementation of the IPriceOracle interface that makes Chainlink prices compatible with the protocol.
 */
contract ChainlinkPriceOracleV1 is IChainlinkPriceOracleV1, OnlyDolomiteMargin {
    using SafeMath for uint;

    // ========================= Constants =========================

    bytes32 private constant FILE = "ChainlinkPriceOracleV1";

    // ========================= Storage =========================

    mapping(address => IChainlinkAggregator) private _tokenToAggregatorMap;

    mapping(address => uint8) private _tokenToDecimalsMap;

    /// @dev Defaults to USD if the value is the ZERO address
    mapping(address => address) private _tokenToPairingMap;

    uint256 public stalenessThreshold;

    // ========================= Constructor =========================

    /**
     * Note, these arrays are set up such that each index corresponds with one-another.
     *
     * @param _tokens               The tokens that are supported by this adapter.
     * @param _chainlinkAggregators The Chainlink aggregators that have on-chain prices.
     * @param _tokenDecimals        The number of decimals that each token has.
     * @param _tokenPairs           The token against which this token's value is compared using the aggregator. The
     *                              zero address means USD.
     * @param _dolomiteMargin       The address of the DolomiteMargin contract.
     */
    constructor(
        address[] memory _tokens,
        address[] memory _chainlinkAggregators,
        uint8[] memory _tokenDecimals,
        address[] memory _tokenPairs,
        address _dolomiteMargin
    )
        public
        OnlyDolomiteMargin(_dolomiteMargin)
    {
        Require.that(
            _tokens.length == _chainlinkAggregators.length,
            FILE,
            "Invalid tokens length"
        );
        Require.that(
            _chainlinkAggregators.length == _tokenDecimals.length,
            FILE,
            "Invalid aggregators length"
        );
        Require.that(
            _tokenDecimals.length == _tokenPairs.length,
            FILE,
            "Invalid decimals length"
        );

        uint256 tokensLength = _tokens.length;
        for (uint256 i; i < tokensLength; ++i) {
            _ownerInsertOrUpdateOracleToken(
                _tokens[i],
                _tokenDecimals[i],
                _chainlinkAggregators[i],
                _tokenPairs[i]
            );
        }

        _ownerSetStalenessThreshold(36 hours);
    }

    // ========================= Admin Functions =========================

    function ownerSetStalenessThreshold(
        uint256 _stalenessThreshold
    )
        external
        onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerSetStalenessThreshold(_stalenessThreshold);
    }

    function ownerInsertOrUpdateOracleToken(
        address _token,
        uint8 _tokenDecimals,
        address _chainlinkAggregator,
        address _tokenPair
    )
        external
        onlyDolomiteMarginOwner(msg.sender)
    {
        _ownerInsertOrUpdateOracleToken(
            _token,
            _tokenDecimals,
            _chainlinkAggregator,
            _tokenPair
        );
    }

    // ========================= Public Functions =========================

    function getPrice(
        address _token
    )
        public
        view
        returns (Monetary.Price memory)
    {
        Require.that(
            address(_tokenToAggregatorMap[_token]) != address(0),
            FILE,
            "Invalid token",
            _token
        );

        IChainlinkAggregator aggregatorProxy = _tokenToAggregatorMap[_token];
        (
            /* uint80 roundId */,
            int256 answer,
            /* uint256 startedAt */,
            uint256 updatedAt,
            /* uint80 answeredInRound */
        ) = aggregatorProxy.latestRoundData();
        Require.that(
            block.timestamp.sub(updatedAt) < stalenessThreshold,
            FILE,
            "Chainlink price expired",
            _token
        );

        IChainlinkAccessControlAggregator controlAggregator = aggregatorProxy.aggregator();
        Require.that(
            controlAggregator.minAnswer() < answer,
            FILE,
            "Chainlink price too low"
        );
        Require.that(
            answer < controlAggregator.maxAnswer(),
            FILE,
            "Chainlink price too high"
        );

        uint256 chainlinkPrice = uint256(answer);
        address tokenPair = _tokenToPairingMap[_token];

        // standardize the Chainlink price to be the proper number of decimals of (36 - tokenDecimals)
        uint256 standardizedPrice = standardizeNumberOfDecimals(
            _tokenToDecimalsMap[_token],
            chainlinkPrice,
            aggregatorProxy.decimals()
        );

        if (tokenPair == address(0)) {
            // The pair has a USD base, we are done.
            return Monetary.Price({
                value: standardizedPrice
            });
        } else {
            // The price we just got and converted is NOT against USD. So we need to get its pair's price against USD.
            // We can do so by recursively calling #getPrice using the `tokenPair` as the parameter instead of `token`.
            uint256 tokenPairPrice = getPrice(tokenPair).value;
            // Standardize the price to use 36 decimals.
            uint256 tokenPairWith36Decimals = tokenPairPrice.mul(10 ** uint(_tokenToDecimalsMap[tokenPair]));
            // Now that the chained price uses 36 decimals (and thus is standardized), we can do easy math.
            return Monetary.Price({
                value: standardizedPrice.mul(tokenPairWith36Decimals).div(ONE_DOLLAR)
            });
        }
    }

    /**
     * Standardizes `value` to have `ONE_DOLLAR.decimals` - `tokenDecimals` number of decimals.
     */
    function standardizeNumberOfDecimals(
        uint8 _tokenDecimals,
        uint256 _value,
        uint8 _valueDecimals
    )
        public
        pure
        returns (uint)
    {
        uint256 tokenDecimalsFactor = 10 ** uint(_tokenDecimals);
        uint256 priceFactor = ONE_DOLLAR.div(tokenDecimalsFactor);
        uint256 valueFactor = 10 ** uint(_valueDecimals);
        return _value.mul(priceFactor).div(valueFactor);
    }

    function getAggregatorByToken(address _token) public view returns (IChainlinkAggregator) {
        return _tokenToAggregatorMap[_token];
    }

    function getDecimalsByToken(address _token) public view returns (uint8) {
        return _tokenToDecimalsMap[_token];
    }

    function getTokenPairByToken(address _token) public view returns (address _tokenPair) {
        return _tokenToPairingMap[_token];
    }

    // ========================= Internal Functions =========================

    function _ownerSetStalenessThreshold(
        uint256 _stalenessThreshold
    )
    internal
    {
        Require.that(
            _stalenessThreshold >= 24 hours,
            FILE,
            "Staleness threshold too low",
            _stalenessThreshold
        );
        Require.that(
            _stalenessThreshold <= 7 days,
            FILE,
            "Staleness threshold too high",
            _stalenessThreshold
        );

        stalenessThreshold = _stalenessThreshold;
        emit StalenessDurationUpdated(_stalenessThreshold);
    }

    function _ownerInsertOrUpdateOracleToken(
        address _token,
        uint8 _tokenDecimals,
        address _chainlinkAggregator,
        address _tokenPair
    ) internal {
        _tokenToAggregatorMap[_token] = IChainlinkAggregator(_chainlinkAggregator);
        _tokenToDecimalsMap[_token] = _tokenDecimals;
        if (_tokenPair != address(0)) {
            Require.that(
                address(_tokenToAggregatorMap[_tokenPair]) != address(0),
                FILE,
                "Invalid token pair",
                _tokenPair
            );
            // The aggregator's price is NOT against USD. Therefore, we need to store what it's against as well as the
            // # of decimals the aggregator's price has.
            _tokenToPairingMap[_token] = _tokenPair;
        }
        emit TokenInsertedOrUpdated(_token, _chainlinkAggregator, _tokenPair);
    }
}
