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

import { Account } from "../lib/Account.sol";
import { Types } from "../lib/Types.sol";


/**
 * @title IExternalCallback
 * @author Dolomite
 *
 * Interface that smart contract users can implement to be notified of their balance(s) changing.
 */
interface IExternalCallback {

    /**
     * A callback function to notify the smart contract user that their balance is changing. This function is called
     * after the new balances are set in state, so calling `getAccountPar/Wei` will return each account's balance
     * after `primaryDeltaWei` and `secondaryDeltaWei` are applied.
     *
     * The `_accountOwner` isn't a parameter because technically it is the implementing contract. So, to construct the
     * `Account.Info` object for the primary account, use the following in the implementation:
     * `Account.Info({ owner: address(this), number: _accountNumber })`.
     *
     * @param _primaryAccountNumber The account number of the account being operated on
     * @param _secondaryAccount     The account that is receiving the primary account's assets. To calculate the value
     *                              received by the secondary account, negate primary/secondary delta wei.
     * @param _primaryMarketId      The market that was positive for this account, whose collateral is being seized
     * @param _primaryDeltaWei      The amount of primary market that was received or paid
     * @param _secondaryMarketId    The borrowed balance that is being forcefully repaid
     * @param _secondaryDeltaWei    The amount of borrowed assets to be repaid. Always 0 or positive, since the user's
     *                          balance is going from negative to 0.
     */
    function onInternalBalanceChange(
        uint256 _primaryAccountNumber,
        Account.Info calldata _secondaryAccount,
        uint256 _primaryMarketId,
        Types.Wei calldata _primaryDeltaWei,
        uint256 _secondaryMarketId,
        Types.Wei calldata _secondaryDeltaWei
    ) external;
}
