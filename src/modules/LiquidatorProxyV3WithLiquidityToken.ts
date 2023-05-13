import { Contracts } from '../lib/Contracts';
import { address, ContractCallOptions, Integer, TxResult } from '../types';
import { toBytesNoPadding } from '../lib/BytesHelper';

export class LiquidatorProxyV3WithLiquidityToken {
  private contracts: Contracts;

  constructor(contracts: Contracts) {
    this.contracts = contracts;
  }

  public get address(): address {
    return this.contracts.liquidatorProxyV3WithLiquidityToken.options.address;
  }

  // ============ State-Changing Functions ============

  /**
   * Liquidate liquidAccount using solidAccount. This contract and the msg.sender to this contract
   * must both be operators for the solidAccount.
   *
   * @param  solidOwner       The address of the account that will do the liquidating
   * @param  solidNumber      The index of the account that will do the liquidating
   * @param  liquidOwner      The address of the account that will be liquidated
   * @param  liquidNumber     The index of account that will be liquidated
   * @param  owedMarket       The owed market whose borrowed value will be added to `toLiquidate`
   * @param  heldMarket       The held market whose collateral will be recovered to take on the debt of `owedMarket`
   * @param  expiry           The time at which the position expires, if this liquidation is for closing an expired
   *                          position. Else, 0.
   * @param paraswapCallData  The calldata to pass along to Paraswap for settlement of the liquidation trade.
   * @param options           Additional options to be passed through to the web3 call.
   */
  public async liquidate(
    solidOwner: address,
    solidNumber: Integer,
    liquidOwner: address,
    liquidNumber: Integer,
    owedMarket: Integer,
    heldMarket: Integer,
    expiry: Integer | null,
    paraswapCallData: string,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.liquidatorProxyV3WithLiquidityToken.methods.liquidate(
        {
          owner: solidOwner,
          number: solidNumber.toFixed(0),
        },
        {
          owner: liquidOwner,
          number: liquidNumber.toFixed(0),
        },
        owedMarket.toFixed(0),
        heldMarket.toFixed(0),
        expiry ? expiry.toFixed(0) : '0',
        toBytesNoPadding(paraswapCallData),
      ),
      options,
    );
  }

  public async setMarketIdToTokenUnwrapperTrader(
    marketId: Integer,
    tokenUnwrapper: address,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.liquidatorProxyV3WithLiquidityToken.methods.ownerSetMarketIdToTokenUnwrapperTrader(
        marketId.toFixed(0),
        tokenUnwrapper,
      ),
      options,
    );
  }

  public async getTokenUnwrapperByMarketId(marketId: Integer): Promise<address> {
    return this.contracts.callConstantContractFunction(
      this.contracts.liquidatorProxyV3WithLiquidityToken.methods.marketIdToTokenUnwrapperMap(marketId.toFixed())
    );
  }
}
