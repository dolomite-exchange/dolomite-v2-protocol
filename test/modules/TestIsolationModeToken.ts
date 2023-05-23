import { TestIsolationModeToken as TestIsolationModeTokenContract } from '../../build/testing_wrappers/TestIsolationModeToken';
import { address, ContractCallOptions, TxResult } from '../../src';
import { Token } from '../../src/modules/Token';
import { TestContracts } from './TestContracts';
import { TestToken } from './TestToken';

export class TestIsolationModeToken extends TestToken {
  private testIsolationModeTokenContract: TestIsolationModeTokenContract;

  constructor(contracts: TestContracts, token: Token, testTokenContract: TestIsolationModeTokenContract) {
    super(contracts, token, testTokenContract);
    this.testIsolationModeTokenContract = testTokenContract;
  }

  public get address(): string {
    return this.testIsolationModeTokenContract.options.address;
  }

  public async setTokenConverterTrusted(
    tokenConverter: address,
    isTrusted: boolean,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.testIsolationModeTokenContract.methods.setTokenConverterTrusted(tokenConverter, isTrusted),
      options,
    );
  }

  public async isTokenConverterTrusted(tokenConverter: address, options: ContractCallOptions = {}): Promise<boolean> {
    return this.contracts.callConstantContractFunction(
      this.testIsolationModeTokenContract.methods.isTokenConverterTrusted(tokenConverter),
      options,
    );
  }

  public async isIsolationAsset(options: ContractCallOptions = {}): Promise<boolean> {
    return this.contracts.callConstantContractFunction(
      this.testIsolationModeTokenContract.methods.isIsolationAsset(),
      options,
    );
  }
}
