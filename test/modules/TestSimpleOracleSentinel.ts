import { ContractCallOptions, TxResult } from '../../src';
import { TestContracts } from './TestContracts';

export class TestSimpleOracleSentinel {
  private contracts: TestContracts;

  constructor(contracts: TestContracts) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testSimpleOracleSentinel.options.address;
  }

  public async setIsBorrowAllowed(isBorrowAllowed: boolean, options?: ContractCallOptions): Promise<TxResult> {
    return await this.contracts.callContractFunction(
      this.contracts.testSimpleOracleSentinel.methods.setIsBorrowAllowed(isBorrowAllowed),
      options,
    );
  }

  public async setIsLiquidationAllowed(
    isLiquidationAllowed: boolean,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return await this.contracts.callContractFunction(
      this.contracts.testSimpleOracleSentinel.methods.setIsLiquidationAllowed(isLiquidationAllowed),
      options,
    );
  }

  public async isBorrowAllowed(
    options?: ContractCallOptions,
  ): Promise<boolean> {
    return await this.contracts.callConstantContractFunction(
      this.contracts.testSimpleOracleSentinel.methods.isBorrowAllowed(),
      options,
    );
  }

  public async isLiquidationAllowed(
    options?: ContractCallOptions,
  ): Promise<boolean> {
    return await this.contracts.callConstantContractFunction(
      this.contracts.testSimpleOracleSentinel.methods.isLiquidationAllowed(),
      options,
    );
  }
}
