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

import { Require } from "./Require.sol";


/**
 * @title Bits
 * @author Dolomite
 *
 * Library for caching information about markets
 */
library Bits {

    // ============ Constants ============

    uint256 internal constant ONE = 1;
    uint256 internal constant MAX_UINT_BITS = 256;

    // ============ Functions ============

    function createBitmaps(uint256 maxLength) internal pure returns (uint256[] memory) {
        return new uint256[]((maxLength / MAX_UINT_BITS) + ONE);
    }

    function getMarketIdFromBit(
        uint256 index,
        uint256 bit
    ) internal pure returns (uint256) {
        return (MAX_UINT_BITS * index) + bit;
    }

    function setBit(
        uint256[] memory bitmaps,
        uint256 marketId
    ) internal pure {
        uint256 bucketIndex = marketId / MAX_UINT_BITS;
        uint256 indexFromRight = marketId % MAX_UINT_BITS;
        bitmaps[bucketIndex] |= (ONE << indexFromRight);
    }

    function hasBit(
        uint256[] memory bitmaps,
        uint256 marketId
    ) internal pure returns (bool) {
        uint256 bucketIndex = marketId / MAX_UINT_BITS;
        uint256 indexFromRight = marketId % MAX_UINT_BITS;
        uint256 bit = bitmaps[bucketIndex] & (ONE << indexFromRight);
        return bit != 0;
    }

    function unsetBit(
        uint256 bitmap,
        uint256 bit
    ) internal pure returns (uint256) {
        return bitmap & ~(ONE << bit);
    }

    // solium-disable security/no-assign-params
    function getLeastSignificantBit(uint256 x) internal pure returns (uint256) {
        // gas usage peaks at 350 per call

        uint256 lsb = 255;

        if (x & uint128(-1) != 0) {
            lsb -= 128;
        } else {
            x >>= 128;
        }

        if (x & uint64(-1) != 0) {
            lsb -= 64;
        } else {
            x >>= 64;
        }

        if (x & uint32(-1) != 0) {
            lsb -= 32;
        } else {
            x >>= 32;
        }

        if (x & uint16(-1) != 0) {
            lsb -= 16;
        } else {
            x >>= 16;
        }

        if (x & uint8(-1) != 0) {
            lsb -= 8;
        } else {
            x >>= 8;
        }

        if (x & 0xf != 0) {
            lsb -= 4;
        } else {
            x >>= 4;
        }

        if (x & 0x3 != 0) {
            lsb -= 2;
        } else {
            x >>= 2;
            // solium-enable security/no-assign-params
        }

        if (x & 0x1 != 0) {
            lsb -= 1;
        }

        return lsb;
    }
}
