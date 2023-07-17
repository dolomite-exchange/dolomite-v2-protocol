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

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IDolomiteMargin } from  "../../protocol/interfaces/IDolomiteMargin.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Events } from "../../protocol/lib/Events.sol";
import { Interest } from "../../protocol/lib/Interest.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";
import { AccountMarginLib } from "../lib/AccountMarginLib.sol";
import { ERC20Lib } from "../lib/ERC20Lib.sol";

import { TypedSignature } from "../lib/TypedSignature.sol";
import { DolomiteAmmLibrary } from "../lib/DolomiteAmmLibrary.sol";

import { IExpiry } from "../interfaces/IExpiry.sol";
import { IDolomiteAmmFactory } from "../interfaces/IDolomiteAmmFactory.sol";
import { IDolomiteAmmPair } from "../interfaces/IDolomiteAmmPair.sol";
import { IDolomiteAmmRouterProxy } from "../interfaces/IDolomiteAmmRouterProxy.sol";


/**
 * @title DolomiteAmmRouterProxy
 * @author Dolomite
 *
 * Contract for routing trades to the Dolomite AMM pools and potentially opening margin positions
 */
contract DolomiteAmmRouterProxy is IDolomiteAmmRouterProxy, ReentrancyGuard {
    using SafeMath for uint;
    using Types for Types.Wei;

    // ==================== Constants ====================

    bytes32 constant internal FILE = "DolomiteAmmRouterProxy";

    // ==================== Modifiers ====================

    modifier ensure(uint256 deadline) {
        if (deadline >= block.timestamp) { /* FOR COVERAGE TESTING */ }
        Require.that(deadline >= block.timestamp,
            FILE,
            "deadline expired",
            deadline,
            block.timestamp
        );
        _;
    }

    // ============ State Variables ============

    IDolomiteMargin public DOLOMITE_MARGIN;
    IDolomiteAmmFactory public DOLOMITE_AMM_FACTORY;
    address public EXPIRY;

    constructor(
        address _dolomiteMargin,
        address _dolomiteAmmFactory,
        address _expiry
    ) public {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
        DOLOMITE_AMM_FACTORY = IDolomiteAmmFactory(_dolomiteAmmFactory);
        EXPIRY = _expiry;
      /*assert(
            DolomiteAmmLibrary.getPairInitCodeHash(_dolomiteAmmFactory) == DOLOMITE_AMM_FACTORY.getPairInitCodeHash()
        );*/
    }

    // ==================== External Functions ====================

    function getPairInitCodeHash() external view returns (bytes32) {
        return DolomiteAmmLibrary.getPairInitCodeHash(address(DOLOMITE_AMM_FACTORY));
    }

    function swapExactTokensForTokens(
        uint256 _accountNumber,
        uint256 _amountInWei,
        uint256 _amountOutMinWei,
        address[] calldata _tokenPath,
        uint256 _deadline,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    ensure(_deadline) {
        _swapExactTokensForTokensAndModifyPosition(
            _initializeModifyPositionCache(
                msg.sender,
                ModifyPositionParams({
                    tradeAccountNumber : _accountNumber,
                    otherAccountNumber : _accountNumber,
                    amountIn : _toPositiveDeltaWeiAssetAmount(_amountInWei),
                    amountOut : _toPositiveDeltaWeiAssetAmount(_amountOutMinWei),
                    tokenPath : _tokenPath,
                    marginTransferToken : address(0),
                    marginTransferWei : 0,
                    isDepositIntoTradeAccount : false,
                    expiryTimeDelta : 0,
                    balanceCheckFlag: _balanceCheckFlag
                })
            )
        );
    }

    function getParamsForSwapExactTokensForTokens(
        address _account,
        uint256 _accountNumber,
        uint256 _amountInWei,
        uint256 _amountOutMinWei,
        address[] calldata _tokenPath
    )
    external view returns (Account.Info[] memory, Actions.ActionArgs[] memory) {
        return _getParamsForSwapExactTokensForTokens(
            _initializeModifyPositionCache(
                _account,
                ModifyPositionParams({
                    tradeAccountNumber : _accountNumber,
                    otherAccountNumber : _accountNumber,
                    amountIn : _toPositiveDeltaWeiAssetAmount(_amountInWei),
                    amountOut : _toPositiveDeltaWeiAssetAmount(_amountOutMinWei),
                    tokenPath : _tokenPath,
                    marginTransferToken : address(0),
                    marginTransferWei : 0,
                    isDepositIntoTradeAccount : false,
                    expiryTimeDelta : 0,
                    balanceCheckFlag : AccountBalanceLib.BalanceCheckFlag.None
                })
            )
        );
    }

    function swapTokensForExactTokens(
        uint256 _accountNumber,
        uint256 _amountInMaxWei,
        uint256 _amountOutWei,
        address[] calldata _tokenPath,
        uint256 _deadline,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    )
    external
    ensure(_deadline) {
        _swapTokensForExactTokensAndModifyPosition(
            _initializeModifyPositionCache(
                msg.sender,
                ModifyPositionParams({
                    tradeAccountNumber : _accountNumber,
                    otherAccountNumber : _accountNumber,
                    amountIn : _toPositiveDeltaWeiAssetAmount(_amountInMaxWei),
                    amountOut : _toPositiveDeltaWeiAssetAmount(_amountOutWei),
                    tokenPath : _tokenPath,
                    marginTransferToken : address(0),
                    marginTransferWei : 0,
                    isDepositIntoTradeAccount : false,
                    expiryTimeDelta : 0,
                    balanceCheckFlag : _balanceCheckFlag
                })
            )
        );
    }

    function getParamsForSwapTokensForExactTokens(
        address _account,
        uint256 _accountNumber,
        uint256 _amountInMaxWei,
        uint256 _amountOutWei,
        address[] calldata _tokenPath
    )
    external view returns (Account.Info[] memory, Actions.ActionArgs[] memory) {
        return _getParamsForSwapTokensForExactTokens(
            _initializeModifyPositionCache(
                _account,
                ModifyPositionParams({
                    tradeAccountNumber : _accountNumber,
                    otherAccountNumber : _accountNumber,
                    amountIn : _toPositiveDeltaWeiAssetAmount(_amountInMaxWei),
                    amountOut : _toPositiveDeltaWeiAssetAmount(_amountOutWei),
                    tokenPath : _tokenPath,
                    marginTransferToken : address(0),
                    marginTransferWei : 0,
                    isDepositIntoTradeAccount : false,
                    expiryTimeDelta : 0,
                    balanceCheckFlag : AccountBalanceLib.BalanceCheckFlag.None
                })
            )
        );
    }

    // ==================== Public Functions ====================

    function addLiquidity(
        AddLiquidityParams memory _params,
        address _toAccount
    )
    public
    ensure(_params.deadline)
    returns (uint256 amountAWei, uint256 amountBWei, uint256 liquidity) {
        IDolomiteAmmFactory dolomiteAmmFactory = DOLOMITE_AMM_FACTORY;
        // create the pair if it doesn't exist yet
        if (dolomiteAmmFactory.getPair(_params.tokenA, _params.tokenB) == address(0)) {
            dolomiteAmmFactory.createPair(_params.tokenA, _params.tokenB);
        }

        (amountAWei, amountBWei) = getAddLiquidityAmounts(
            _params.tokenA,
            _params.tokenB,
            _params.amountADesiredWei,
            _params.amountBDesiredWei,
            _params.amountAMinWei,
            _params.amountBMinWei
        );
        address pair = DolomiteAmmLibrary.pairFor(address(dolomiteAmmFactory), _params.tokenA, _params.tokenB);

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN;
        uint256 marketIdA = dolomiteMargin.getMarketIdByTokenAddress(_params.tokenA);
        uint256 marketIdB = dolomiteMargin.getMarketIdByTokenAddress(_params.tokenB);

        // solium-disable indentation, arg-overflow
        {
            Account.Info[] memory accounts = new Account.Info[](2);
            accounts[0] = Account.Info(msg.sender, _params.fromAccountNumber);
            accounts[1] = Account.Info(pair, 0);

            Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](2);
            actions[0] = AccountActionLib.encodeTransferAction(0, 1, marketIdA, amountAWei);
            actions[1] = AccountActionLib.encodeTransferAction(0, 1, marketIdB, amountBWei);
            dolomiteMargin.operate(accounts, actions);
        }
        // solium-enable indentation, arg-overflow

        liquidity = IDolomiteAmmPair(pair).mint(_toAccount);

        if (
            _params.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both ||
            _params.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            AccountBalanceLib.verifyBalanceIsNonNegative(
                dolomiteMargin,
                msg.sender,
                _params.fromAccountNumber,
                marketIdA
            );
            AccountBalanceLib.verifyBalanceIsNonNegative(
                dolomiteMargin,
                msg.sender,
                _params.fromAccountNumber,
                marketIdB
            );
        }
    }

    function addLiquidityAndDepositIntoDolomite(
        AddLiquidityParams memory _params,
        uint256 _toAccountNumber
    )
    public
    ensure(_params.deadline)
    returns (uint256 amountAWei, uint256 amountBWei, uint256 liquidity) {
        (amountAWei, amountBWei, liquidity) = addLiquidity(
            _params,
            /* _toAccount = */ address(this) // solium-disable-line indentation
        );

        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN;
        address pair = DOLOMITE_AMM_FACTORY.getPair(_params.tokenA, _params.tokenB);
        ERC20Lib.checkAllowanceAndApprove(pair, address(dolomiteMargin), liquidity);

        AccountActionLib.deposit(
            dolomiteMargin,
            /* _accountOwner = */ msg.sender, // solium-disable-line indentation
            /* _fromAccount = */ address(this), // solium-disable-line indentation
            _toAccountNumber,
            dolomiteMargin.getMarketIdByTokenAddress(pair),
            _toPositiveDeltaWeiAssetAmount(liquidity)
        );
    }

    function getAddLiquidityAmounts(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesiredWei,
        uint256 _amountBDesiredWei,
        uint256 _amountAMinWei,
        uint256 _amountBMinWei
    ) public view returns (uint256 amountAWei, uint256 amountBWei) {
        (uint256 reserveAWei, uint256 reserveBWei) = DolomiteAmmLibrary.getReservesWei(
            address(DOLOMITE_AMM_FACTORY),
            _tokenA,
            _tokenB
        );
        if (reserveAWei == 0 && reserveBWei == 0) {
            (amountAWei, amountBWei) = (_amountADesiredWei, _amountBDesiredWei);
        } else {
            uint256 amountBOptimal = DolomiteAmmLibrary.quote(_amountADesiredWei, reserveAWei, reserveBWei);
            if (amountBOptimal <= _amountBDesiredWei) {
                if (amountBOptimal >= _amountBMinWei) { /* FOR COVERAGE TESTING */ }
                Require.that(amountBOptimal >= _amountBMinWei,
                    FILE,
                    "insufficient B amount",
                    amountBOptimal,
                    _amountBMinWei
                );
                (amountAWei, amountBWei) = (_amountADesiredWei, amountBOptimal);
            } else {
                uint256 amountAOptimal = DolomiteAmmLibrary.quote(_amountBDesiredWei, reserveBWei, reserveAWei);
              /*assert(amountAOptimal <= _amountADesiredWei);*/
                if (amountAOptimal >= _amountAMinWei) { /* FOR COVERAGE TESTING */ }
                Require.that(amountAOptimal >= _amountAMinWei,
                    FILE,
                    "insufficient A amount",
                    amountAOptimal,
                    _amountAMinWei
                );
                (amountAWei, amountBWei) = (amountAOptimal, _amountBDesiredWei);
            }
        }
    }

    function removeLiquidity(
        RemoveLiquidityParams memory _params,
        address _to
    ) public ensure(_params.deadline) returns (uint256 amountAWei, uint256 amountBWei) {
        address pair = _getPairFromParams(_params);
        // send liquidity to pair
        IDolomiteAmmPair(pair).transferFrom(msg.sender, pair, _params.liquidityWei);
        (amountAWei, amountBWei) = _removeLiquidity(_params, _to, pair);
    }

    function removeLiquidityWithPermit(
        RemoveLiquidityParams memory _params,
        address _to,
        PermitSignature memory _permit
    ) public returns (uint256 amountAWei, uint256 amountBWei) {
        address pair = _getPairFromParams(_params);
        IDolomiteAmmPair(pair).permit(
            msg.sender,
            address(this),
            _permit.approveMax ? uint(- 1) : _params.liquidityWei,
            _params.deadline,
            _permit.v,
            _permit.r,
            _permit.s
        );

        (amountAWei, amountBWei) = removeLiquidity(_params, _to);
    }

    function removeLiquidityFromWithinDolomite(
        RemoveLiquidityParams memory _params,
        uint256 _fromAccountNumber,
        AccountBalanceLib.BalanceCheckFlag _balanceCheckFlag
    ) public ensure(_params.deadline) returns (uint256 amountAWei, uint256 amountBWei) {
        IDolomiteMargin dolomiteMargin = DOLOMITE_MARGIN;
        address pair = _getPairFromParams(_params);

        // initialized as a variable to prevent "stack too deep"
        Types.AssetAmount memory assetAmount = Types.AssetAmount({
            sign: false,
            denomination: Types.AssetDenomination.Wei,
            ref: _params.liquidityWei == uint(-1) ? Types.AssetReference.Target : Types.AssetReference.Delta,
            value: _params.liquidityWei == uint(-1) ? 0 : _params.liquidityWei
        });
        // send liquidity to pair
        AccountActionLib.withdraw(
            dolomiteMargin,
            msg.sender,
            _fromAccountNumber,
            pair,
            dolomiteMargin.getMarketIdByTokenAddress(pair),
            assetAmount,
            _balanceCheckFlag
        );

        (amountAWei, amountBWei) = _removeLiquidity(_params, msg.sender, pair);
    }

    function swapExactTokensForTokensAndModifyPosition(
        ModifyPositionParams memory _params,
        uint256 _deadline
    ) public ensure(_deadline) {
        _swapExactTokensForTokensAndModifyPosition(_initializeModifyPositionCache(msg.sender, _params));
    }

    function swapTokensForExactTokensAndModifyPosition(
        ModifyPositionParams memory _params,
        uint256 _deadline
    ) public ensure(_deadline) {
        _swapTokensForExactTokensAndModifyPosition(_initializeModifyPositionCache(msg.sender, _params));
    }

    // *************************
    // ***** Internal Functions
    // *************************

    function _initializeModifyPositionCache(
        address _account,
        ModifyPositionParams memory _params
    ) internal view returns (ModifyPositionCache memory) {
        return ModifyPositionCache({
            params : _params,
            dolomiteMargin : DOLOMITE_MARGIN,
            ammFactory : DOLOMITE_AMM_FACTORY,
            account : _account,
            marketPath : new uint[](0),
            amountsWei : new uint[](0),
            marginDepositMarketId : uint(-1),
            marginDepositDeltaWei : 0
        });
    }

    function _getPairFromParams(RemoveLiquidityParams memory _params) internal view returns (address) {
        return DolomiteAmmLibrary.pairFor(address(DOLOMITE_AMM_FACTORY), _params.tokenA, _params.tokenB);
    }

    function _removeLiquidity(
        RemoveLiquidityParams memory _params,
        address _to,
        address _pair
    ) internal returns (uint256 amountAWei, uint256 amountBWei) {
        (uint256 amount0Wei, uint256 amount1Wei) = IDolomiteAmmPair(_pair).burn(_to, _params.toAccountNumber);
        (address token0,) = DolomiteAmmLibrary.sortTokens(_params.tokenA, _params.tokenB);
        (amountAWei, amountBWei) = _params.tokenA == token0 ? (amount0Wei, amount1Wei) : (amount1Wei, amount0Wei);
        if (amountAWei >= _params.amountAMinWei) { /* FOR COVERAGE TESTING */ }
        Require.that(amountAWei >= _params.amountAMinWei,
            FILE,
            "insufficient A amount",
            amountAWei,
            _params.amountAMinWei
        );
        if (amountBWei >= _params.amountBMinWei) { /* FOR COVERAGE TESTING */ }
        Require.that(amountBWei >= _params.amountBMinWei,
            FILE,
            "insufficient B amount",
            amountBWei,
            _params.amountBMinWei
        );
    }

    function _swapExactTokensForTokensAndModifyPosition(
        ModifyPositionCache memory _cache
    ) internal {
        (
            Account.Info[] memory accounts,
            Actions.ActionArgs[] memory actions
        ) = _getParamsForSwapExactTokensForTokens(_cache);

        _cache.dolomiteMargin.operate(accounts, actions);

        _verifyAllBalancesForTrade(_cache);

        _logEvents(_cache, accounts);
    }

    function _swapTokensForExactTokensAndModifyPosition(
        ModifyPositionCache memory _cache
    ) internal {
        (
            Account.Info[] memory accounts,
            Actions.ActionArgs[] memory actions
        ) = _getParamsForSwapTokensForExactTokens(_cache);

        _cache.dolomiteMargin.operate(accounts, actions);

        _verifyAllBalancesForTrade(_cache);

        _logEvents(_cache, accounts);
    }

    function _verifyAllBalancesForTrade(
        ModifyPositionCache memory _cache
    ) internal view {
        _verifySingleBalanceForTrade(_cache, _cache.marketPath[0]);
        _verifySingleBalanceForTrade(_cache, _cache.marketPath[_cache.marketPath.length - 1]);
        if (
            _cache.marginDepositMarketId != uint(-1)
            && _cache.marginDepositMarketId != _cache.marketPath[0]
            && _cache.marginDepositMarketId != _cache.marketPath[_cache.marketPath.length - 1]
        ) {
            _verifySingleBalanceForTrade(_cache, _cache.marginDepositMarketId);
        }
    }


    function _verifySingleBalanceForTrade(
        ModifyPositionCache memory _cache,
        uint256 _marketId
    ) internal view {
        if (
            _cache.params.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
            || _cache.params.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.From
        ) {
            AccountBalanceLib.verifyBalanceIsNonNegative(
                DOLOMITE_MARGIN,
                _cache.account,
                _cache.params.tradeAccountNumber,
                _marketId
            );
        }
        if (_cache.params.tradeAccountNumber != _cache.params.otherAccountNumber) {
            if (
                _cache.params.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.Both
                || _cache.params.balanceCheckFlag == AccountBalanceLib.BalanceCheckFlag.To
            ) {
                AccountBalanceLib.verifyBalanceIsNonNegative(
                    DOLOMITE_MARGIN,
                    _cache.account,
                    _cache.params.otherAccountNumber,
                    _marketId
                );
            }
        }
    }

    function _getParamsForSwapExactTokensForTokens(
        ModifyPositionCache memory _cache
    ) internal view returns (
        Account.Info[] memory,
        Actions.ActionArgs[] memory
    ) {
        _cache.marketPath = _getMarketPathFromTokenPath(_cache);

        // Convert from par to wei, if necessary
        uint256 amountInWei = _convertAssetAmountToWei(_cache.params.amountIn, _cache.marketPath[0], _cache);

        // Convert from par to wei, if necessary
        uint256 amountOutMinWei = _convertAssetAmountToWei(
            _cache.params.amountOut,
            _cache.marketPath[_cache.marketPath.length - 1],
            _cache
        );

        // amountsWei[0] == amountInWei
        // amountsWei[amountsWei.length - 1] == amountOutWei
        _cache.amountsWei = DolomiteAmmLibrary.getAmountsOutWei(
            address(_cache.ammFactory),
            amountInWei,
            _cache.params.tokenPath
        );

        if (_cache.amountsWei[_cache.amountsWei.length - 1] >= amountOutMinWei) { /* FOR COVERAGE TESTING */ }
        Require.that(_cache.amountsWei[_cache.amountsWei.length - 1] >= amountOutMinWei,
            FILE,
            "insufficient output amount",
            _cache.amountsWei[_cache.amountsWei.length - 1],
            amountOutMinWei
        );

        return _getParamsForSwap(_cache);
    }

    function _getParamsForSwapTokensForExactTokens(
        ModifyPositionCache memory _cache
    ) internal view returns (
        Account.Info[] memory,
        Actions.ActionArgs[] memory
    ) {
        _cache.marketPath = _getMarketPathFromTokenPath(_cache);

        // Convert from par to wei, if necessary
        uint256 amountInMaxWei = _convertAssetAmountToWei(_cache.params.amountIn, _cache.marketPath[0], _cache);

        // Convert from par to wei, if necessary
        uint256 amountOutWei = _convertAssetAmountToWei(
            _cache.params.amountOut,
            _cache.marketPath[_cache.marketPath.length - 1],
            _cache
        );

        // cache.amountsWei[0] == amountInWei
        // cache.amountsWei[amountsWei.length - 1] == amountOutWei
        _cache.amountsWei = DolomiteAmmLibrary.getAmountsInWei(
            address(_cache.ammFactory),
            amountOutWei,
            _cache.params.tokenPath
        );
        if (_cache.amountsWei[0] <= amountInMaxWei) { /* FOR COVERAGE TESTING */ }
        Require.that(_cache.amountsWei[0] <= amountInMaxWei,
            FILE,
            "excessive input amount",
            _cache.amountsWei[0],
            amountInMaxWei
        );

        return _getParamsForSwap(_cache);
    }

    function _getParamsForSwap(
        ModifyPositionCache memory _cache
    ) internal view returns (
        Account.Info[] memory,
        Actions.ActionArgs[] memory
    ) {
        // pools.length == cache.params.tokenPath.length - 1
        address[] memory pools = DolomiteAmmLibrary.getPools(address(_cache.ammFactory), _cache.params.tokenPath);

        Account.Info[] memory accounts = _getAccountsForModifyPosition(_cache, pools);
        Actions.ActionArgs[] memory actions = _getActionArgsForModifyPosition(_cache, accounts, pools);

        if (_cache.params.marginTransferToken != address(0) && _cache.params.marginTransferWei == uint(- 1)) {
            if (_cache.params.isDepositIntoTradeAccount) {
                // the user is depositing into a margin account from accounts[accounts.length - 1] == otherAccountNumber
                // the marginDeposit is equal to the amount of `marketId` in otherAccountNumber
                _cache.marginDepositDeltaWei = _cache.dolomiteMargin.getAccountWei(
                    accounts[accounts.length - 1],
                    _cache.marginDepositMarketId
                ).value;
            } else {
                // the user is withdrawing from a margin account from accounts[0] == tradeAccountNumber
                Types.Wei memory marginDepositBalanceWei = _cache.dolomiteMargin.getAccountWei(
                    accounts[0],
                    _cache.marginDepositMarketId
                );
                if (_cache.marketPath[0] == _cache.marginDepositMarketId) {
                    // the trade downsizes the potential withdrawal
                    _cache.marginDepositDeltaWei = marginDepositBalanceWei
                        .sub(Types.Wei(true, _cache.amountsWei[0]))
                        .value;
                } else if (_cache.marketPath[_cache.marketPath.length - 1] == _cache.marginDepositMarketId) {
                    // the trade upsizes the withdrawal
                    _cache.marginDepositDeltaWei = marginDepositBalanceWei
                        .add(Types.Wei(true, _cache.amountsWei[_cache.amountsWei.length - 1]))
                        .value;
                } else {
                    // the trade doesn't impact the withdrawal
                    _cache.marginDepositDeltaWei = marginDepositBalanceWei.value;
                }
            }
        } else {
            _cache.marginDepositDeltaWei = _cache.params.marginTransferWei;
        }

        return (accounts, actions);
    }

    function _getMarketPathFromTokenPath(
        ModifyPositionCache memory _cache
    ) internal view returns (uint[] memory) {
        uint[] memory marketPath = new uint[](_cache.params.tokenPath.length);
        for (uint256 i = 0; i < _cache.params.tokenPath.length; i++) {
            marketPath[i] = _cache.dolomiteMargin.getMarketIdByTokenAddress(_cache.params.tokenPath[i]);
        }
        return marketPath;
    }

    function _getAccountsForModifyPosition(
        ModifyPositionCache memory _cache,
        address[] memory _pools
    ) internal pure returns (Account.Info[] memory) {
        Account.Info[] memory accounts;
        if (_cache.params.marginTransferToken == address(0)) {
            accounts = new Account.Info[](1 + _pools.length);
            if (_cache.params.tradeAccountNumber == _cache.params.otherAccountNumber) { /* FOR COVERAGE TESTING */ }
            Require.that(_cache.params.tradeAccountNumber == _cache.params.otherAccountNumber,
                FILE,
                "accounts must eq for swaps"
            );
        } else {
            accounts = new Account.Info[](2 + _pools.length);
            accounts[accounts.length - 1] = Account.Info(_cache.account, _cache.params.otherAccountNumber);
            if (_cache.params.tradeAccountNumber != _cache.params.otherAccountNumber) { /* FOR COVERAGE TESTING */ }
            Require.that(_cache.params.tradeAccountNumber != _cache.params.otherAccountNumber,
                FILE,
                "accounts must not eq for margin"
            );
        }

        accounts[0] = Account.Info(_cache.account, _cache.params.tradeAccountNumber);

        for (uint256 i = 0; i < _pools.length; i++) {
            accounts[i + 1] = Account.Info(_pools[i], 0);
        }

        return accounts;
    }

    function _getActionArgsForModifyPosition(
        ModifyPositionCache memory _cache,
        Account.Info[] memory _accounts,
        address[] memory _pools
    ) internal view returns (Actions.ActionArgs[] memory) {
        Actions.ActionArgs[] memory actions;
        if (_cache.params.marginTransferToken == address(0)) {
            if (_cache.params.marginTransferWei == 0) { /* FOR COVERAGE TESTING */ }
            Require.that(_cache.params.marginTransferWei == 0,
                FILE,
                "margin deposit must eq 0"
            );

            actions = new Actions.ActionArgs[](_pools.length);
        } else {
            if (_cache.params.marginTransferWei != 0) { /* FOR COVERAGE TESTING */ }
            Require.that(_cache.params.marginTransferWei != 0,
                FILE,
                "invalid margin deposit"
            );

            uint256 expiryActionCount = _cache.params.expiryTimeDelta == 0 ? 0 : 1;
            actions = new Actions.ActionArgs[](_pools.length + 1 + expiryActionCount);

            _cache.marginDepositMarketId = _cache.dolomiteMargin.getMarketIdByTokenAddress(_cache.params.marginTransferToken);
            /* solium-disable indentation */
            {
                uint256 fromAccountId;
                uint256 toAccountId;
                if (_cache.params.isDepositIntoTradeAccount) {
                    fromAccountId = _accounts.length - 1; // otherAccountNumber
                    toAccountId = 0; // tradeAccountNumber
                } else {
                    fromAccountId = 0; // tradeAccountNumber
                    toAccountId = _accounts.length - 1; // otherAccountNumber
                }

                actions[actions.length - 1 - expiryActionCount] = AccountActionLib.encodeTransferAction(
                    fromAccountId,
                    toAccountId,
                    _cache.marginDepositMarketId,
                    _cache.params.marginTransferWei
                );
            }
            /* solium-enable indentation */

            if (expiryActionCount == 1) {
                // always use the tradeAccountId, which is at index=0
                actions[actions.length - 1] = AccountActionLib.encodeExpirationAction(
                    _accounts[0],
                    /* _accountId = */ 0, // solium-disable-line indentation
                    /* _owedMarketId = */ _cache.marketPath[0], // solium-disable-line indentation
                    EXPIRY,
                    _cache.params.expiryTimeDelta
                );
            }
        }

        for (uint256 i = 0; i < _pools.length; i++) {
          /*assert(_accounts[i + 1].owner == _pools[i]);*/
            // use _cache.params.tradeAccountId for the trade
            actions[i] = AccountActionLib.encodeInternalTradeAction(
                /* _fromAccountId = */ 0, // solium-disable-line indentation
                /* _toAccountId = */ i + 1, // solium-disable-line indentation
                _cache.marketPath[i],
                _cache.marketPath[i + 1],
                _pools[i],
                _cache.amountsWei[i],
                _cache.amountsWei[i + 1]
            );
        }

        return actions;
    }

    function _toPositiveDeltaWeiAssetAmount(uint256 _value) internal pure returns (Types.AssetAmount memory) {
        return Types.AssetAmount({
            sign : true,
            denomination : Types.AssetDenomination.Wei,
            ref : Types.AssetReference.Delta,
            value : _value
        });
    }

    function _convertAssetAmountToWei(
        Types.AssetAmount memory _amount,
        uint256 _marketId,
        ModifyPositionCache memory _cache
    ) internal view returns (uint256) {
        if (_amount.ref == Types.AssetReference.Delta) { /* FOR COVERAGE TESTING */ }
        Require.that(_amount.ref == Types.AssetReference.Delta,
            FILE,
            "invalid asset reference"
        );
        _amount.value = _amount.value == uint256(-1) ? uint128(-1) : _amount.value;
        if (uint128(_amount.value) == _amount.value) { /* FOR COVERAGE TESTING */ }
        Require.that(uint128(_amount.value) == _amount.value,
            FILE,
            "invalid asset amount"
        );

        if (_amount.denomination == Types.AssetDenomination.Wei) {
            return _amount.value;
        } else {
            return Interest.parToWei(
                Types.Par({sign : _amount.sign, value : uint128(_amount.value)}),
                _cache.dolomiteMargin.getMarketCurrentIndex(_marketId)
            ).value;
        }
    }

    function _logEvents(
        ModifyPositionCache memory _cache,
        Account.Info[] memory _accounts
    ) internal {
        if (_cache.params.marginTransferToken != address(0)) {
            Events.BalanceUpdate memory inputBalanceUpdate = Events.BalanceUpdate({
                deltaWei : Types.Wei(false, _cache.amountsWei[0]),
                newPar : _cache.dolomiteMargin.getAccountPar(_accounts[0], _cache.marketPath[0])
            });
            Events.BalanceUpdate memory outputBalanceUpdate = Events.BalanceUpdate({
                deltaWei : Types.Wei(true, _cache.amountsWei[_cache.amountsWei.length - 1]),
                newPar : _cache.dolomiteMargin.getAccountPar(_accounts[0], _cache.marketPath[_cache.marketPath.length - 1])
            });
            Events.BalanceUpdate memory marginBalanceUpdate = Events.BalanceUpdate({
                deltaWei : Types.Wei(true, _cache.marginDepositDeltaWei),
                newPar : _cache.dolomiteMargin.getAccountPar(_accounts[0], _cache.marginDepositMarketId)
            });

            if (_cache.params.isDepositIntoTradeAccount) {
                emit MarginPositionOpen(
                    msg.sender,
                    _cache.params.tradeAccountNumber,
                    _cache.params.tokenPath[0],
                    _cache.params.tokenPath[_cache.params.tokenPath.length - 1],
                    _cache.params.marginTransferToken,
                    inputBalanceUpdate,
                    outputBalanceUpdate,
                    marginBalanceUpdate
                );
            } else {
                marginBalanceUpdate.deltaWei.sign = false;
                emit MarginPositionClose(
                    msg.sender,
                    _cache.params.tradeAccountNumber,
                    _cache.params.tokenPath[0],
                    _cache.params.tokenPath[_cache.params.tokenPath.length - 1],
                    _cache.params.marginTransferToken,
                    inputBalanceUpdate,
                    outputBalanceUpdate,
                    marginBalanceUpdate
                );
            }
        }
    }
}
