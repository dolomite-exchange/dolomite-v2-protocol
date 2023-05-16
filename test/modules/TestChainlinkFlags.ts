import { ContractCallOptions, TxResult } from '../../src';
import { TestContracts } from './TestContracts';

export class TestChainlinkFlags {
  private contracts: TestContracts;

  constructor(contracts: TestContracts) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testChainlinkFlags.options.address;
  }

  public async setShouldReturnOffline(isOffline: boolean, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.testChainlinkFlags.methods.setShouldReturnOffline(isOffline),
      options,
    );
  }
}
