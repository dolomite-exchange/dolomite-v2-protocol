/*

    Copyright 2023 Dolomite.

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

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IDolomiteMargin } from "../../protocol/interfaces/IDolomiteMargin.sol";

import { Account } from "../../protocol/lib/Account.sol";
import { Actions } from "../../protocol/lib/Actions.sol";
import { Events } from "../../protocol/lib/Events.sol";
import { Require } from "../../protocol/lib/Require.sol";
import { Types } from "../../protocol/lib/Types.sol";

import { HasLiquidatorRegistry } from "../helpers/HasLiquidatorRegistry.sol";
import { OnlyDolomiteMargin } from "../helpers/OnlyDolomiteMargin.sol";

import { IExpiry } from "../interfaces/IExpiry.sol";
import { IGenericTraderProxyBase } from "../interfaces/IGenericTraderProxyBase.sol";
import { IGenericTraderProxyV1 } from "../interfaces/IGenericTraderProxyV1.sol";
import { IIsolationModeUnwrapperTrader } from "../interfaces/IIsolationModeUnwrapperTrader.sol";
import { IIsolationModeWrapperTrader } from "../interfaces/IIsolationModeWrapperTrader.sol";
import { IEventEmitterRegistry } from "../interfaces/IEventEmitterRegistry.sol";

import { AccountActionLib } from "../lib/AccountActionLib.sol";
import { AccountBalanceLib } from "../lib/AccountBalanceLib.sol";



/**
 * @title   GenericTraderProxyV1Lib
 * @author  Dolomite
 *
 * @dev Library contract for reducing code size of the GenericTraderProxyV1 contract
 */
library GenericTraderProxyV1Lib {
    using Types for Types.Wei;

    // ============ Internal Functions ============

    function logEvents(
        IGenericTraderProxyBase.GenericTraderProxyCache memory _cache,
        Account.Info memory _tradeAccount,
        uint256[] memory _marketIdsPath,
        IGenericTraderProxyV1.TransferCollateralParam memory _param,
        IGenericTraderProxyV1.EventEmissionType _eventType
    ) public {
        if (_eventType == IGenericTraderProxyV1.EventEmissionType.MarginPosition) {
            _logMarginPositionEvent(
                _cache,
                _tradeAccount,
                _marketIdsPath,
                _param
            );
        } else if (_eventType == IGenericTraderProxyV1.EventEmissionType.BorrowPosition) {
            _cache.eventEmitterRegistry.emitBorrowPositionOpen(
                _tradeAccount.owner,
                _tradeAccount.number
            );
        } else {
            assert(_eventType == IGenericTraderProxyV1.EventEmissionType.None);
        }
    }

    function _logMarginPositionEvent(
        IGenericTraderProxyBase.GenericTraderProxyCache memory _cache,
        Account.Info memory _tradeAccount,
        uint256[] memory _marketIdsPath,
        IGenericTraderProxyV1.TransferCollateralParam memory _param
    ) internal {
        Events.BalanceUpdate memory inputBalanceUpdate;
        // solium-disable indentation
        {
            Types.Wei memory inputBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
                _tradeAccount,
                /* _inputToken = */ _marketIdsPath[0]
            );
            inputBalanceUpdate = Events.BalanceUpdate({
                deltaWei: inputBalanceWeiAfter.sub(_cache.inputBalanceWeiBeforeOperate),
                newPar: _cache.dolomiteMargin.getAccountPar(_tradeAccount, _marketIdsPath[0])
            });
        }
        // solium-enable indentation

        Events.BalanceUpdate memory outputBalanceUpdate;
        // solium-disable indentation
        {
            Types.Wei memory outputBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
                _tradeAccount,
                /* _outputToken = */ _marketIdsPath[_marketIdsPath.length - 1]
            );
            outputBalanceUpdate = Events.BalanceUpdate({
                deltaWei: outputBalanceWeiAfter.sub(_cache.outputBalanceWeiBeforeOperate),
                newPar: _cache.dolomiteMargin.getAccountPar(_tradeAccount, _marketIdsPath[_marketIdsPath.length - 1])
            });
        }
        // solium-enable indentation

        Events.BalanceUpdate memory marginBalanceUpdate;
        // solium-disable indentation
        {
            Types.Wei memory marginBalanceWeiAfter = _cache.dolomiteMargin.getAccountWei(
                _tradeAccount,
                /* _transferToken = */_param.transferAmounts[0].marketId
            );
            marginBalanceUpdate = Events.BalanceUpdate({
                deltaWei: marginBalanceWeiAfter.sub(_cache.transferBalanceWeiBeforeOperate),
                newPar: _cache.dolomiteMargin.getAccountPar(
                    _tradeAccount,
                    _param.transferAmounts[0].marketId
                )
            });
        }
        // solium-enable indentation

        if (_cache.isMarginDeposit) {
            _cache.eventEmitterRegistry.emitMarginPositionOpen(
                _tradeAccount.owner,
                _tradeAccount.number,
                /* _inputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[0]),
                /* _outputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[_marketIdsPath.length - 1]),
                /* _depositToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_param.transferAmounts[0].marketId),
                inputBalanceUpdate,
                outputBalanceUpdate,
                marginBalanceUpdate
            );
        } else {
            _cache.eventEmitterRegistry.emitMarginPositionClose(
                _tradeAccount.owner,
                _tradeAccount.number,
                /* _inputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[0]),
                /* _outputToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_marketIdsPath[_marketIdsPath.length - 1]),
                /* _withdrawalToken = */ _cache.dolomiteMargin.getMarketTokenAddress(_param.transferAmounts[0].marketId),
                inputBalanceUpdate,
                outputBalanceUpdate,
                marginBalanceUpdate
            );
        }
    }
}
