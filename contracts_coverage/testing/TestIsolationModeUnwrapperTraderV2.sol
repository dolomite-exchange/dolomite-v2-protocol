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

import { IIsolationModeUnwrapperTraderV2 } from "../external/interfaces/IIsolationModeUnwrapperTraderV2.sol";

import { AccountActionLib } from "../external/lib/AccountActionLib.sol";

import { ICallee } from "../protocol/interfaces/ICallee.sol";

import { Account } from "../protocol/lib/Account.sol";
import { Actions } from "../protocol/lib/Actions.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { Require } from "../protocol/lib/Require.sol";

import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";

import { TestToken } from "./TestToken.sol";


contract TestIsolationModeUnwrapperTraderV2 is IIsolationModeUnwrapperTraderV2, ICallee {

    bytes32 private constant FILE = "TestUnwrapperTraderV2";

    uint256 constant public ACTIONS_LENGTH = 2;

    IDolomiteMargin public DOLOMITE_MARGIN;
    address public UNDERLYING_TOKEN;
    address public OUTPUT_TOKEN;

    constructor(
        address _inputToken,
        address _outputToken,
        address _dolomiteMargin
    ) public {
        UNDERLYING_TOKEN = _inputToken;
        OUTPUT_TOKEN = _outputToken;
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    function exchange(
        address,
        address _receiver,
        address _makerToken,
        address _takerToken,
        uint256,
        bytes calldata _orderData
    )
    external
    returns (uint256) {
        if (_takerToken == UNDERLYING_TOKEN) { /* FOR COVERAGE TESTING */ }
        Require.that(_takerToken == UNDERLYING_TOKEN,
            FILE,
            "Taker token must be UNDERLYING",
            _takerToken
        );

        (uint256 amountOut,) = abi.decode(_orderData, (uint256, bytes));
        TestToken(_makerToken).setBalance(address(this), amountOut);
        TestToken(_makerToken).approve(_receiver, amountOut);
        return amountOut;
    }

    function token() external view returns (address) {
        return UNDERLYING_TOKEN;
    }

    function outputMarketId() external view returns (uint256) {
        return DOLOMITE_MARGIN.getMarketIdByTokenAddress(OUTPUT_TOKEN);
    }

    function isValidOutputToken(address _outputToken) external view returns (bool) {
        return _outputToken == OUTPUT_TOKEN;
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
        if (_makerToken == UNDERLYING_TOKEN) { /* FOR COVERAGE TESTING */ }
        Require.that(_makerToken == UNDERLYING_TOKEN,
            FILE,
            "Maker token must be wrapper",
            _makerToken
        );

        uint256 makerMarketId = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_makerToken);
        uint256 takerMarketId = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_takerToken);

        uint256 makerPrice = DOLOMITE_MARGIN.getMarketPrice(makerMarketId).value;
        uint256 takerPrice = DOLOMITE_MARGIN.getMarketPrice(takerMarketId).value;

        return DolomiteMarginMath.getPartial(_desiredMakerToken, makerPrice, takerPrice);
    }

    function actionsLength() external pure returns (uint256) {
        return ACTIONS_LENGTH;
    }

    // ========================= Public Functions =========================

    function callFunction(
        address /* _sender */,
        Account.Info memory,
        bytes memory _data
    )
    public {
        if (msg.sender == address(DOLOMITE_MARGIN)) { /* FOR COVERAGE TESTING */ }
        Require.that(msg.sender == address(DOLOMITE_MARGIN),
            FILE,
            "Invalid caller",
            msg.sender
        );
        if (_data.length == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(_data.length == 0,
            FILE,
            "callFunction should be noop"
        );
    }

    function createActionsForUnwrapping(
        CreateActionsForUnwrappingParams memory _params
    )
    public
    view
    returns (Actions.ActionArgs[] memory) {
        if (DOLOMITE_MARGIN.getMarketIdByTokenAddress(UNDERLYING_TOKEN) == _params.inputMarket) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN.getMarketIdByTokenAddress(UNDERLYING_TOKEN) == _params.inputMarket,
            FILE,
            "Invalid input market",
            _params.inputMarket
        );
        if (DOLOMITE_MARGIN.getMarketIdByTokenAddress(OUTPUT_TOKEN) == _params.outputMarket) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN.getMarketIdByTokenAddress(OUTPUT_TOKEN) == _params.outputMarket,
            FILE,
            "Invalid output market",
            _params.outputMarket
        );
        uint256 amountOut;
        uint256 inputPrice = DOLOMITE_MARGIN.getMarketPrice(_params.inputMarket).value;
        uint256 outputPrice = DOLOMITE_MARGIN.getMarketPrice(_params.outputMarket).value;
        amountOut = DolomiteMarginMath.getPartial(inputPrice, _params.inputAmount, outputPrice);
        if (amountOut >= _params.minOutputAmount) { /* FOR COVERAGE TESTING */ }
        Require.that(amountOut >= _params.minOutputAmount,
            FILE,
            "Insufficient output amount"
        );

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](ACTIONS_LENGTH);
        actions[0] = AccountActionLib.encodeExternalSellAction(
            _params.primaryAccountId,
            _params.inputMarket,
            _params.outputMarket,
            address(this),
            _params.inputAmount,
            amountOut,
            _params.orderData
        );
        // Unwrappers can have length > 1 so we encode a no-op to simulate there being more than one actions
        actions[1] = AccountActionLib.encodeCallAction(
            _params.primaryAccountId,
            address(this),
            bytes("")
        );
        return actions;
    }
}
