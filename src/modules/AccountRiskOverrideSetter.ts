import { IAccountRiskOverrideSetter } from '../../build/wrappers/IAccountRiskOverrideSetter';
import { Contracts } from '../lib/Contracts';
import { stringToDecimal } from '../lib/Helpers';
import { address, ContractConstantCallOptions } from '../types';

export class AccountRiskOverrideSetter {
  private contracts: Contracts;
  private accountRiskOverrideSetter: IAccountRiskOverrideSetter;

  constructor(contracts: Contracts, contractAddress: address) {
    this.contracts = contracts;
    this.accountRiskOverrideSetter = this.contracts.getAccountRiskOverrideSetter(contractAddress);
  }

  public get address(): address {
    return this.accountRiskOverrideSetter.options.address;
  }

  // ============ Getter Functions ============

  public async getAccountRiskOverride(
    accountOwner: address,
    options?: ContractConstantCallOptions,
  ) {
    const { marginRatioOverride, liquidationSpreadOverride } = await this.contracts.callConstantContractFunction(
      this.accountRiskOverrideSetter.methods.getAccountRiskOverride(accountOwner),
      options,
    );
    return {
      marginRatioOverride: stringToDecimal(marginRatioOverride.value),
      liquidationSpreadOverride: stringToDecimal(liquidationSpreadOverride.value),
    };
  }
}
