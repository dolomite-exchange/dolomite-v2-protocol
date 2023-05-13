import { TestContracts } from './TestContracts';
import { address, Decimal, TxResult } from '../../src';
import { TestAccountRiskOverrideSetter as TestAccountRiskOverrideSetterContract } from '../../build/testing_wrappers/TestAccountRiskOverrideSetter';
import { AccountRiskOverrideSetter } from '../../src/modules/AccountRiskOverrideSetter';

export class TestAccountRiskOverrideSetter {
  private contracts: TestContracts;
  private testAccountRiskOverrideSetter: TestAccountRiskOverrideSetterContract;

  constructor(contracts: TestContracts, contractAddress: address) {
    this.contracts = contracts;
    this.testAccountRiskOverrideSetter = this.contracts.getTestAccountRiskOverrideSetter(contractAddress);
  }

  public get address(): string {
    return this.testAccountRiskOverrideSetter.options.address;
  }

  public async setAccountRiskOverride(
    accountOwner: address,
    marginRatioOverride: Decimal,
    liquidationSpreadOverride: Decimal,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.testAccountRiskOverrideSetter.methods.setAccountRiskOverride(
        accountOwner,
        { value: marginRatioOverride.toFixed() },
        { value: liquidationSpreadOverride.toFixed() },
      ),
    );
  }

  public async getAccountRiskOverride(
    accountOwner: address,
  ) {
    const setter = new AccountRiskOverrideSetter(this.contracts, this.address);
    return setter.getAccountRiskOverride(accountOwner);
  }
}
