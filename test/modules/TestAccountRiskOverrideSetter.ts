import { decimalToString } from '../../src/lib/Helpers';
import { TestContracts } from './TestContracts';
import { AccountInfo, Decimal, TxResult } from '../../src';
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
    account: AccountInfo,
    marginRatioOverride: Decimal,
    liquidationSpreadOverride: Decimal,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.testAccountRiskOverrideSetter.methods.setAccountRiskOverride(
        account,
        { value: decimalToString(marginRatioOverride) },
        { value: decimalToString(liquidationSpreadOverride) },
      ),
    );
  }

  public async getAccountRiskOverride(
    account: AccountInfo,
  ) {
    const setter = new AccountRiskOverrideSetter(this.contracts, this.address);
    return setter.getAccountRiskOverride(account);
  }
}
