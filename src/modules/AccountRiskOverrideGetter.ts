import { IAccountRiskOverrideGetter } from '../../build/wrappers/IAccountRiskOverrideGetter';
import { Contracts } from '../lib/Contracts';
import { stringToDecimal } from '../lib/Helpers';
import { address, ContractConstantCallOptions } from '../types';

export class AccountRiskOverrideGetter {
  private contracts: Contracts;
  private accountRiskOverrideGetter: IAccountRiskOverrideGetter;

  constructor(contracts: Contracts, oracleSentinelAddress: address) {
    this.contracts = contracts;
    this.accountRiskOverrideGetter = this.contracts.getOracleSentinel(oracleSentinelAddress);
  }

  public get address(): address {
    return this.accountRiskOverrideGetter.options.address;
  }

  // ============ Getter Functions ============

  public async getAccountRiskOverride(
    accountOwner: address,
    options?: ContractConstantCallOptions,
  ) {
    const { marginRatioOverride, liquidationSpreadOverride } = await this.contracts.callConstantContractFunction(
      this.accountRiskOverrideGetter.methods.getAccountRiskOverride(accountOwner),
      options,
    );
    return {
      marginRatioOverride: stringToDecimal(marginRatioOverride),
      liquidationSpreadOverride: stringToDecimal(liquidationSpreadOverride),
    };
  }
}
