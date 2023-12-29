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


interface ITransferProxy {

    /**
     * @notice Transfers `_token` `_amountWei` from `msg.sender` to `to`. Throws if the caller is not authorized.
     */
    function transfer(
        uint256 _fromAccountNumber,
        address _to,
        uint256 _toAccountNumber,
        address _token,
        uint256 _amountWei
    ) external;

    /**
     * @notice  Transfers `_tokens` `_amountWei` from `msg.sender` to `to`. Throws if the caller is not authorized.
     *          Throws if the length of `_tokens` and `_amountsWei` are not equal.
     */
    function transferMultiple(
        uint256 _fromAccountNumber,
        address _to,
        uint256 _toAccountNumber,
        address[] calldata _tokens,
        uint256[] calldata _amountsWei
    ) external;

    /**
     * @notice  Transfers `_markets` `_amountsWei` from `msg.sender` to `to`. Throws is the caller is not authorized.
     *          Throws if the length of `_markets` and `_amountsWei` are not equal.
     */
    function transferMultipleWithMarkets(
        uint256 _fromAccountNumber,
        address _to,
        uint256 _toAccountNumber,
        uint256[] calldata _markets,
        uint256[] calldata _amountsWei
    ) external;
}
