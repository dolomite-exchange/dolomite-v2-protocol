import BigNumber from 'bignumber.js';
import { Contracts } from '../../lib/Contracts';
import { address, ContractCallOptions, ContractConstantCallOptions, Integer, TxResult, } from '../../types';

export class ChainlinkPriceOracleV1 {
  private contracts: Contracts;

  constructor(contracts: Contracts) {
    this.contracts = contracts;
  }

  // ============ Admin ============

  public async ownerInsertOrUpdateOracleToken(
    token: address,
    tokenDecimals: number,
    chainlinkAggregator: address,
    tokenPair: address,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.chainlinkPriceOracleV1.methods.ownerInsertOrUpdateOracleToken(
        token,
        tokenDecimals,
        chainlinkAggregator,
        tokenPair,
      ),
      options,
    );
  }

  public async ownerSetStalenessThreshold(
    stalenessThreshold: Integer,
    options?: ContractCallOptions,
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.chainlinkPriceOracleV1.methods.ownerSetStalenessThreshold(
        stalenessThreshold.toFixed(),
      ),
      options,
    );
  }

  // ============ Getters ============

  public async getStalenessThreshold(options?: ContractConstantCallOptions): Promise<Integer> {
    const stalenessThreshold = await this.contracts.callConstantContractFunction(
      this.contracts.chainlinkPriceOracleV1.methods.stalenessThreshold(),
      options,
    );
    return new BigNumber(stalenessThreshold);
  }

  public async getPrice(
    token: address,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    const price = await this.contracts.callConstantContractFunction(
      this.contracts.chainlinkPriceOracleV1.methods.getPrice(token),
      options,
    );
    return new BigNumber(price.value);
  }

  public async getAggregatorByToken(
    token: address,
    options?: ContractConstantCallOptions,
  ): Promise<address> {
    return this.contracts.callConstantContractFunction(
      this.contracts.chainlinkPriceOracleV1.methods.getAggregatorByToken(token),
      options,
    );
  }

  public async getTokenDecimalsByToken(
    token: address,
    options?: ContractConstantCallOptions,
  ): Promise<number> {
    const decimals = await this.contracts.callConstantContractFunction(
      this.contracts.chainlinkPriceOracleV1.methods.getDecimalsByToken(token),
      options,
    );
    return Number.parseInt(decimals, 10);
  }

  /**
   * @return 0 address for USD, non-zero address representing another token otherwise.
   */
  public async getCurrencyPairingByToken(
    token: address,
    options?: ContractConstantCallOptions,
  ): Promise<address> {
    return this.contracts.callConstantContractFunction(
      this.contracts.chainlinkPriceOracleV1.methods.getTokenPairByToken(token),
      options,
    );
  }

  /**
   * @return Standardizes `value` to have `ONE_DOLLAR` - `tokenDecimals` number of decimals.
   */
  public async standardizeNumberOfDecimals(
    tokenDecimals: number,
    value: Integer,
    valueDecimals: number,
    options?: ContractConstantCallOptions,
  ): Promise<Integer> {
    const valueString = await this.contracts.callConstantContractFunction(
      this.contracts.chainlinkPriceOracleV1.methods.standardizeNumberOfDecimals(
        tokenDecimals,
        value.toFixed(),
        valueDecimals
      ),
      options,
    );
    return new BigNumber(valueString);
  }

}
