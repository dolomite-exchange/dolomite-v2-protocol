import { Contracts } from '../lib/Contracts';
import { address, ContractCallOptions, Integer, TxResult } from '../types';

export class ExpiryProxy {
  private contracts: Contracts;

  constructor(contracts: Contracts) {
    this.contracts = contracts;
  }

  public get address(): address {
    return this.contracts.expiryProxy.options.address;
  }

  // ============ State-Changing Functions ============

  public async expire(
    accountOwner: address,
    accountNumber: Integer,
    liquidOwner: address,
    liquidNumber: Integer,
    owedMarket: Integer,
    heldMarket: Integer,
    expirationTimestamp: Integer,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.expiryProxy.methods.expire(
        {
          owner: accountOwner,
          number: accountNumber.toFixed(0),
        },
        {
          owner: liquidOwner,
          number: liquidNumber.toFixed(0),
        },
        owedMarket.toFixed(),
        heldMarket.toFixed(),
        expirationTimestamp.toFixed(),
      ),
      options,
    );
  }
}
