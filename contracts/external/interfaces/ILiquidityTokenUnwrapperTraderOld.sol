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
pragma experimental ABIEncoderV2;

import { Actions } from "../../protocol/lib/Actions.sol";

import { ILiquidityTokenUnwrapperTrader } from "./ILiquidityTokenUnwrapperTrader.sol";


/**
 * @title   ILiquidityTokenUnwrapperTraderOld
 * @author  Dolomite
 *
 * Interface for a contract that can convert an LP token into an underlying token with an older interface that is only
 * used with `LiquidatorProxyV3WithLiquidityToken`.
 */
contract ILiquidityTokenUnwrapperTraderOld is ILiquidityTokenUnwrapperTrader {

    /**
     * @return The liquidity token that this contract can unwrap (the input token).
     */
    function outputMarketId() external view returns (uint256);
}
