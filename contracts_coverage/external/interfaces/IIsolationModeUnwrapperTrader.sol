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


/**
 * @title   IIsolationModeUnwrapperTrader
 * @author  Dolomite
 *
 * Interface for a contract that can convert an isolation mode token into an underlying component token.
 */
contract IIsolationModeUnwrapperTrader is IExchangeWrapper {

    struct CreateActionsForUnwrappingParams {
        /// @dev    The index of the account (according the Accounts[] array) that is performing the sell.
        uint256 primaryAccountId;
        /// @dev    The index of the account (according the Accounts[] array) that is being liquidated. This is set to
        ///         `_primaryAccountId` if a liquidation is not occurring.
        uint256 otherAccountId;
        /// @dev    The address of the owner of the account that is performing the sell.
        address primaryAccountOwner;
        /// @dev    The account number of the owner of the account that is performing the sell.
        uint256 primaryAccountNumber;
        /// @dev    The address of the owner of the account that is being liquidated. This is set to
        ///         `_primaryAccountOwner` if a liquidation is not occurring.
        address otherAccountOwner;
        /// @dev    The account number of the owner of the account that is being liquidated. This is set to
        ///         `_primaryAccountNumber` if a liquidation is not occurring.
        uint256 otherAccountNumber;
        /// @dev    The market that is being outputted by the unwrapping.
        uint256 outputMarket;
        /// @dev    The market that is being unwrapped, should be equal to `token()`.
        uint256 inputMarket;
        /// @dev    The min amount of `_outputMarket` that must be outputted by the unwrapping.
        uint256 minOutputAmount;
        /// @dev    The amount of the `_inputMarket` that the _primaryAccountId must sell.
        uint256 inputAmount;
        /// @dev    The calldata to pass through to any external sales that occur.
        bytes orderData;
    }

    /**
     * @return The isolation mode token that this contract can unwrap
     */
    function token() external view returns (address);

    /**
     * @return True if the `_outputToken` is a valid output token for this contract, to be unwrapped by `token()`.
     */
    function isValidOutputToken(address _outputToken) external view returns (bool);

    /**
     * @return  The number of actions used to unwrap the Isolation Mode token into a valid output token.
     */
    function actionsLength() external pure returns (uint256);

    /**
     * @notice  Creates the necessary actions for selling the `_inputMarket` into `_outputMarket`. Note, the
     *          `_inputMarket` should be equal to `token()` and `_outputMarket` should be validated to be a correct
     *           market that can be transformed into `token()`.
     *
     * @param _params   The parameters for creating the actions for unwrapping.
     * @return          The actions that will be executed to unwrap the `_inputMarket` into `_outputMarket`.
     */
    function createActionsForUnwrapping(
        CreateActionsForUnwrappingParams calldata _params
    )
    external
    view
    returns (Actions.ActionArgs[] memory);
}
