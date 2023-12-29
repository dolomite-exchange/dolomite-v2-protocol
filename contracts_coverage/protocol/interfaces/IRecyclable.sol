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

import { Account } from "../lib/Account.sol";
import { Types } from "../lib/Types.sol";

import { AccountBalanceLib } from "../../external/lib/AccountBalanceLib.sol";


/**
 * @title IRecyclable
 * @author Dolomite
 *
 * Interface that recyclable tokens/markets must implement
 */
contract IRecyclable {

    // ============ Public State Variables ============

    /**
     * @notice The max timestamp at which tokens represented by this contract should be expired, allowing liquidators
     *          to close margin positions involving this token, so this contract can be recycled.
     */
    uint256 public MAX_EXPIRATION_TIMESTAMP;

    // ============ Public Functions ============

    /**
     * @return  The token around which this recycle contract wraps.
     */
    function TOKEN() external view returns (IERC20);

    /**
     * A callback for the recyclable market that allows it to perform any cleanup logic, preventing its usage with
     * DolomiteMargin once this transaction completes. #isRecycled  should return `true` after this function is called.
     */
    function recycle() external;

    /**
     * Called when the market is initialized in DolomiteMargin
     */
    function initialize() external;

    /**
     * @param _account  The user's account that should be converted to this recyclable's unique account number
     * @return          The account number used to index into the account for this user
     */
    function getAccountNumber(Account.Info calldata _account) external pure returns (uint256);

    /**
     * @param _account  The account whose par balance should be retrieved
     * @return          The account number used to index into the account for this user
     */
    function getAccountPar(Account.Info calldata _account) external view returns (Types.Par memory);

    /**
     * @return  True if this contract is recycled, disallowing further deposits/interactions with DolomiteMargin and
     *          freeing this token's `MARKET_ID`.
     */
    function isRecycled() external view returns (bool);

    /**
     * @dev Deposits the underlying token into this smart contract and adds to the user's balance with DolomiteMargin.
     *      The user must set an allowance for `TOKEN`, using this contract as the `spender`.
     * @param _accountNumber    The account number of `msg.sender`'s user's account
     * @param _amount           The amount of `TOKEN` to deposit
     */
    function depositIntoDolomiteMargin(uint256 _accountNumber, uint256 _amount) external;

    /**
     * @dev Withdraws a specific amount of a user's balance from the smart contract to `msg.sender`
     * @param _accountNumber    The account number of `msg.sender`'s user's account
     * @param _amount           The amount of `TOKEN` to withdraw
     */
    function withdrawFromDolomiteMargin(
        uint256 _accountNumber,
        uint256 _amount
    )
        external;

    /**
     * @dev Withdraws the user's remaining balance from the smart contract, after this contract has been recycled.
     * @param _accountNumber    The account number of `msg.sender`'s user's account
     */
    function withdrawAfterRecycle(uint256 _accountNumber) external;

    /**
     * @dev Performs a trade between a user and the specified `IExchangeWrapper` to open or a close a margin position
     *      involving this market. Specifying `isOpen` will change the taker amount from borrowAmount (if true) to
     *      `supplyAmount` (if false). Keep in mind, this taker amount is passed through as `requestedFillAmount` to
     *      `IExchangeWrapper`.
     */
    function trade(
        uint256 _accountNumber,
        Types.AssetAmount calldata _supplyAmount, // equivalent to amounts[amounts.length - 1]
        address _borrowToken,
        Types.AssetAmount calldata _borrowAmount,
        address _exchangeWrapper,
        uint256 _expiryTimeDelta,
        bool _isOpen,
        bytes calldata _tradeData
    )
        external;

    /**
     * @return  true if this recyclable contract is expired, or false if it's not yet.
     */
    function isExpired() public view returns (bool) {
        return MAX_EXPIRATION_TIMESTAMP < block.timestamp;
    }
}
