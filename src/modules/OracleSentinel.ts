import { IOracleSentinel } from '../../build/wrappers/IOracleSentinel';
import { Contracts } from '../lib/Contracts';
import { address, ContractConstantCallOptions } from '../types';

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

  // ============ Getter Functions ============

  public async isBorrowAllowed(options?: ContractConstantCallOptions) {
    return this.contracts.callConstantContractFunction(this.oracleSentinel.methods.isBorrowAllowed(), options);
  }

  public async isLiquidationAllowed(options?: ContractConstantCallOptions) {
    return this.contracts.callConstantContractFunction(this.oracleSentinel.methods.isLiquidationAllowed(), options);
  }
}
