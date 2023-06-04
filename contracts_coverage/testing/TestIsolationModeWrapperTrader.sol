/*

    Copyright 2021 Dolomite.

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

import { IIsolationModeWrapperTrader } from "../external/interfaces/IIsolationModeWrapperTrader.sol";

import { AccountActionLib } from "../external/lib/AccountActionLib.sol";

import { Actions } from "../protocol/lib/Actions.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { Require } from "../protocol/lib/Require.sol";

import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";

import { TestToken } from "./TestToken.sol";


contract TestIsolationModeWrapperTrader is IIsolationModeWrapperTrader {

    bytes32 private constant FILE = "TestIsolationModeWrapperTrader";

    uint256 constant public ACTIONS_LENGTH = 1;

    address public INPUT_TOKEN;
    address public OUTPUT_TOKEN;
    IDolomiteMargin public DOLOMITE_MARGIN;

    constructor(
        address _inputToken,
        address _outputToken,
        address _dolomiteMargin
    ) public {
        INPUT_TOKEN = _inputToken;
        OUTPUT_TOKEN = _outputToken;
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    function token() external view returns (address) {
        return OUTPUT_TOKEN;
    }

    function isValidInputToken(address _inputToken) external view returns (bool) {
        return _inputToken == INPUT_TOKEN;
    }

    function actionsLength() external pure returns (uint256) {
        return ACTIONS_LENGTH;
    }

    function createActionsForWrapping(
        uint256 _primaryAccountId,
        uint256,
        address,
        address,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _minAmountOut,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
    external
    view
    returns (Actions.ActionArgs[] memory) {
        if (DOLOMITE_MARGIN.getMarketIdByTokenAddress(OUTPUT_TOKEN) == _outputMarket) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN.getMarketIdByTokenAddress(OUTPUT_TOKEN) == _outputMarket,
            FILE,
            "Invalid output market",
            _outputMarket
        );
        uint256 amountOut;
        uint256 inputPrice = DOLOMITE_MARGIN.getMarketPrice(_inputMarket).value;
        uint256 outputPrice = DOLOMITE_MARGIN.getMarketPrice(_outputMarket).value;
        amountOut = DolomiteMarginMath.getPartial(inputPrice, _inputAmount, outputPrice);
        if (amountOut >= _minAmountOut) { /* FOR COVERAGE TESTING */ }
        Require.that(amountOut >= _minAmountOut,
            FILE,
            "Insufficient output amount"
        );

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](ACTIONS_LENGTH);
        actions[0] = AccountActionLib.encodeExternalSellAction(
            _primaryAccountId,
            _inputMarket,
            _outputMarket,
            address(this),
            _inputAmount,
            amountOut,
            _orderData
        );
        return actions;
    }

    function exchange(
        address,
        address _receiver,
        address _makerToken,
        address,
        uint256,
        bytes calldata _orderData
    )
    external
    returns (uint256) {
        if (_makerToken == OUTPUT_TOKEN) { /* FOR COVERAGE TESTING */ }
        Require.that(_makerToken == OUTPUT_TOKEN,
            FILE,
            "Maker token must be OUTPUT_TOKEN",
            _makerToken
        );

        (uint256 amountOut,) = abi.decode(_orderData, (uint256, bytes));

        TestToken(_makerToken).setBalance(address(this), amountOut);
        TestToken(_makerToken).approve(_receiver, amountOut);
        return amountOut;
    }

    function getExchangeCost(
        address _makerToken,
        address _takerToken,
        uint256 _desiredMakerToken,
        bytes calldata
    )
    external
    view
    returns (uint256) {
        if (_takerToken == OUTPUT_TOKEN) { /* FOR COVERAGE TESTING */ }
        Require.that(_takerToken == OUTPUT_TOKEN,
            FILE,
            "Taker token must be OUTPUT_TOKEN",
            _takerToken
        );

        uint256 makerMarketId = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_makerToken);
        uint256 takerMarketId = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_takerToken);

        uint256 makerPrice = DOLOMITE_MARGIN.getMarketPrice(makerMarketId).value;
        uint256 takerPrice = DOLOMITE_MARGIN.getMarketPrice(takerMarketId).value;

        return DolomiteMarginMath.getPartial(_desiredMakerToken, makerPrice, takerPrice);
    }
}
