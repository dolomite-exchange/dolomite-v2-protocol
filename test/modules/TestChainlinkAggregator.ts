import { ContractCallOptions, Integer, TxResult } from '../../src';
import { TestContracts } from './TestContracts';

export class TestChainlinkAggregator {
  private contracts: TestContracts;

  constructor(contracts: TestContracts) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testChainlinkPriceAggregator.options.address;
  }

  public async setLatestPrice(latestAnswer: Integer, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.testChainlinkPriceAggregator.methods.setLatestAnswer(latestAnswer.toFixed()),
      options,
    );
  }

  public async setMinAnswer(minAnswer: Integer, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.testChainlinkPriceAggregator.methods.setMinAnswer(minAnswer.toFixed()),
      options,
    );
  }

  public async setMaxAnswer(maxAnswer: Integer, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.testChainlinkPriceAggregator.methods.setMaxAnswer(maxAnswer.toFixed()),
      options,
    );
  }
}
