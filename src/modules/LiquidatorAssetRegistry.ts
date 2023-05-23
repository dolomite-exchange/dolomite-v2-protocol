import { Contracts } from '../lib/Contracts';
import { address, ContractCallOptions, ContractConstantCallOptions, Integer, TxResult } from '../types';

export class LiquidatorAssetRegistry {
  private contracts: Contracts;

  constructor(contracts: Contracts) {
    this.contracts = contracts;
  }

  public get address(): address {
    return this.contracts.liquidatorAssetRegistry.options.address;
  }

  // ============ State-Changing Functions ============

  public async addLiquidatorToAssetWhitelist(
    marketId: Integer,
    liquidatorProxy: address,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.liquidatorAssetRegistry.methods.ownerAddLiquidatorToAssetWhitelist(
        marketId.toFixed(0),
        liquidatorProxy,
      ),
      options,
    );
  }

  public async removeLiquidatorFromAssetWhitelist(
    marketId: Integer,
    liquidatorProxy: address,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.liquidatorAssetRegistry.methods.ownerRemoveLiquidatorFromAssetWhitelist(
        marketId.toFixed(0),
        liquidatorProxy,
      ),
      options,
    );
  }

  // ============ Getter Functions ============

  public async getLiquidatorsForAsset(
    marketId: Integer,
    options?: ContractConstantCallOptions,
  ): Promise<string[]> {
    return this.contracts.callConstantContractFunction(
      this.contracts.liquidatorAssetRegistry.methods.getLiquidatorsForAsset(
        marketId.toFixed(0),
      ),
      options,
    );
  }

  public async isAssetWhitelistedForLiquidation(
    marketId: Integer,
    liquidatorProxy: address,
    options?: ContractConstantCallOptions,
  ): Promise<boolean> {
    return this.contracts.callConstantContractFunction(
      this.contracts.liquidatorAssetRegistry.methods.isAssetWhitelistedForLiquidation(
        marketId.toFixed(0),
        liquidatorProxy,
      ),
      options,
    );
  }
}
