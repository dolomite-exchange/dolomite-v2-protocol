import { IOracleSentinel } from '../../build/wrappers/IOracleSentinel';
import { Contracts } from '../lib/Contracts';
import { address, ContractCallOptions, ContractConstantCallOptions, Integer } from '../types';
import BigNumber from 'bignumber.js';

export class OracleSentinel {
  private contracts: Contracts;
  private oracleSentinel: IOracleSentinel;

  constructor(contracts: Contracts, oracleSentinelAddress: address) {
    this.contracts = contracts;
    this.oracleSentinel = this.contracts.getOracleSentinel(oracleSentinelAddress);
  }

  public get address(): address {
    return this.oracleSentinel.options.address;
  }

  public async ownerSetGracePeriodDuration(gracePeriod: Integer, options?: ContractCallOptions) {
    return this.contracts.callContractFunction(
      this.oracleSentinel.methods.ownerSetGracePeriod(gracePeriod.toFixed()),
      options,
    );
  }

  // ============ Getter Functions ============

  public async gracePeriod(options?: ContractConstantCallOptions) {
    const value = await this.contracts.callConstantContractFunction(this.oracleSentinel.methods.gracePeriod(), options);
    return new BigNumber(value);
  }

  public async isBorrowAllowed(options?: ContractConstantCallOptions) {
    return this.contracts.callConstantContractFunction(this.oracleSentinel.methods.isBorrowAllowed(), options);
  }

  public async isLiquidationAllowed(options?: ContractConstantCallOptions) {
    return this.contracts.callConstantContractFunction(this.oracleSentinel.methods.isLiquidationAllowed(), options);
  }
}
