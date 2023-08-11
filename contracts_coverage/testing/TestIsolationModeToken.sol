/*

    Copyright 2021 Dolomite

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

import { IIsolationModeToken } from "../external/interfaces/IIsolationModeToken.sol";

import { CustomTestToken } from "./CustomTestToken.sol";


contract TestIsolationModeToken is IIsolationModeToken, CustomTestToken {

    mapping(address => bool) private trustedTokenConverters;

    constructor(
        string memory __name,
        string memory __symbol,
        uint8 __decimals
    )
    public
    CustomTestToken(__name, __symbol, __decimals)
    {
        // solium-disable-previous-line no-empty-blocks
    }

    function setTokenConverterTrusted(address _tokenConverter, bool _trusted) external {
        trustedTokenConverters[_tokenConverter] = _trusted;
    }

    function isTokenConverterTrusted(address _tokenConverter) external view returns (bool) {
        return trustedTokenConverters[_tokenConverter];
    }

    function isIsolationAsset() external view returns (bool) {
        return true;
    }
}
