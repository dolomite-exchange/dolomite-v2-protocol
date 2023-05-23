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

import { BigNumber } from 'bignumber.js';
import { Decimal, Integer } from '../types';
import { getInterestPerSecondForDoubleExponent, getInterestPerSecondForAAVECopyCat } from './Helpers';
import interestConstants from './interest-constants.json';
import { INTEGERS } from './Constants';

interface ExtraData {
  interestRateModel: string;
}

export interface AlwaysZeroData extends ExtraData {
  interestRateModel: 'AlwaysZero';
}

export interface AAVECopyCatData extends ExtraData {
  interestRateModel: 'AAVECopyCat';
  isStableCoin: boolean;
}

export interface DoubleExponentData extends ExtraData {
  interestRateModel: 'DoubleExponent';
  maxAPR: Decimal;
  coefficients: number[];
}

export class Interest {
  private networkId: number;

  constructor(networkId: number) {
    this.setNetworkId(networkId);
  }

  public setNetworkId(networkId: number): void {
    this.networkId = networkId;
  }

  public getEarningsRate(): Decimal {
    const networkConstants = this.getNetworkConstants();
    const earningsRate = new BigNumber(networkConstants.earningsRate);
    if (!earningsRate) {
      throw new Error(`No earnings rate for network: ${this.networkId}`);
    }
    return new BigNumber(earningsRate);
  }

  public getInterestPerSecondByMarket(
    marketId: Integer,
    totals: { totalBorrowed: Integer; totalSupply: Integer },
    extraData?: AAVECopyCatData | DoubleExponentData,
  ): {
    borrowInterestRate: Integer,
    supplyInterestRate: Integer,
  } {
    const earningsRate = this.getEarningsRate();
    const constants = extraData ?? this.getMarketConstants(marketId);

    // determine the borrow interest rate (capped at 18 decimal places)
    let borrowInterestRate: Decimal;
    if (constants.interestRateModel === 'DoubleExponent') {
      borrowInterestRate = getInterestPerSecondForDoubleExponent(constants.maxAPR, constants.coefficients, totals);
    } else if (constants.interestRateModel === 'AAVECopyCat') {
      borrowInterestRate = getInterestPerSecondForAAVECopyCat(constants.isStableCoin, totals);
    } else if (constants.interestRateModel === 'AlwaysZero') {
      borrowInterestRate = INTEGERS.ZERO;
    }

    // determine the supply interest rate (uncapped decimal places)
    let supplyInterestRate = borrowInterestRate.times(earningsRate);
    if (totals.totalBorrowed.lt(totals.totalSupply)) {
      supplyInterestRate = supplyInterestRate
        .times(totals.totalBorrowed)
        .div(totals.totalSupply);
    }

    return {
      borrowInterestRate,
      supplyInterestRate,
    };
  }

  // ============ Private Helper Functions ============

  private getNetworkConstants() {
    const networkConstants = interestConstants[this.networkId];
    if (!networkConstants) {
      throw new Error(`No interest constants for network: ${this.networkId}`);
    }
    return networkConstants;
  }

  private getMarketConstants(marketId: Integer): AlwaysZeroData | AAVECopyCatData | DoubleExponentData {
    const networkConstants = this.getNetworkConstants();
    const constants = networkConstants[marketId.toFixed(0)];
    if (!constants) {
      // '0' is always defined and is the fallback
      return networkConstants['0'];
    }
    return constants;
  }
}
