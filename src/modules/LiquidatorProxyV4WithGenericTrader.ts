import { Contracts } from '../lib/Contracts';
import { AccountInfo, address, ContractCallOptions, Integer, TxResult } from '../types';
import { GenericTraderParam, GenericTraderProxyV1 } from './GenericTraderProxyV1';

export class LiquidatorProxyV4WithGenericTrader {
  private contracts: Contracts;

  constructor(contracts: Contracts) {
    this.contracts = contracts;
  }

  public get address(): address {
    return this.contracts.liquidatorProxyV4WithGenericTrader.options.address;
  }

  // ============ State-Changing Functions ============

  /**
   * Liquidate liquidAccount using solidAccount. This contract and the msg.sender to this contract
   * must both be operators for the solidAccount.
   *
   * @param  solidOwner         The address of the account that will do the liquidating
   * @param  solidNumber        The index of the account that will do the liquidating
   * @param  liquidOwner        The address of the account that will be liquidated
   * @param  liquidNumber       The index of account that will be liquidated
   * @param marketIdsPath       The market IDs that will be traded, in order. The first marketId is the input and the
   *                            last is the output.
   * @param inputAmountWei      The amount of the input token to be traded, in wei.
   * @param minOutputAmountWei  The minimum amount of the output token to be received, in wei.
   * @param tradersPath         The traders to be used for each action. The length should be `marketIdsPath.length - 1`.
   * @param makerAccounts       The accounts that will be used as makers for each trade of type
   *                            TradeType.InternalLiquidity. The length should be equal to the number of unique maker
   *                            accounts needed to execute the trade with the provided `tradersPath`.
   * @param  expiry             The time at which the position expires, if this liquidation is for closing an expired
   *                            position. Else, 0.
   * @param options             Additional options to be passed through to the web3 call.
   */
  public async liquidate(
    solidOwner: address,
    solidNumber: Integer,
    liquidOwner: address,
    liquidNumber: Integer,
    marketIdsPath: Integer[],
    inputAmountWei: Integer,
    minOutputAmountWei: Integer,
    tradersPath: GenericTraderParam[],
    makerAccounts: AccountInfo[],
    expiry: Integer | null,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.liquidatorProxyV4WithGenericTrader.methods.liquidate(
        {
          owner: solidOwner,
          number: solidNumber.toFixed(0),
        },
        {
          owner: liquidOwner,
          number: liquidNumber.toFixed(0),
        },
        marketIdsPath.map(marketId => marketId.toFixed(0)),
        inputAmountWei.toFixed(),
        minOutputAmountWei.toFixed(),
        GenericTraderProxyV1.genericTraderParamsToCalldata(tradersPath),
        makerAccounts,
        expiry ? expiry.toFixed(0) : '0',
      ),
      options,
    );
  }
}
