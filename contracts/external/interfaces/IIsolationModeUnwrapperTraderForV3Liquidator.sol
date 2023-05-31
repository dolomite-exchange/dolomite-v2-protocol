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

import { IExchangeWrapper } from "../../protocol/interfaces/IExchangeWrapper.sol";
import { Actions } from "../../protocol/lib/Actions.sol";


/**
 * @title   IIsolationModeUnwrapperTraderOld
 * @author  Dolomite
 *
 * Interface for a contract that can convert an LP token into an underlying token with an older interface that is only
 * used with `LiquidatorProxyV3WithLiquidityToken`.
 */
contract IIsolationModeUnwrapperTraderForV3Liquidator is IExchangeWrapper {

    /**
 * @return The isolation mode token that this contract can unwrap (the input token).
     */
    function token() external view returns (address);

    /**
     * @return  The number of Actions used to unwrap the liquidity token.
     */
    function actionsLength() external pure returns (uint256);

    /**
     * @notice  Creates the necessary actions for selling the `_inputMarket` into `_outputMarket`. Note, the
     *          `_inputMarket` should be equal to `token()` and `_outputMarket` should be validated to be a correct
     *           market that can be transformed into `token()`.
     *
     * @param _primaryAccountId     The index of the account (according the Accounts[] array) that is performing the
     *                              sell.
     * @param _otherAccountId       The index of the account (according the Accounts[] array) that is being liquidated.
     *                              This is set to `_primaryAccountId` if a liquidation is not occurring.
     * @param _primaryAccountOwner  The address of the owner of the account that is performing the sell.
     * @param _otherAccountOwner    The address of the owner of the account that is being liquidated. This is set to
     *                              `_primaryAccountOwner` if a liquidation is not occurring.
     * @param _outputMarket         The market that is being outputted by the unwrapping.
     * @param _inputMarket          The market that is being unwrapped, should be equal to `token()`.
     * @param _minOutputAmount      The min amount of `_outputMarket` that must be outputted by the unwrapping.
     * @param _inputAmount          The amount of the `_inputMarket` that the _primaryAccountId must sell.
     * @return                      The actions that will be executed to unwrap the `_inputMarket` into `_outputMarket`.
     */
    function createActionsForUnwrappingForLiquidation(
        uint256 _primaryAccountId,
        uint256 _otherAccountId,
        address _primaryAccountOwner,
        address _otherAccountOwner,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _minOutputAmount,
        uint256 _inputAmount
    )
    external
    view
    returns (Actions.ActionArgs[] memory);

    /**
     * @return The liquidity token that this contract can unwrap (the input token).
     */
    function outputMarketId() external view returns (uint256);
}
