import { Contracts } from '../lib/Contracts';
import { ContractCallOptions, Integer } from '../types';
import BigNumber from 'bignumber.js';

export class MantleGasInfo {
  private contracts: Contracts;

  constructor(contracts: Contracts) {
    this.contracts = contracts;
  }

  // ============ State-Changing Functions ============

  public async getPriceInWei(options: ContractCallOptions = {}): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.contracts.mantleGasInfo.methods.gasPrice(),
      options,
    );
    return new BigNumber(result);
  }
}
