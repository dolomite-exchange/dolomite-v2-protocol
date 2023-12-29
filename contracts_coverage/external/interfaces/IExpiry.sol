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

pragma solidity ^0.5.7;
pragma experimental ABIEncoderV2;

import { Account } from "../../protocol/lib/Account.sol";
import { Monetary } from "../../protocol/lib/Monetary.sol";


/**
 * @title IExpiry
 * @author Dolomite
 */
interface IExpiry {

    // ============ Enums ============

    enum CallFunctionType {
        SetExpiry,
        SetApproval
    }

    // ============ Structs ============

    struct SetExpiryArg {
        Account.Info account;
        uint256 marketId;
        uint32 timeDelta;
        bool forceUpdate;
    }

    struct SetApprovalArg {
        address sender;
        uint32 minTimeDelta;
    }

    // ============ Functions ============

    function g_expiryRampTime() external view returns (uint256);

    function getSpreadAdjustedPrices(
        uint256 heldMarketId,
        uint256 owedMarketId,
        uint32 expiry
    )
        external
        view
        returns (Monetary.Price memory heldPrice, Monetary.Price memory owedPriceAdj);

    function getExpiry(
        Account.Info calldata account,
        uint256 marketId
    )
        external
        view
        returns (uint32);

}
