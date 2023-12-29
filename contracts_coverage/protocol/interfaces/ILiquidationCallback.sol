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

pragma solidity >=0.5.0;
pragma experimental ABIEncoderV2;

import { Types } from "../lib/Types.sol";


/**
 * @title ILiquidationCallback
 * @author Dolomite
 *
 * Interface that smart contract users can implement to be notified of their account being liquidated.
 */
interface ILiquidationCallback {

    /**
     * A callback function to notify the smart contract that it is being liquidated. This function is called before the
     * new balances are set in state, so calling `getAccountPar/Wei` will return this liquidated account's balance
     * before `heldDeltaWei` or `owedDeltaWei` are applied.
     *
     * @param _accountNumber    The account number being liquidated
     * @param _heldMarketId     The market that was positive for this account, whose collateral is being seized
     * @param _heldDeltaWei     The amount of seized collateral; always negative or 0
     * @param _owedMarketId     The borrowed balance that is being forcefully repaid
     * @param _owedDeltaWei     The amount of borrowed assets to be repaid. Always 0 or positive, since the user's
     *                          balance is going from negative to 0.
     */
    function onLiquidate(
        uint256 _accountNumber,
        uint256 _heldMarketId,
        Types.Wei calldata _heldDeltaWei,
        uint256 _owedMarketId,
        Types.Wei calldata _owedDeltaWei
    ) external;
}
