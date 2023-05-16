import { decimalToString } from '../../src/lib/Helpers';
import { TestContracts } from './TestContracts';
import { address, Decimal, TxResult } from '../../src';
import { TestAccountRiskOverrideSetter as TestAccountRiskOverrideSetterContract } from '../../build/testing_wrappers/TestAccountRiskOverrideSetter';
import { AccountRiskOverrideSetter } from '../../src/modules/AccountRiskOverrideSetter';

export class TestAccountRiskOverrideSetter {
  private contracts: TestContracts;
  private testAccountRiskOverrideSetter: TestAccountRiskOverrideSetterContract;

  constructor(contracts: TestContracts, accountRiskOverrideSetterContract: TestAccountRiskOverrideSetterContract) {
    this.contracts = contracts;
    this.testAccountRiskOverrideSetter = accountRiskOverrideSetterContract;
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
        { value: decimalToString(marginRatioOverride) },
        { value: decimalToString(liquidationSpreadOverride) },
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
