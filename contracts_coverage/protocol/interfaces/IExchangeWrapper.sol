/*

    Copyright 2019 dYdX Trading Inc.

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


/**
 * @title IExchangeWrapper
 * @author dYdX
 *
 * Interface that Exchange Wrappers for DolomiteMargin must implement in order to trade ERC20 tokens.
 */
interface IExchangeWrapper {

    // ============ Public Functions ============

    /**
     * Exchange some amount of takerToken for makerToken.
     *
     * @param  _tradeOriginator     Address of the initiator of the trade (however, this value
     *                              cannot always be trusted as it is set at the discretion of the
     *                              msg.sender)
     * @param  _receiver            Address to set allowance on once the trade has completed
     * @param  _makerToken          The token to receive (target asset; IE path[path.length - 1])
     * @param  _takerToken          The token to pay (originator asset; IE path[0])
     * @param  _requestedFillAmount Amount of takerToken being paid
     * @param  _orderData           Arbitrary bytes data for any information to pass to the exchange
     * @return                      The amount of makerToken received
     */
    function exchange(
        address _tradeOriginator,
        address _receiver,
        address _makerToken,
        address _takerToken,
        uint256 _requestedFillAmount,
        bytes calldata _orderData
    )
        external
        returns (uint256);

    /**
     * Get amount of takerToken required to buy a certain amount of makerToken for a given trade.
     * Should match the takerToken amount used in exchangeForAmount. If the order cannot provide
     * exactly desiredMakerToken, then it must return the price to buy the minimum amount greater
     * than desiredMakerToken
     *
     * @param  _makerToken          The token to receive (target asset; IE path[path.length - 1])
     * @param  _takerToken          The token to pay (originator asset; IE path[0])
     * @param  _desiredMakerToken   Amount of `_makerToken` requested
     * @param  _orderData           Arbitrary bytes data for any information to pass to the exchange
     * @return                      Amount of `_takerToken` the needed to complete the exchange
     */
    function getExchangeCost(
        address _makerToken,
        address _takerToken,
        uint256 _desiredMakerToken,
        bytes calldata _orderData
    )
        external
        view
        returns (uint256);
}
