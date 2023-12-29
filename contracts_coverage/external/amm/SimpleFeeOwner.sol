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

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { IDolomiteAmmFactory } from "../interfaces/IDolomiteAmmFactory.sol";
import { IDolomiteAmmPair } from "../interfaces/IDolomiteAmmPair.sol";


contract SimpleFeeOwner is Ownable {
    using SafeERC20 for IERC20;

    event OwnershipChanged(address indexed newOwner, address indexed oldOwner);

    IDolomiteAmmFactory uniswapFactory;
    IDolomiteMargin dolomiteMargin;

    constructor(
        address _uniswapFactory,
        address _dolomiteMargin
    ) public {
        uniswapFactory = IDolomiteAmmFactory(_uniswapFactory);
        dolomiteMargin = IDolomiteMargin(_dolomiteMargin);
    }

    function uniswapSetFeeTo(
        address feeTo
    )
    external
    onlyOwner {
        uniswapFactory.setFeeTo(feeTo);
    }

    function uniswapSetFeeToSetter(
        address feeToSetter
    )
    external
    onlyOwner {
        uniswapFactory.setFeeToSetter(feeToSetter);
    }

    function withdrawAllFeesByTokens(
        address recipient,
        address[] calldata tokens
    )
    external
    onlyOwner {
        for (uint i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint amount = IERC20(token).balanceOf(address(this));
            IERC20(token).safeTransfer(recipient, amount);
        }
    }

    function unwrapAllFeesByLpTokens(
        address recipient,
        address[] calldata lpTokens
    )
    external
    onlyOwner {
        for (uint i = 0; i < lpTokens.length; i++) {
            IDolomiteAmmPair lpToken = IDolomiteAmmPair(lpTokens[i]);
            lpToken.transfer(address(lpToken), lpToken.balanceOf(address(this)));
            lpToken.burn(address(this), 0);

            address token0 = lpToken.token0();
            address token1 = lpToken.token1();

            uint marketId0 = dolomiteMargin.getMarketIdByTokenAddress(token0);
            uint marketId1 = dolomiteMargin.getMarketIdByTokenAddress(token1);

            Account.Info[] memory accounts = new Account.Info[](1);
            accounts[0] = Account.Info(address(this), 0);

            Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](2);
            actions[0] = _encodeWithdrawAllToThisContract(marketId0);
            actions[1] = _encodeWithdrawAllToThisContract(marketId1);

            dolomiteMargin.operate(accounts, actions);

            IERC20(token0).safeTransfer(recipient, IERC20(token0).balanceOf(address(this)));
            IERC20(token1).safeTransfer(recipient, IERC20(token1).balanceOf(address(this)));
        }
    }

    function _encodeWithdrawAllToThisContract(
        uint marketId
    ) internal view returns (Actions.ActionArgs memory) {
        return Actions.ActionArgs({
            actionType : Actions.ActionType.Withdraw,
            accountId : 0,
            /* solium-disable-next-line arg-overflow */
            amount : Types.AssetAmount(true, Types.AssetDenomination.Wei, Types.AssetReference.Target, 0),
            primaryMarketId : marketId,
            secondaryMarketId : uint(- 1),
            otherAddress : address(this),
            otherAccountId : uint(- 1),
            data : bytes("")
        });
    }

}
