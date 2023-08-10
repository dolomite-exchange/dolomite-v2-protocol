import { ContractCallOptions, Integer, TxResult } from '../../src';
import { TestContracts } from './TestContracts';

export class TestSequencerUptimeFeedAggregator {
  private contracts: TestContracts;

  constructor(contracts: TestContracts) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testSequencerUptimeFeedAggregator.options.address;
  }

  public async setLatestPrice(latestAnswer: Integer, options?: ContractCallOptions): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.testSequencerUptimeFeedAggregator.methods.setLatestAnswer(latestAnswer.toFixed()),
      options,
    );
  }
}
