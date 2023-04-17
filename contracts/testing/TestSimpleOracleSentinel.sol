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

import { IOracleSentinel } from "../protocol/interfaces/IOracleSentinel.sol";


/**
 * @title TestSimpleOracleSentinel
 * @author Dolomite
 *
 * An implementation of the IOracleSentinel interface that lets anyone update the return functions.
 */
contract TestSimpleOracleSentinel is IOracleSentinel {

    bool internal _isBorrowAllowed = true;
    bool internal _isLiquidationAllowed = true;

    function setIsBorrowAllowed(bool newIsBorrowAllowed) external {
        _isBorrowAllowed = newIsBorrowAllowed;
    }

    function isBorrowAllowed() external view returns (bool) {
        return _isBorrowAllowed;
    }

    function setIsLiquidationAllowed(bool newIsLiquidationAllowed) external {
        _isLiquidationAllowed = newIsLiquidationAllowed;
    }

    function isLiquidationAllowed() external view returns (bool) {
        return _isLiquidationAllowed;
    }
}
