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

import {ILiquidityTokenUnwrapperTrader} from "../external/interfaces/ILiquidityTokenUnwrapperForLiquidation.sol";

import { AccountActionLib } from "../external/lib/AccountActionLib.sol";

import { Actions } from "../protocol/lib/Actions.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { Require } from "../protocol/lib/Require.sol";

import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";

import { TestToken } from "./TestToken.sol";


contract TestLiquidityTokenUnwrapperTrader is ILiquidityTokenUnwrapperTrader {

    bytes32 constant FILE = "TestLiquidityTokenUnwrapper";

    uint256 constant public ACTIONS_LENGTH = 1;

    IDolomiteMargin public DOLOMITE_MARGIN;
    address public INPUT_TOKEN;
    address public OUTPUT_TOKEN;
    uint256 public OUTPUT_MARKET_ID;

    constructor(
        address _inputToken,
        address _outputToken,
        address _dolomiteMargin
    ) public {
        INPUT_TOKEN = _inputToken;
        OUTPUT_TOKEN = _outputToken;
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);

        OUTPUT_MARKET_ID = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_outputToken);
    }

    function token() external view returns (address) {
        return INPUT_TOKEN;
    }

    function actionsLength() external pure returns (uint256) {
        return ACTIONS_LENGTH;
    }

    function outputMarketId() external view returns (uint256) {
        return OUTPUT_MARKET_ID;
    }

    function createActionsForUnwrappingForLiquidation(
        uint256 _solidAccountId,
        uint256,
        address,
        address,
        uint256,
        uint256 _heldMarket,
        uint256,
        uint256 _heldAmountWithReward
    )
    external
    view
    returns (Actions.ActionArgs[] memory) {
        if (DOLOMITE_MARGIN.getMarketIdByTokenAddress(INPUT_TOKEN) == _heldMarket) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN.getMarketIdByTokenAddress(INPUT_TOKEN) == _heldMarket,
            FILE,
            "Invalid held market",
            _heldMarket
        );
        uint256 amountOut;
        uint256 heldPrice = DOLOMITE_MARGIN.getMarketPrice(_heldMarket).value;
        uint256 outputPrice = DOLOMITE_MARGIN.getMarketPrice(OUTPUT_MARKET_ID).value;
        amountOut = DolomiteMarginMath.getPartial(heldPrice, _heldAmountWithReward, outputPrice);

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](ACTIONS_LENGTH);
        actions[0] = AccountActionLib.encodeExternalSellAction(
            _solidAccountId,
            _heldMarket,
            OUTPUT_MARKET_ID,
            address(this),
            _heldAmountWithReward,
            amountOut,
            bytes("")
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
        if (_makerToken == INPUT_TOKEN) { /* FOR COVERAGE TESTING */ }
        Require.that(_makerToken == INPUT_TOKEN,
            FILE,
            "Maker token must be INPUT_TOKEN",
            _makerToken
        );
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
