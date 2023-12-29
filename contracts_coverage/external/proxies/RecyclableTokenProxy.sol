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

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Types } from "../../protocol/lib/Types.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";
import { IERC20Detailed } from "../../protocol/interfaces/IERC20Detailed.sol";
import { IRecyclable } from "../../protocol/interfaces/IRecyclable.sol";

import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";
import { IExpiry } from "../interfaces/IExpiry.sol";
import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";


/**
 * @title RecyclableTokenProxy
 * @author Dolomite
 *
 * Contract for wrapping around tokens to control how they are deposited into DolomiteMargin, to be combined with "market
 * recycling" so "throwaway tokens" like options contracts that are represented as tokens can be used with the protocol
 * and their market IDs can be safely reclaimed.
 *
 * This contract works by serving as a proxy account for a user. Meaning, a user deposits funds into DolomiteMargin using this
 * contract's address as the `owner` and the user's address (converted to a uint) as the `number`. As a consequence and
 * tradeoff, users can only have one margin position open per instance of this contract (per option token).
 *
 * The reason why this contract works well with a recycling strategy is because all usages of the instance's
 * `marketId` are confined to this address as the `owner`. So, if the `marketId` is reused, it doesn't impact the user's
 * balance, since a new instance of `RecyclableTokenProxy` will be deployed for the recycled marketId. Then, the new
 * instance of `RecyclableTokenProxy` would serve as the new address for the user to interact with DolomiteMargin, masking/hiding
 * the user's old (potentially) non-zero balance for that `marketId`. As a visualization, balances are mapped like so:
 *
 * `owner` --> `accountNumber` --> `marketId`
 *
 * `owner` corresponds with `address(this)`, `accountNumber` is the user's address, and `marketId` is recycled.
 *
 * Since `owner` constantly chances, the value of the mapping is able to reset, each time DolomiteMargin recycles a market.
 *
 * NOTE: Contracts that reference this token and implement IExchangeWrapper must set an allowance for this contract to
 * spend `TOKEN` on the IExchangeWrapper implementor (TOKEN.approve(RecyclableTokenProxy, uint(-1)); call from
 * IExchangeWrapper).
 *
 * Another note on balances: Part of the idea behind the implementation is to restrict usage of the recyclable token to
 * only be held in `address(this)` owner address / Account.Info. The only time this marketId may reside in an `owner`
 * that is NOT this contract is after a liquidation. This should not matter though, since the liquidator will withdraw
 * the token to sell all of it for the owed collateral. So, after the liquidation transaction is over, the liquidator
 * should have a zero balance anyway. Keeping the this token in the liquidators DolomiteMargin account, would cause catastrophic
 * issues for the protocol when the `marketId` is recycled, since the liquidator's balance would be dirty upon reuse of
 * the `marketId`. To mitigate this issue, a special liquidation contract should be created that purposely performs a
 * withdrawal (down to zero) of this recyclable token's underlying `TOKEN`. Even if an implementing liquidation contract
 * messes this up, there is a check done in `OperationImpl._verifyFinalState` that prevents this from happening.
 */
contract RecyclableTokenProxy is IERC20Detailed, IRecyclable, OnlyDolomiteMargin, ReentrancyGuard {
    using SafeERC20 for IERC20Detailed;

    // ============ Constants ============

    bytes32 private constant FILE = "RecyclableTokenProxy";

    // ============ Public Variables ============

    IERC20Detailed public TOKEN;
    IExpiry public EXPIRY;
    uint256 public MARKET_ID;
    bool public isRecycled;
    mapping(address => mapping (uint256 => bool)) public userToAccountNumberHasWithdrawnAfterRecycle;

    // ============ Constructor ============

    constructor (
        address _dolomiteMargin,
        address _token,
        address _expiry,
        uint256 _maxExpirationTimestamp
    )
    public
    OnlyDolomiteMargin(_dolomiteMargin)
    {
        TOKEN = IERC20Detailed(_token);
        EXPIRY = IExpiry(_expiry);
        MAX_EXPIRATION_TIMESTAMP = _maxExpirationTimestamp;
        isRecycled = false;
    }

    // ============ Public Functions ============

    function initialize() external onlyDolomiteMargin(msg.sender) {
        if (MARKET_ID == 0) { /* FOR COVERAGE TESTING */ }
        Require.that(MARKET_ID == 0,
            FILE,
            "already initialized"
        );

        MARKET_ID = DOLOMITE_MARGIN.getMarketIdByTokenAddress(address(this));

        if (DOLOMITE_MARGIN.getMarketIsClosing(MARKET_ID)) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN.getMarketIsClosing(MARKET_ID),
            FILE,
            "market cannot allow borrowing"
        );
        // This statement is in this function because of an "InternalCompileError" error that occurs in the constructor
        if (MAX_EXPIRATION_TIMESTAMP >= block.timestamp) { /* FOR COVERAGE TESTING */ }
        Require.that(MAX_EXPIRATION_TIMESTAMP >= block.timestamp,
            FILE,
            "invalid expiration timestamp",
            MAX_EXPIRATION_TIMESTAMP
        );
    }

    function recycle() public onlyDolomiteMargin(msg.sender) {
        // check the head because all newly-recycled markets are prepended to the head of the linked list.
        if (DOLOMITE_MARGIN.getRecyclableMarkets(1)[0] == MARKET_ID && !isRecycled) { /* FOR COVERAGE TESTING */ }
        Require.that(DOLOMITE_MARGIN.getRecyclableMarkets(1)[0] == MARKET_ID && !isRecycled,
            FILE,
            "already recycled"
        );

        isRecycled = true;
    }

    function getAccountNumber(
        Account.Info memory _account
    ) public pure returns (uint256) {
        return _getAccountNumber(_account.owner, _account.number);
    }

    function getAccountPar(
        Account.Info memory _account
    ) public view returns (Types.Par memory) {
        if (userToAccountNumberHasWithdrawnAfterRecycle[_account.owner][_account.number]) {
            return Types.zeroPar();
        } else {
            return DOLOMITE_MARGIN.getAccountParNoMarketCheck(
                Account.Info(address(this), getAccountNumber(_account)),
                MARKET_ID
            );
        }
    }

    function depositIntoDolomiteMargin(uint256 _accountNumber, uint256 _amount) public nonReentrant {
        if (!isRecycled) { /* FOR COVERAGE TESTING */ }
        Require.that(!isRecycled,
            FILE,
            "cannot deposit when recycled"
        );
        if (!isExpired()) { /* FOR COVERAGE TESTING */ }
        Require.that(!isExpired(),
            FILE,
            "market is expired",
            MAX_EXPIRATION_TIMESTAMP
        );

        TOKEN.safeTransferFrom(msg.sender, address(this), _amount);

        AccountActionLib.deposit(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ address(this), // solium-disable-line indentation
            /* _fromOwner = */ address(this), // solium-disable-line indentation
            _getAccountNumber(msg.sender, _accountNumber),
            MARKET_ID,
            Types.AssetAmount({
                sign : true,
                denomination : Types.AssetDenomination.Wei,
                ref : Types.AssetReference.Delta,
                value : _amount
            })
        );
    }

    function withdrawFromDolomiteMargin(
        uint256 _accountNumber,
        uint256 _amount
    ) public nonReentrant {
        if (!isRecycled) { /* FOR COVERAGE TESTING */ }
        Require.that(!isRecycled,
            FILE,
            "cannot withdraw when recycled"
        );

        AccountActionLib.withdraw(
            DOLOMITE_MARGIN,
            /* _accountOwner = */ address(this), // solium-disable-line indentation
            _getAccountNumber(msg.sender, _accountNumber),
            /* _toAccount = */ msg.sender, // solium-disable-line indentation
            MARKET_ID,
            Types.AssetAmount({
                sign : false,
                denomination : Types.AssetDenomination.Wei,
                ref : Types.AssetReference.Delta,
                value : _amount
            }),
            AccountBalanceLib.BalanceCheckFlag.Both
        );
    }

    function withdrawAfterRecycle(uint256 _accountNumber) public nonReentrant {
        if (isRecycled) { /* FOR COVERAGE TESTING */ }
        Require.that(isRecycled,
            FILE,
            "not recycled yet"
        );
        if (!userToAccountNumberHasWithdrawnAfterRecycle[msg.sender][_accountNumber]) { /* FOR COVERAGE TESTING */ }
        Require.that(!userToAccountNumberHasWithdrawnAfterRecycle[msg.sender][_accountNumber],
            FILE,
            "user already withdrew"
        );
        userToAccountNumberHasWithdrawnAfterRecycle[msg.sender][_accountNumber] = true;
        TOKEN.safeTransfer(
            msg.sender,
            DOLOMITE_MARGIN.getAccountParNoMarketCheck(
                Account.Info(address(this), _getAccountNumber(msg.sender, _accountNumber)),
                MARKET_ID
            ).value
        );
    }

    function trade(
        uint256 _accountNumber,
        Types.AssetAmount memory _supplyAmount, // equivalent to amounts[amounts.length - 1]
        address _borrowToken,
        Types.AssetAmount memory _borrowAmount,
        address _exchangeWrapper,
        uint256 _expiryTimeDelta,
        bool _isOpen,
        bytes memory _tradeData
    ) public {
        if (!isRecycled) { /* FOR COVERAGE TESTING */ }
        Require.that(!isRecycled,
            FILE,
            "cannot trade when recycled"
        );
        if (!isExpired()) { /* FOR COVERAGE TESTING */ }
        Require.that(!isExpired(),
            FILE,
            "market is expired",
            MAX_EXPIRATION_TIMESTAMP
        );
        if (uint32(_expiryTimeDelta) == _expiryTimeDelta) { /* FOR COVERAGE TESTING */ }
        Require.that(uint32(_expiryTimeDelta) == _expiryTimeDelta,
            FILE,
            "expiration time delta invalid",
            _expiryTimeDelta
        );

        uint256 marketId = MARKET_ID;
        uint256 borrowMarketId = DOLOMITE_MARGIN.getMarketIdByTokenAddress(_borrowToken);

        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info(address(this), _getAccountNumber(msg.sender, _accountNumber));

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](2);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Sell,
            accountId: 0,
            amount: _isOpen ? _borrowAmount : _supplyAmount,
            primaryMarketId: _isOpen ? borrowMarketId : marketId,
            secondaryMarketId: _isOpen ? marketId : borrowMarketId,
            otherAddress: _exchangeWrapper,
            otherAccountId: 0,
            data: _tradeData
        });

        actions[1] = AccountActionLib.encodeExpirationAction(
            accounts[0],
            /* _accountId = */ 0, // solium-disable-line indentation
            borrowMarketId,
            address(EXPIRY),
            _isOpen ? _expiryTimeDelta : 0
        );

        DOLOMITE_MARGIN.operate(accounts, actions);
    }

    // ============ ERC20 Functions ============

    function name() public view returns (string memory) {
        (bool isSuccess, bytes memory data) = address(TOKEN).staticcall(abi.encodePacked(TOKEN.name.selector));
        if (isSuccess && data.length > 0) {
            return string(abi.encodePacked("Recyclable: ", abi.decode(data, (string))));
        } else {
            return "Recyclable: Dolomite Token";
        }
    }

    function symbol() public view returns (string memory) {
        (bool isSuccess, bytes memory data) = address(TOKEN).staticcall(abi.encodePacked(TOKEN.symbol.selector));
        if (isSuccess && data.length > 0) {
            return string(abi.encodePacked("r", abi.decode(data, (string))));
        } else {
            return "rDOLO_TOKEN";
        }
    }

    function decimals() public view returns (uint8) {
        (bool isSuccess, bytes memory data) = address(TOKEN).staticcall(abi.encodePacked(TOKEN.decimals.selector));
        if (isSuccess && data.length > 0) {
            return abi.decode(data, (uint8));
        } else {
            return 18;
        }
    }

    function totalSupply() public view returns (uint256) {
        return TOKEN.totalSupply();
    }

    function balanceOf(address _account) public view returns (uint256) {
        if (_account == address(DOLOMITE_MARGIN)) {
            // The effective balance of DolomiteMargin is the balance held of the underlying token in this contract
            return TOKEN.balanceOf(address(this));
        }

        uint256 accountNumber = 0;
        if (userToAccountNumberHasWithdrawnAfterRecycle[_account][accountNumber]) {
            return 0;
        } else {
            return getAccountPar(Account.Info(_account, accountNumber)).value;
        }
    }

    function transfer(address _recipient, uint256 _amount) public onlyDolomiteMargin(msg.sender) returns (bool) {
        // This condition fails when the market is recycled but DolomiteMargin attempts to call this contract still
        if (!isRecycled) { /* FOR COVERAGE TESTING */ }
        Require.that(!isRecycled,
            FILE,
            "cannot transfer while recycled"
        );

        TOKEN.safeTransfer(_recipient, _amount);
        emit Transfer(msg.sender, _recipient, _amount);
        return true;
    }

    function allowance(address, address) public view returns (uint256) {
        return 0;
    }

    function approve(address, uint256) public returns (bool) {
        return false;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _amount
    )
    public
    onlyDolomiteMargin(msg.sender)
    returns (bool) {
        // transferFrom should always send tokens to DOLOMITE_MARGIN && msg.sender eq DOLOMITE_MARGIN
        if (_to == address(msg.sender)) { /* FOR COVERAGE TESTING */ }
        Require.that(_to == address(msg.sender),
            FILE,
            "invalid recipient"
        );
        if (!isRecycled) { /* FOR COVERAGE TESTING */ }
        Require.that(!isRecycled,
            FILE,
            "cannot transfer while recycled"
        );

        if (_from == address(this)) {
            // token is being transferred from here to DolomiteMargin, for a deposit. The market's total par was already
            // updated before the call to `transferFrom`. Make sure enough was transferred in.
            // This implementation allows the user to "steal" funds from users that blindly send TOKEN into this
            // contract, without calling properly calling the `deposit` function to set their balances.

            emit Transfer(address(this), _to, _amount);
        } else {
            // TOKEN is being traded via IExchangeWrapper, transfer the tokens into this contract
            TOKEN.safeTransferFrom(_from, address(this), _amount);

            // The market's total par was already updated before the call to `transferFrom`. Make sure enough was
            // transferred in. This implementation allows the user to "steal" funds from users that blindly send TOKEN
            // into this contract, without calling properly calling the `deposit` function to set their balances.

            // this transfer event is technically incorrect since the tokens are really sent from address(this) to
            // recipient, not `sender`. However, we'll let it go.
            emit Transfer(_from, _to, _amount);
        }

        uint256 balance = TOKEN.balanceOf(address(this));
        if (balance >= _amount && balance >= DOLOMITE_MARGIN.getMarketTotalPar(MARKET_ID).supply) { /* FOR COVERAGE TESTING */ }
        Require.that(balance >= _amount && balance >= DOLOMITE_MARGIN.getMarketTotalPar(MARKET_ID).supply,
            FILE,
            "insufficient balance for deposit"
        );

        return true;
    }

    // ============ Private Functions ============

    function _getAccountNumber(address _owner, uint256 _number) private pure returns (uint256) {
        return uint(keccak256(abi.encode(_owner, _number)));
    }
}
