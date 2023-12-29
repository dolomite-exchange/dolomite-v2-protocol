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


/**
 * @title   IAuthorizationBase
 * @author  Dolomite
 * @notice  Interface for allowing only trusted callers to invoke functions that use the `requireIsCallerAuthorized`
 *          modifier.
 */
interface IAuthorizationBase {

    /**
     * @param _caller   The address that will call the functions of this contract
     * @return          True if the caller is authorized
     */
    function isCallerAuthorized(address _caller) external view returns (bool);

    /**
     * @param _caller       The address that will call the `transfer` functions of this contract
     * @param _isAuthorized True if the caller is authorized, false otherwise
     */
    function setIsCallerAuthorized(address _caller, bool _isAuthorized) external;
}
