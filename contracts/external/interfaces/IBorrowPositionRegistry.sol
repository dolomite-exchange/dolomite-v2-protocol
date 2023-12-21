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

import { Events } from "../../protocol/lib/Events.sol";


/**
 * @title IBorrowPositionRegistry
 * @author Dolomite
 *
 * An implementation for an upgradeable proxy for emitting margin position-related events. Useful for indexing margin
 * positions from a singular address.
 */
interface IBorrowPositionRegistry {

    // ============ Events ============

    /**
     * @notice This is emitted when a borrow position is initially opened
     *
     * @param borrower              The address of the account that opened the position
     * @param borrowAccountNumber   The account number of the account that opened the position
     */
    event BorrowPositionOpen(
        address indexed borrower,
        uint256 indexed borrowAccountNumber
    );

    // ============ Functions ============

    /**
     * @notice Emits a MarginPositionOpen event
     *
     * @param _accountOwner          The address of the account that opened the position
     * @param _accountNumber         The account number of the account that opened the position
     */
    function emitBorrowPositionOpen(
        address _accountOwner,
        uint256 _accountNumber
    )
    external;
}
