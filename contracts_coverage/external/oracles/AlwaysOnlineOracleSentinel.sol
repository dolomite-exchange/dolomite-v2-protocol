/*

    Copyright 2020 Dolomite.

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

import { IOracleSentinel } from "../../protocol/interfaces/IOracleSentinel.sol";


/**
 * @title AlwaysOnlineOracleSentinel
 * @author Dolomite
 *
 * An implementation of the IOracleSentinel interface that always returns `true` for its implementation functions.
 * Useful for deployments on networks that don't need an oracle sentinel.
 */
contract AlwaysOnlineOracleSentinel is IOracleSentinel {

    function ownerSetGracePeriod(
        uint256 /* _gracePeriod */
    ) external {
        revert("AlwaysOnlineOracleSentinel: Not implemented");
    }

    function isBorrowAllowed() external view returns (bool) {
        return true;
    }

    function isLiquidationAllowed() external view returns (bool) {
        return true;
    }

    function gracePeriod() external view returns (uint256) {
        return 0;
    }
}
