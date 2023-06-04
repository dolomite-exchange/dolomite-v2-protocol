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
 * @title   IIsolationModeWrapperTrader
 * @author  Dolomite
 *
 * Interface for a contract that can convert a token into an isolation mode token.
 */
contract IIsolationModeWrapperTrader is IExchangeWrapper {

    /**
     * @return The isolation mode token that this contract can wrap (the output token)
     */
    function token() external view returns (address);

    /**
     * @return True if the `_inputToken` is a valid input token for this contract, to be wrapped into `token()`
     */
    function isValidInputToken(address _inputToken) external view returns (bool);

    /**
     * @return  The number of Actions used to wrap a valid input token into the this wrapper's Isolation Mode token.
     */
    function actionsLength() external pure returns (uint256);

    /**
     * @notice  Creates the necessary actions for selling the `_inputMarket` into `_outputMarket`. Note, the
     *          `_outputMarket` should be equal to `token()` and `_inputMarket` should be validated to be a correct
     *           market that can be transformed into `token()`.
     *
     * @param _primaryAccountId     The index of the account (according the Accounts[] array) that is performing the
     *                              sell.
     * @param _otherAccountId       The index of the account (according the Accounts[] array) that is being liquidated.
     *                              This is set to `_primaryAccountId` if a liquidation is not occurring.
     * @param _primaryAccountOwner  The address of the owner of the account that is performing the sell.
     * @param _otherAccountOwner    The address of the owner of the account that is being liquidated. This is set to
     *                              `_primaryAccountOwner` if a liquidation is not occurring.
     * @param _outputMarket         The market that is being outputted by the wrapping, should be equal to `token().
     * @param _inputMarket          The market that is being used to wrap into `token()`.
     * @param _minOutputAmount      The min amount of `_outputMarket` that must be outputted by the wrapping.
     * @param _inputAmount          The amount of the `_inputMarket` that the _primaryAccountId must sell.
     * @param _orderData            The calldata to pass through to any external sales that occur.
     * @return                      The actions that will be executed to wrap the `_inputMarket` into `_outputMarket`.
     */
    function createActionsForWrapping(
        uint256 _primaryAccountId,
        uint256 _otherAccountId,
        address _primaryAccountOwner,
        address _otherAccountOwner,
        uint256 _outputMarket,
        uint256 _inputMarket,
        uint256 _minOutputAmount,
        uint256 _inputAmount,
        bytes calldata _orderData
    )
        external
        view
        returns (Actions.ActionArgs[] memory);
}
