/*

    Copyright 2022 Dolomite.

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

import { Require } from "../protocol/lib/Require.sol";

import { TestToken } from "./TestToken.sol";


contract TestParaswapTransferProxy {

    bytes32 private constant FILE = "TestParaswapTransferProxy";

    /**
     * This function is called blindly by `LiquidatorProxyV2WithExternalLiquidity` via the pass through "_paraswapCalldata" variable
     */
    function doTransfer(
        address _token,
        address _from,
        address _to,
        uint256 _amount
    ) external {
        Require.that(
            TestToken(_token).balanceOf(_from) >= _amount,
            FILE,
            "insufficient balance",
            TestToken(_token).balanceOf(_from),
            _amount
        );
        if (_amount == 420) {
            revert(); // fail silently to test the "no msg" branch
        }
        TestToken(_token).transferFrom(_from, _to, _amount);
    }
}
