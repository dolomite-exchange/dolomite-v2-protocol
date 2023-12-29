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

import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import { CustomTestToken } from "./CustomTestToken.sol";
import { IWETH } from "../external/interfaces/IWETH.sol";


contract TestWETH is IWETH, CustomTestToken {
    using Address for address payable;

    event  Deposit(address indexed dst, uint wad);
    event  Withdrawal(address indexed src, uint wad);

    constructor(
        string memory __name,
        string memory __symbol
    ) CustomTestToken(__name, __symbol, 18) public {}

    function() external payable {
        deposit();
    }

    function deposit() public payable {
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint wad) public {
        require(
            balances[msg.sender] >= wad,
            "TestWETH::withdraw: INSUFFICIENT_BALANCE"
        );

        balances[msg.sender] -= wad;
        msg.sender.sendValue(wad);
        emit Withdrawal(msg.sender, wad);
    }
}
