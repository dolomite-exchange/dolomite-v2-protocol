/*

    Copyright 2023 Dolomite.

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

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Events } from "../../protocol/lib/Events.sol";
import { Require } from "../../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IBorrowPositionRegistry } from "../interfaces/IBorrowPositionRegistry.sol";


/**
 * @title   BorrowPositionRegistry
 * @author  Dolomite
 *
 * @dev Proxy contract for emitting events for a singular address when a borrow position is opened
 */
contract BorrowPositionRegistry is IBorrowPositionRegistry, OnlyDolomiteMargin {

    // ============ Constructor ============

    constructor (
        address dolomiteMargin
    )
    public
    OnlyDolomiteMargin(dolomiteMargin)
    {
        // solhint-disable-line no-empty-blocks
    }

    function emitBorrowPositionOpen(
        address _accountOwner,
        uint256 _accountNumber
    )
        public
        onlyGlobalOperator(msg.sender)
    {
        emit BorrowPositionOpen(
            _accountOwner,
            _accountNumber
        );
    }
}
