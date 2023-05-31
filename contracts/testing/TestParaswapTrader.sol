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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IDolomiteMargin } from "../protocol/interfaces/IDolomiteMargin.sol";
import { IExchangeWrapper } from "../protocol/interfaces/IExchangeWrapper.sol";

import { Require } from "../protocol/lib/Require.sol";

import { OnlyDolomiteMargin } from "../external/helpers/OnlyDolomiteMargin.sol";

import { ERC20Lib } from "../external/lib/ERC20Lib.sol";


contract TestParaswapTrader is IExchangeWrapper, OnlyDolomiteMargin {

    bytes32 private constant FILE = "TestParaswapTrader";

    // ============ Storage ============

    address public PARASWAP_AUGUSTUS_ROUTER;
    address public PARASWAP_TRANSFER_PROXY;

    // ============ Constructor ============

    constructor(
        address _paraswapAugustusRouter,
        address _paraswapTransferProxy,
        address _dolomiteMargin
    )
    public
    OnlyDolomiteMargin(_dolomiteMargin)
    {
        PARASWAP_AUGUSTUS_ROUTER = _paraswapAugustusRouter;
        PARASWAP_TRANSFER_PROXY = _paraswapTransferProxy;
    }

    // ============ Public Functions ============

    function exchange(
        address,
        address _receiver,
        address _makerToken,
        address _takerToken,
        uint256 _requestedFillAmount,
        bytes calldata _orderData
    )
    external
    onlyDolomiteMargin(msg.sender)
    returns (uint256) {
        ERC20Lib.checkAllowanceAndApprove(_takerToken, PARASWAP_TRANSFER_PROXY, _requestedFillAmount);

        (uint256 minAmountOutWei, bytes memory paraswapCallData) = abi.decode(_orderData, (uint256, bytes));

        _callAndCheckSuccess(paraswapCallData);

        uint256 amount = IERC20(_makerToken).balanceOf(address(this));

        Require.that(
            amount >= minAmountOutWei,
            FILE,
            "insufficient output amount",
            amount,
            minAmountOutWei
        );

        ERC20Lib.checkAllowanceAndApprove(_makerToken, _receiver, amount);

        return amount;
    }

    function getExchangeCost(
        address,
        address,
        uint256,
        bytes calldata
    )
    external
    view
    returns (uint256) {
        revert(string(abi.encodePacked(Require.stringifyTruncated(FILE), "::getExchangeCost: not implemented")));
    }

    // ============ Private Functions ============

    function _callAndCheckSuccess(bytes memory _paraswapCallData) internal {
        // solium-disable-next-line security/no-low-level-calls
        (bool success, bytes memory result) = PARASWAP_AUGUSTUS_ROUTER.call(_paraswapCallData);
        if (!success) {
            if (result.length < 68) {
                revert(string(abi.encodePacked(Require.stringifyTruncated(FILE), ": revert")));
            } else {
                // solium-disable-next-line security/no-inline-assembly
                assembly {
                    result := add(result, 0x04)
                }
                revert(string(abi.encodePacked(Require.stringifyTruncated(FILE), ": ", abi.decode(result, (string)))));
            }
        }
    }
}
