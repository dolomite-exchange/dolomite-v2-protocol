import { Contracts } from '../lib/Contracts';
import { ActionArgs, address, Integer } from '../types';
import { hexStringToBytes } from '../lib/BytesHelper';
import { ILiquidityTokenUnwrapperTrader } from '../../build/wrappers/ILiquidityTokenUnwrapperTrader';
import BigNumber from 'bignumber.js';

export class LiquidityTokenUnwrapper {
  private contracts: Contracts;
  public unwrapperContract: ILiquidityTokenUnwrapperTrader;

  constructor(
    contracts: Contracts,
    unwrapperContract: ILiquidityTokenUnwrapperTrader,
  ) {
    this.contracts = contracts;
    this.unwrapperContract = unwrapperContract;
  }

  public get address(): address {
    return this.unwrapperContract.options.address;
  }

  public async token(): Promise<address> {
    return this.contracts.callConstantContractFunction(
      this.unwrapperContract.methods.token()
    );
  }

  public async actionsLength(): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.unwrapperContract.methods.actionsLength()
    );
    return new BigNumber(result);
  }

  public async createActionsForUnwrapping(
    solidAccountId: Integer,
    liquidAccountId: Integer,
    solidAccountOwner: address,
    liquidAccountOwner: address,
    owedMarket: Integer,
    heldMarket: Integer,
    owedAmount: Integer,
    heldAmountWithReward: Integer,
  ): Promise<ActionArgs[]> {
    return this.contracts.callConstantContractFunction(
      this.unwrapperContract.methods.createActionsForUnwrapping(
        solidAccountId.toFixed(),
        liquidAccountId.toFixed(),
        solidAccountOwner,
        liquidAccountOwner,
        owedMarket.toFixed(),
        heldMarket.toFixed(),
        owedAmount.toFixed(),
        heldAmountWithReward.toFixed(),
      )
    );
  }

  public async getExchangeCost(
    makerToken: address,
    takerToken: address,
    desiredMakerToken: Integer,
    orderData: string,
  ): Promise<Integer> {
    const result = await this.contracts.callConstantContractFunction(
      this.unwrapperContract.methods.getExchangeCost(
        makerToken,
        takerToken,
        desiredMakerToken.toFixed(),
        hexStringToBytes(orderData),
      )
    );
    return new BigNumber(result);
  }
}
