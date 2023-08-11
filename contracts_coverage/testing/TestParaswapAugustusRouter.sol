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

import { TestParaswapTransferProxy } from "./TestParaswapTransferProxy.sol";
import { TestToken } from "./TestToken.sol";


contract TestParaswapAugustusRouter {

    TestParaswapTransferProxy public TRANSFER_PROXY;

    constructor(address _transferProxy) public {
        TRANSFER_PROXY = TestParaswapTransferProxy(_transferProxy);
    }

    /**
     * This function is called blindly via the pass-through `_paraswapCalldata` variable
     */
    function call(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut
    ) external {
        TRANSFER_PROXY.doTransfer(tokenIn, msg.sender, address(this), amountIn);
        TestToken(tokenOut).addBalance(msg.sender, amountOut);
    }
}
