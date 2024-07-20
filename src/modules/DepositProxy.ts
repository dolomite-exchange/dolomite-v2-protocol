import { Contracts } from '../lib/Contracts';
import { address, BalanceCheckFlag, ContractCallOptions, Integer, TxResult } from '../types';

export class DepositProxy {
  private contracts: Contracts;

  constructor(contracts: Contracts) {
    this.contracts = contracts;
  }

  public get address(): address {
    return this.contracts.depositProxy.options.address;
  }

  // ============ View Functions ============

  public async dolomiteMargin(): Promise<address> {
    return this.contracts.callConstantContractFunction(this.contracts.depositProxy.methods.DOLOMITE_MARGIN());
  }

  // ============ Write Functions ============

  public async initializePayableMarket(
    payableToken: address,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.depositProxy.methods.initializePayableMarket(payableToken),
      options,
    );
  }

  public async depositWei(
    accountIndex: Integer,
    marketId: Integer,
    amountWei: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.depositProxy.methods.depositWei(accountIndex.toFixed(), marketId.toFixed(), amountWei.toFixed()),
      options,
    );
  }

  public async depositPayable(
    accountIndex: Integer,
    amountWei: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(this.contracts.depositProxy.methods.depositPayable(accountIndex.toFixed()), {
      ...options,
      value: amountWei.toFixed(),
    });
  }

  public async depositWeiIntoDefaultAccount(
    marketId: Integer,
    amountWei: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.depositProxy.methods.depositWeiIntoDefaultAccount(marketId.toFixed(), amountWei.toFixed()),
      options,
    );
  }

  public async depositPayableIntoDefaultAccount(amountWei: Integer, options: ContractCallOptions = {}): Promise<TxResult> {
    return this.contracts.callContractFunction(this.contracts.depositProxy.methods.depositPayableIntoDefaultAccount(), {
      ...options,
      value: amountWei.toFixed(),
    });
  }

  public async withdrawWei(
    accountIndex: Integer,
    marketId: Integer,
    amountWei: Integer,
    balanceCheckFlag: BalanceCheckFlag,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.depositProxy.methods.withdrawWei(
        accountIndex.toFixed(),
        marketId.toFixed(),
        amountWei.toFixed(),
        balanceCheckFlag,
        ),
      options,
    );
  }

  public async withdrawPayable(
    accountIndex: Integer,
    amountWei: Integer,
    balanceCheckFlag: BalanceCheckFlag,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.depositProxy.methods.withdrawPayable(accountIndex.toFixed(), amountWei.toFixed(), balanceCheckFlag),
      options,
    );
  }

  public async withdrawWeiFromDefaultAccount(
    marketId: Integer,
    amountWei: Integer,
    balanceCheckFlag: BalanceCheckFlag,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.depositProxy.methods.withdrawWeiFromDefaultAccount(
        marketId.toFixed(),
        amountWei.toFixed(),
        balanceCheckFlag,
      ),
      options,
    );
  }

  public async withdrawPayableFromDefaultAccount(
    amountWei: Integer,
    balanceCheckFlag: BalanceCheckFlag,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.depositProxy.methods.withdrawPayableFromDefaultAccount(amountWei.toFixed(), balanceCheckFlag),
      options,
    );
  }

  public async depositPar(
    accountIndex: Integer,
    marketId: Integer,
    amountPar: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.depositProxy.methods.depositPar(accountIndex.toFixed(), marketId.toFixed(), amountPar.toFixed()),
      options,
    );
  }

  public async depositParIntoDefaultAccount(
    marketId: Integer,
    amountPar: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.depositProxy.methods.depositParIntoDefaultAccount(marketId.toFixed(), amountPar.toFixed()),
      options,
    );
  }

  public async withdrawPar(
    accountIndex: Integer,
    marketId: Integer,
    amountPar: Integer,
    balanceCheckFlag: BalanceCheckFlag,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.depositProxy.methods.withdrawPar(
        accountIndex.toFixed(),
        marketId.toFixed(),
        amountPar.toFixed(),
        balanceCheckFlag,
        ),
      options,
    );
  }

  public async withdrawParFromDefaultAccount(
    marketId: Integer,
    amountPar: Integer,
    balanceCheckFlag: BalanceCheckFlag,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.depositProxy.methods.withdrawParFromDefaultAccount(
        marketId.toFixed(),
        amountPar.toFixed(),
        balanceCheckFlag,
        ),
      options,
    );
  }
}
