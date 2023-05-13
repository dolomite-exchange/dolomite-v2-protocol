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

import { IExchangeWrapper } from "../../protocol/interfaces/IExchangeWrapper.sol";


contract ILiquidityTokenUnwrapperTrader is IExchangeWrapper {

    /**
     * @return The liquidity token that this contract can unwrap
     */
    function token() external view returns (address);

    /**
     * @return  The number of Actions used to unwrap the LP token into `outputMarketId`. If `owedMarketId` equals
     *          `outputMarketId`, there is no need to chain additional actions on, since the debt will be paid off.
     */
    function actionsLength() external pure returns (uint256);

    function outputMarketId() external view returns (uint256);

    /**
     * @notice  Creates the necessary actions for selling the `_heldMarket` into `_outputMarket`. Note, `_outputMarket`
     *          may not equal `_owedMarket` depending on the implementation of this contract. It is the responsibility
     *          of the caller to ensure that the `_outputMarket` is converted to `_owedMarket` in subsequent actions.
     *
     * @param _solidAccountId       The index of the account (according the Accounts[] array) that is performing the
     *                              liquidation.
     * @param _liquidAccountId      The index of the account (according the Accounts[] array) that is being liquidated.
     * @param _solidAccountOwner    The address of the owner of the account that is performing the liquidation.
     * @param _liquidAccountOwner   The address of the owner of the account that is being liquidated.
     * @param _owedMarket           The market that the liquid account owes and must be repaid via the liquidation.
     * @param _heldMarket           The market that the liquid account holds and must be sold to repay the
     *                              `_owedMarket`.
     * @param _owedAmount           The amount of the `_owedMarket` that the liquid account owes and must repay.
     * @param _heldAmountWithReward The amount of the `_heldMarket` that the liquid account holds and must sell.
     * @return                      The actions that will be executed to unwrap the `_heldMarket` into `outputMarketId`.
     */
    function createActionsForUnwrappingForLiquidation(
        uint256 _solidAccountId,
        uint256 _liquidAccountId,
        address _solidAccountOwner,
        address _liquidAccountOwner,
        uint256 _owedMarket,
        uint256 _heldMarket,
        uint256 _owedAmount,
        uint256 _heldAmountWithReward
    )
        external
        view
        returns (Actions.ActionArgs[] memory);
}
