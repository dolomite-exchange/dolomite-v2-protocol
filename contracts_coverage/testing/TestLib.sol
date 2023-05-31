/*

    Copyright 2019 dYdX Trading Inc.

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

import { AccountMarginLib } from "../external/lib/AccountMarginLib.sol";
import { AdvancedMath } from "../external/lib/AdvancedMath.sol";
import { TypedSignature } from "../external/lib/TypedSignature.sol";

import { IERC20Detailed } from "../protocol/interfaces/IERC20Detailed.sol";

import { Account } from "../protocol/lib/Account.sol";
import { Cache } from "../protocol/lib/Cache.sol";
import { DolomiteMarginMath } from "../protocol/lib/DolomiteMarginMath.sol";
import { EnumerableSet } from "../protocol/lib/EnumerableSet.sol";
import { Require } from "../protocol/lib/Require.sol";
import { Time } from "../protocol/lib/Time.sol";
import { Token } from "../protocol/lib/Token.sol";
import { Types } from "../protocol/lib/Types.sol";


/**
 * @title TestLib
 * @author dYdX
 *
 * Contract for testing pure library functions
 */
contract TestLib {
    using EnumerableSet for EnumerableSet.Set;
    using Cache for Cache.MarketCache;

    // ============ Constants ============

    bytes32 private constant FILE = "TestLib";

    // ============ Field Values ============

    EnumerableSet.Set internal enumerableSet;

    // ============ Account Margin Helper Functions ============

    function AccountMarginHelperIsMarginAccountWithIndex(uint256 _accountIndex) external pure returns (bool) {
        return AccountMarginLib.isMarginAccount(_accountIndex);
    }

    function AccountMarginHelperIsMarginAccountWithStruct(Account.Info memory _account) public pure returns (bool) {
        return AccountMarginLib.isMarginAccount(_account);
    }

    // ============ Market Cache ============

    function MarketCacheGetBeforeInitialized() external pure {
        Cache.MarketCache memory cache;
        uint marketId1 = 1;
        cache.get(marketId1); // fails here
    }

    function MarketCacheGetAtIndexOOB() external pure {
        Cache.MarketCache memory cache;
        cache.getAtIndex(123); // fails here
    }

    function MarketCacheSetAfterAlreadyInitialized() external pure {
        Cache.MarketCache memory cache = Cache.create(1);
        uint marketId1 = 1;
        uint marketId2 = 2;
        cache.set(marketId1);

        cache.markets = new Cache.MarketInfo[](1); // initialize the cache here
        cache.set(marketId2); // fails here
    }

    // ============ Enumerable Set Functions ============

    function EnumerableSetAdd(
        uint256 value
    )
        external
    returns (bool)
    {
        return enumerableSet.add(value);
    }

    function EnumerableSetRemove(
        uint256 value
    )
        external
    returns (bool)
    {
        return enumerableSet.remove(value);
    }

    function EnumerableSetContains(
        uint256 value
    )
        external
        view
        returns (bool)
    {
        return enumerableSet.contains(value);
    }

    function EnumerableSetLength()
        external
        view
        returns (uint256)
    {
        return enumerableSet.length();
    }

    // ============ TypedSignature Functions ============

    function TypedSignatureRecover(
        bytes32 hash,
        bytes calldata signatureWithType
    )
        external
        pure
        returns (address)
    {
        return TypedSignature.recover(hash, signatureWithType);
    }

    // ============ Math Functions ============

    function MathSqrt(
        uint256 value
    )
        external
        pure
        returns (uint256)
    {
        return AdvancedMath.sqrt(value);
    }

    function MathGetPartial(
        uint256 target,
        uint256 numerator,
        uint256 denominator
    )
        external
        pure
        returns (uint256)
    {
        return DolomiteMarginMath.getPartial(target, numerator, denominator);
    }

    function MathGetPartialRoundHalfUp(
        uint256 target,
        uint256 numerator,
        uint256 denominator
    )
        external
        pure
        returns (uint256)
    {
        return DolomiteMarginMath.getPartialRoundHalfUp(target, numerator, denominator);
    }

    function MathGetPartialRoundUp(
        uint256 target,
        uint256 numerator,
        uint256 denominator
    )
        external
        pure
        returns (uint256)
    {
        return DolomiteMarginMath.getPartialRoundUp(target, numerator, denominator);
    }

    function MathTo128(
        uint256 x
    )
        external
        pure
        returns (uint128)
    {
        return DolomiteMarginMath.to128(x);
    }

    function MathTo96(
        uint256 x
    )
        external
        pure
        returns (uint96)
    {
        return DolomiteMarginMath.to96(x);
    }

    function MathTo32(
        uint256 x
    )
        external
        pure
        returns (uint32)
    {
        return DolomiteMarginMath.to32(x);
    }

    // ============ Require Functions ============

    function RequireThat0(
        bytes32 reason
    )
        external
        pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(false,
            FILE,
            reason
        );
    }

    function RequireThat1(
        bytes32 reason,
        uint256 payloadA
    )
        external
        pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(false,
            FILE,
            reason,
            payloadA
        );
    }

    function RequireThat2(
        bytes32 reason,
        uint256 payloadA,
        uint256 payloadB
    )
        external
        pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(false,
            FILE,
            reason,
            payloadA,
            payloadB
        );
    }

    function RequireThatA0(
        bytes32 reason,
        address payloadA
    )
        external
        pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(false,
            FILE,
            reason,
            payloadA
        );
    }

    function RequireThatA1(
        bytes32 reason,
        address payloadA,
        uint256 payloadB
    )
        external
        pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(false,
            FILE,
            reason,
            payloadA,
            payloadB
        );
    }

    function RequireThatA2(
        bytes32 reason,
        address payloadA,
        uint256 payloadB,
        uint256 payloadC
    )
        external
        pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(false,
            FILE,
            reason,
            payloadA,
            payloadB,
            payloadC
        );
    }

    function RequireThatB0(
        bytes32 reason,
        bytes32 payloadA
    )
        external
        pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(false,
            FILE,
            reason,
            payloadA
        );
    }

    function RequireThatB2(
        bytes32 reason,
        bytes32 payloadA,
        uint256 payloadB,
        uint256 payloadC
    )
        external
        pure
    {
        if (false) { /* FOR COVERAGE TESTING */ }
        Require.that(false,
            FILE,
            reason,
            payloadA,
            payloadB,
            payloadC
        );
    }

    function RequireNotThatB2(
        bytes32 reason,
        bytes32 payloadA,
        uint256 payloadB,
        uint256 payloadC
    )
        external
        pure
    {
        if (true) { /* FOR COVERAGE TESTING */ }
        Require.that(true,
            FILE,
            reason,
            payloadA,
            payloadB,
            payloadC
        );
    }

    // ============ Time Functions ============

    function TimeCurrentTime()
        external
        view
        returns (uint32)
    {
        return Time.currentTime();
    }

    // ============ Token Functions ============

    function TokenBalanceOf(
        address token,
        address owner
    )
        external
        view
        returns (uint256)
    {
        return IERC20Detailed(token).balanceOf(owner);
    }

    function TokenTransfer(
        address token,
        address to,
        uint256 amount
    )
        external
    {
        Token.transfer(token, to, amount);
    }

    function TokenTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    )
        external
    {
        Token.transferFrom(
            token,
            from,
            to,
            amount
        );
    }

    // ============ Types Functions ============

    function TypesZeroPar()
        external
        pure
        returns (Types.Par memory)
    {
        return Types.zeroPar();
    }

    function TypesParSub(
        Types.Par memory a,
        Types.Par memory b
    )
        public
        pure
        returns (Types.Par memory)
    {
        return Types.sub(a, b);
    }

    function TypesParAdd(
        Types.Par memory a,
        Types.Par memory b
    )
        public
        pure
        returns (Types.Par memory)
    {
        return Types.add(a, b);
    }

    function TypesParEquals(
        Types.Par memory a,
        Types.Par memory b
    )
        public
        pure
        returns (bool)
    {
        return Types.equals(a, b);
    }

    function TypesParNegative(
        Types.Par memory a
    )
        public
        pure
        returns (Types.Par memory)
    {
        return Types.negative(a);
    }

    function TypesParIsNegative(
        Types.Par memory a
    )
        public
        pure
        returns (bool)
    {
        return Types.isNegative(a);
    }

    function TypesParIsPositive(
        Types.Par memory a
    )
        public
        pure
        returns (bool)
    {
        return Types.isPositive(a);
    }

    function TypesParIsZero(
        Types.Par memory a
    )
        public
        pure
        returns (bool)
    {
        return Types.isZero(a);
    }

    function TypesZeroWei()
        external
        pure
        returns (Types.Wei memory)
    {
        return Types.zeroWei();
    }

    function TypesWeiSub(
        Types.Wei memory a,
        Types.Wei memory b
    )
        public
        pure
        returns (Types.Wei memory)
    {
        return Types.sub(a, b);
    }

    function TypesWeiAdd(
        Types.Wei memory a,
        Types.Wei memory b
    )
        public
        pure
        returns (Types.Wei memory)
    {
        return Types.add(a, b);
    }

    function TypesWeiEquals(
        Types.Wei memory a,
        Types.Wei memory b
    )
        public
        pure
        returns (bool)
    {
        return Types.equals(a, b);
    }

    function TypesWeiNegative(
        Types.Wei memory a
    )
        public
        pure
        returns (Types.Wei memory)
    {
        return Types.negative(a);
    }

    function TypesWeiIsNegative(
        Types.Wei memory a
    )
        public
        pure
        returns (bool)
    {
        return Types.isNegative(a);
    }

    function TypesWeiIsPositive(
        Types.Wei memory a
    )
        public
        pure
        returns (bool)
    {
        return Types.isPositive(a);
    }

    function TypesWeiIsZero(
        Types.Wei memory a
    )
        public
        pure
        returns (bool)
    {
        return Types.isZero(a);
    }
}
