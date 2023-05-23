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
import { Require } from "../../protocol/lib/Require.sol";


/**
 * @title OnlyDolomiteMargin
 * @author Dolomite
 *
 * Inheritable contract that restricts the calling of certain functions to DolomiteMargin only
 */
contract OnlyDolomiteMargin {

    // ============ Constants ============

    bytes32 constant FILE = "OnlyDolomiteMargin";

    // ============ Storage ============

    IDolomiteMargin public DOLOMITE_MARGIN;

    // ============ Constructor ============

    constructor (
        address _dolomiteMargin
    )
        public
    {
        DOLOMITE_MARGIN = IDolomiteMargin(_dolomiteMargin);
    }

    // ============ Modifiers ============

    modifier onlyDolomiteMargin(address _from) {
        Require.that(
            _from == address(DOLOMITE_MARGIN),
            FILE,
            "Only Dolomite can call function",
            _from
        );
        _;
    }

    modifier onlyDolomiteMarginOwner(address _from) {
        Require.that(
            _from == DOLOMITE_MARGIN.owner(),
            FILE,
            "Only Dolomite owner can call",
            _from
        );
        _;
    }

    modifier onlyGlobalOperator(address _from) {
        Require.that(
            DOLOMITE_MARGIN.getIsGlobalOperator(_from),
            FILE,
            "Only global operator can call",
            _from
        );
        _;
    }
}
