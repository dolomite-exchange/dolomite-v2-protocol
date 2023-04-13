import { Contracts } from '../lib/Contracts';
import { decimalToString } from '../lib/Helpers';
import { address, ContractCallOptions, Decimal, Integer, TxResult } from '../types';

export class Admin {
  private contracts: Contracts;

  constructor(contracts: Contracts) {
    this.contracts = contracts;
  }

  // ============ Token Functions ============

  public async withdrawExcessTokens(
    marketId: Integer,
    recipient: address,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerWithdrawExcessTokens(marketId.toFixed(0), recipient),
      options,
    );
  }

  public async withdrawUnsupportedTokens(
    token: address,
    recipient: address,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerWithdrawUnsupportedTokens(token, recipient),
      options,
    );
  }

  public async setAccountMaxNumberOfMarketsWithBalances(
    accountMaxNumberOfMarketsWithBalances: number,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetAccountMaxNumberOfMarketsWithBalances(
        accountMaxNumberOfMarketsWithBalances,
      ),
      options,
    );
  }

  // ============ Market Functions ============

  public async addMarket(
    token: address,
    priceOracle: address,
    interestSetter: address,
    marginPremium: Decimal,
    spreadPremium: Decimal,
    maxSupplyWei: Integer,
    maxBorrowWei: Integer,
    earningsRateOverride: Decimal,
    isClosing: boolean,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerAddMarket(
        token,
        priceOracle,
        interestSetter,
        { value: decimalToString(marginPremium) },
        { value: decimalToString(spreadPremium) },
        maxSupplyWei.toFixed(0),
        maxBorrowWei.toFixed(0),
        { value: decimalToString(earningsRateOverride) },
        isClosing,
      ),
      options,
    );
  }

  public async setIsClosing(marketId: Integer, isClosing: boolean, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetIsClosing(marketId.toFixed(0), isClosing),
      options,
    );
  }

  public async setMarginPremium(
    marketId: Integer,
    marginPremium: Decimal,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetMarginPremium(marketId.toFixed(0), {
        value: decimalToString(marginPremium),
      }),
      options,
    );
  }

  public async setLiquidationSpreadPremium(
    marketId: Integer,
    spreadPremium: Decimal,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetLiquidationSpreadPremium(marketId.toFixed(0), {
        value: decimalToString(spreadPremium),
      }),
      options,
    );
  }

  public async setMaxSupplyWei(
    marketId: Integer,
    maxSupplyWei: Integer,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetMaxSupplyWei(marketId.toFixed(0), maxSupplyWei.toFixed(0)),
      options,
    );
  }

  public async setMaxBorrowWei(
    marketId: Integer,
    maxBorrowWei: Integer,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetMaxBorrowWei(marketId.toFixed(0), maxBorrowWei.toFixed(0)),
      options,
    );
  }

  public async setEarningsRateOverride(
    marketId: Integer,
    earningsRateOverride: Decimal,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetEarningsRateOverride(marketId.toFixed(0), {
        value: decimalToString(earningsRateOverride),
      }),
      options,
    );
  }

  public async setPriceOracle(marketId: Integer, oracle: address, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetPriceOracle(marketId.toFixed(0), oracle),
      options,
    );
  }

  public async setInterestSetter(
    marketId: Integer,
    interestSetter: address,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetInterestSetter(marketId.toFixed(0), interestSetter),
      options,
    );
  }

  // ============ Risk Functions ============

  public async setMarginRatio(marginRatio: Decimal, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetMarginRatio({
        value: decimalToString(marginRatio),
      }),
      options,
    );
  }

  public async setLiquidationSpread(spread: Decimal, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetLiquidationSpread({
        value: decimalToString(spread),
      }),
      options,
    );
  }

  public async setAccountRiskOverride(
    accountOwner: address,
    marginRatio: Decimal,
    liquidationSpread: Decimal,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetAccountRiskOverride(
        accountOwner,
        { value: decimalToString(marginRatio) },
        { value: decimalToString(liquidationSpread) },
      ),
      options,
    );
  }

  public async setEarningsRate(rate: Decimal, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetEarningsRate({
        value: decimalToString(rate),
      }),
      options,
    );
  }

  public async setMinBorrowedValue(minBorrowedValue: Integer, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetMinBorrowedValue({
        value: minBorrowedValue.toFixed(0),
      }),
      options,
    );
  }

  // ============ Global Operator Functions ============

  public async setGlobalOperator(
    operator: address,
    approved: boolean,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetGlobalOperator(operator, approved),
      options,
    );
  }

  public async setAutoTraderIsSpecial(
    autoTrader: address,
    isSpecial: boolean,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.dolomiteMargin.methods.ownerSetAutoTraderSpecial(autoTrader, isSpecial),
      options,
    );
  }

  // ============ Expiry Functions ============

  public async setExpiryRampTime(newExpiryRampTime: Integer, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.expiry.methods.ownerSetExpiryRampTime(newExpiryRampTime.toFixed(0)),
      options,
    );
  }
}
