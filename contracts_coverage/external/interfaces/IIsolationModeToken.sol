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


/**
 * @title   IIsolationModeToken
 * @author  Dolomite
 *
 * @notice  Interface for an `IsolationMode` token (implemented in Modules repository:
 *          https://github.com/dolomite-exchange/dolomite-margin-modules)
 */
interface IIsolationModeToken {

    // ========== Public Functions ==========

    /**
     * @notice  A token converter is used to convert this underlying token into a Dolomite-compatible one for deposit
     *          or withdrawal or vice-versa. Token converters are trusted contracts that are whitelisted by Dolomite,
     *          malicious ones would be able to mess with the accounting or misappropriate a user's funds in their proxy
     *          vault. Token converters can come in the form of "wrappers" or "unwrappers"
     *
     * @return  True if the token converter is currently enabled for use by this contract.
     */
    function isTokenConverterTrusted(address _tokenConverter) external view returns (bool);

    /**
     * @return True if the token is an isolation mode asset, false otherwise.
     */
    function isIsolationAsset() external view returns (bool);
}
