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

import { Account } from "../protocol/lib/Account.sol";

import { ICallee } from "../protocol/interfaces/ICallee.sol";

import { RecyclableTokenProxy } from "../external/proxies/RecyclableTokenProxy.sol";


contract TestRecyclableToken is RecyclableTokenProxy, ICallee {

    bytes32 private constant FILE = "TestRecyclableTokenProxy";

    constructor (
        address dolomiteMargin,
        address token,
        address expiry,
        uint256 expirationTimestamp
    )
    public
    RecyclableTokenProxy(dolomiteMargin, token, expiry, expirationTimestamp)
    {}

    function callFunction(
        address,
        Account.Info memory accountInfo,
        bytes memory data
    )
    public onlyDolomiteMargin(msg.sender) {
        // used as a way to re-enter into certain functions
        (uint256 action, bytes memory innerData) = abi.decode(data, (uint256, bytes));
        if (action == 1) {
            recycle();
        } else if (action == 2) {
            uint256 amount = abi.decode(innerData, (uint256));
            transfer(accountInfo.owner, amount);
        } else if (action == 3) {
            (address from, address to, uint256 amount) = abi.decode(innerData, (address, address, uint256));
            transferFrom(from, to, amount);
        }
    }

}
