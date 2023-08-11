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

pragma solidity >=0.5.0;

import { DolomiteAmmLibrary } from "../external/lib/DolomiteAmmLibrary.sol";


library TestDolomiteAmmLibrary {

    function getPairInitCodeHash() external pure returns (bytes32) {
        return DolomiteAmmLibrary.getPairInitCodeHash(address(0));
    }

    function getPools(
        address factory,
        bytes32 initCodeHash,
        address[] calldata path
    ) external pure returns (address[] memory) {
        return DolomiteAmmLibrary.getPools(factory, initCodeHash, path);
    }

    function sortTokens(
        address tokenA,
        address tokenB
    ) external pure returns (address token0, address token1) {
        (token0, token1) = DolomiteAmmLibrary.sortTokens(tokenA, tokenB);
    }

    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) external pure returns (uint256 amountB) {
        amountB = DolomiteAmmLibrary.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256 amountOut) {
        amountOut = DolomiteAmmLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256 amountIn) {
        amountIn = DolomiteAmmLibrary.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function getAmountsOutWei(
        address factory,
        bytes32 initCodeHash,
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts) {
        amounts = DolomiteAmmLibrary.getAmountsOutWei(factory, initCodeHash, amountIn, path);
    }

    function getAmountsInWei(
        address factory,
        bytes32 initCodeHash,
        uint256 amountOut,
        address[] calldata path
    ) external view returns (uint256[] memory amounts) {
        amounts = DolomiteAmmLibrary.getAmountsInWei(factory, initCodeHash, amountOut, path);
    }

    function getAmountsIn(
        address factory,
        bytes32 initCodeHash,
        uint256 amountOut,
        address[] calldata path
    ) external view returns (uint256[] memory amounts) {
        amounts = DolomiteAmmLibrary.getAmountsIn(factory, initCodeHash, amountOut, path);
    }
}
