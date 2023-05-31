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

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { Require } from "../../protocol/lib/Require.sol";

import { IAuthorizationBase } from "../interfaces/IAuthorizationBase.sol";


contract AuthorizationBase is IAuthorizationBase {

    // ============ Constants ============

    bytes32 private constant FILE = "AuthorizationBase";

    // ============ State Variables ============

    IDolomiteMargin public DOLOMITE_MARGIN;
    mapping(address => bool) private _isCallerAuthorized;

    // ============ Modifiers ============

    modifier requireIsCallerAuthorized(address _caller) {
        Require.that(
            _isCallerAuthorized[_caller],
            FILE,
            "unauthorized",
            _caller
        );
        _;
    }

    // ============ Constructor ============

    constructor(
        address _dolomiteMargin
    )
    public
    {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    function setIsCallerAuthorized(address _caller, bool _isAuthorized) external {
        Require.that(
            DOLOMITE_MARGIN.getIsGlobalOperator(msg.sender) || DOLOMITE_MARGIN.owner() == msg.sender,
            FILE,
            "unauthorized",
            _caller
        );
        _isCallerAuthorized[_caller] = _isAuthorized;
    }

    function isCallerAuthorized(address _caller) external view returns (bool) {
        return _isCallerAuthorized[_caller];
    }
}
