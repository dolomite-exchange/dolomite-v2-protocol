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
pragma experimental ABIEncoderV2;

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Events } from "../../protocol/lib/Events.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";

import { IDolomiteAmmFactory } from "../interfaces/IDolomiteAmmFactory.sol";
import { IDolomiteAmmPair } from "../interfaces/IDolomiteAmmPair.sol";


interface IDolomiteAmmRouterProxy {

    // ============ Events ============

    event MarginPositionOpen(
        address indexed account,
        uint256 indexed accountNumber,
        address inputToken,
        address outputToken,
        address depositToken,
        Events.BalanceUpdate inputBalanceUpdate, // the amount of borrow amount being sold to purchase collateral
        Events.BalanceUpdate outputBalanceUpdate, // the amount of collateral purchased by the borrowed amount
        Events.BalanceUpdate marginDepositUpdate
    );

    event MarginPositionClose(
        address indexed account,
        uint256 indexed accountNumber,
        address inputToken,
        address outputToken,
        address withdrawalToken,
        Events.BalanceUpdate inputBalanceUpdate, // the amount of held amount being sold to repay debt
        Events.BalanceUpdate outputBalanceUpdate, // the amount of borrow amount being repaid
        Events.BalanceUpdate marginWithdrawalUpdate
    );

    // ============ Structs ============

    struct ModifyPositionParams {
        /// the account number that's executing the trade
        uint256 tradeAccountNumber;
        /// used for transferring in/out of the position
        uint256 otherAccountNumber;
        Types.AssetAmount amountIn;
        Types.AssetAmount amountOut;
        address[] tokenPath;
        /// the token to be deposited/withdrawn to/from account number. To not perform any margin deposits or
        /// withdrawals, simply set this to `address(0)`
        address marginTransferToken;
        /// the amount of the margin deposit/withdrawal, in wei. Whether or not this is a deposit or withdrawal depends
        /// on what fromAccountNumber or toAccountNumber are set to. Setting this value to `uint(-1)` will deposit or
        /// withdraw all assets from the source account number
        uint256 marginTransferWei;
        /// true to deposit into `tradeAccountNumber` from `otherAccountNumber` , false to withdraw from it.
        bool isDepositIntoTradeAccount;
        /// the amount of seconds from the time at which the position is opened to expiry. 0 for no expiration
        uint256 expiryTimeDelta;
        /// Setting this to `FROM` will check `tradeAccountNumber`. Setting this to `TO` will check
        /// `otherAccountNumber`. Setting this to `BOTH` will check `tradeAccountNumber` and `otherAccountNumber`.
        AccountBalanceLib.BalanceCheckFlag balanceCheckFlag;
    }

    struct ModifyPositionCache {
        ModifyPositionParams params;
        IDolomiteMargin dolomiteMargin;
        IDolomiteAmmFactory ammFactory;
        address account;
        uint[] marketPath;
        uint[] amountsWei;
        uint256 marginDepositMarketId;
        /// this value is calculated for emitting an event only
        uint256 marginDepositDeltaWei;
    }

    struct AddLiquidityParams {
        uint256 fromAccountNumber;
        address tokenA;
        address tokenB;
        uint256 amountADesiredWei;
        uint256 amountBDesiredWei;
        uint256 amountAMinWei;
        uint256 amountBMinWei;
        uint256 deadline;
        AccountBalanceLib.BalanceCheckFlag balanceCheckFlag;
    }

    struct RemoveLiquidityParams {
        uint256 toAccountNumber;
        address tokenA;
        address tokenB;
        uint256 liquidityWei;
        uint256 amountAMinWei;
        uint256 amountBMinWei;
        uint256 deadline;
    }

    struct PermitSignature {
        bool approveMax;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function getPairInitCodeHash() external view returns (bytes32);

    function addLiquidity(
        AddLiquidityParams calldata _params,
        address _toAccount
    )
    external
    returns (uint256 amountAWei, uint256 amountBWei, uint256 liquidity);

    function addLiquidityAndDepositIntoDolomite(
        AddLiquidityParams calldata _params,
        uint256 _toAccountNumber
    )
    external
    returns (uint256 amountAWei, uint256 amountBWei, uint256 liquidity);

    function getAddLiquidityAmounts(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesiredWei,
        uint256 _amountBDesiredWei,
        uint256 _amountAMinWei,
        uint256 _amountBMinWei
    ) external view returns (uint256 amountAWei, uint256 amountBWei);

    function swapExactTokensForTokens(
        uint256 _accountNumber,
        uint256 _amountInWei,
        uint256 _amountOutMinWei,
        address[] calldata _tokenPath,
        uint256 _deadline,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external;

    function getParamsForSwapExactTokensForTokens(
        address _account,
        uint256 _accountNumber,
        uint256 _amountInWei,
        uint256 _amountOutMinWei,
        address[] calldata _tokenPath
    )
    external view returns (Account.Info[] memory, Actions.ActionArgs[] memory);

    function swapTokensForExactTokens(
        uint256 _accountNumber,
        uint256 _amountInMaxWei,
        uint256 _amountOutWei,
        address[] calldata _tokenPath,
        uint256 _deadline,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external;

    function getParamsForSwapTokensForExactTokens(
        address _account,
        uint256 _accountNumber,
        uint256 _amountInMaxWei,
        uint256 _amountOutWei,
        address[] calldata _tokenPath
    )
    external view returns (Account.Info[] memory, Actions.ActionArgs[] memory);

    function removeLiquidity(
        RemoveLiquidityParams calldata _params,
        address _to
    ) external returns (uint256 amountAWei, uint256 amountBWei);

    function removeLiquidityWithPermit(
        RemoveLiquidityParams calldata _params,
        address _to,
        PermitSignature calldata _permit
    ) external returns (uint256 amountAWei, uint256 amountBWei);

    function removeLiquidityFromWithinDolomite(
        RemoveLiquidityParams calldata _params,
        uint256 _fromAccountNumber,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) external returns (uint256 amountAWei, uint256 amountBWei);

    function swapExactTokensForTokensAndModifyPosition(
        ModifyPositionParams calldata _params,
        uint256 _deadline
    ) external;

    function swapTokensForExactTokensAndModifyPosition(
        ModifyPositionParams calldata _params,
        uint256 _deadline
    ) external;
}
