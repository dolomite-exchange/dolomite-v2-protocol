/*

    Copyright 2019 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

import Web3 from 'web3';
import { Provider } from 'web3/providers';
import { Contracts } from './lib/Contracts';
import { Interest } from './lib/Interest';
import { Admin } from './modules/Admin';
import { AmmRebalancerProxyV1 } from './modules/AmmRebalancerProxyV1';
import { AmmRebalancerProxyV2 } from './modules/AmmRebalancerProxyV2';
import { ArbitrumGasInfo } from './modules/ArbitrumGasInfo';
import { BorrowPositionProxyV1 } from './modules/BorrowPositionProxyV1';
import { BorrowPositionProxyV2 } from './modules/BorrowPositionProxyV2';
import { DepositProxy } from './modules/DepositProxy';
import { DolomiteAmmFactory } from './modules/DolomiteAmmFactory';
import { DolomiteAmmPair } from './modules/DolomiteAmmPair';
import { DolomiteAmmRouterProxy } from './modules/DolomiteAmmRouterProxy';
import { Expiry } from './modules/Expiry';
import { GenericTraderProxyV1 } from './modules/GenericTraderProxyV1';
import { Getters } from './modules/Getters';
import { LiquidatorAssetRegistry } from './modules/LiquidatorAssetRegistry';
import { LiquidatorProxyV1 } from './modules/LiquidatorProxyV1';
import { LiquidatorProxyV1WithAmm } from './modules/LiquidatorProxyV1WithAmm';
import { LiquidatorProxyV2WithExternalLiquidity } from './modules/LiquidatorProxyV2WithExternalLiquidity';
import { LiquidatorProxyV3WithLiquidityToken } from './modules/LiquidatorProxyV3WithLiquidityToken';
import { LiquidatorProxyV4WithGenericTrader } from './modules/LiquidatorProxyV4WithGenericTrader';
import { LiquidityTokenUnwrapper } from './modules/LiquidityTokenUnwrapper';
import { Logs } from './modules/Logs';
import { MultiCall } from './modules/MultiCall';
import { Operation } from './modules/operate/Operation';
import { ChainlinkPriceOracleV1 } from './modules/oracles/ChainlinkPriceOracleV1';
import { OrderMapper } from './modules/OrderMapper';
import { Permissions } from './modules/Permissions';
import { SignedOperations } from './modules/SignedOperations';
import { StandardActions } from './modules/StandardActions';
import { SubgraphAPI } from './modules/SubgraphAPI';
import { Token } from './modules/Token';
import { TransferProxy } from './modules/TransferProxy';
import { WalletLogin } from './modules/WalletLogin';
import { WETH } from './modules/WETH';
import { address, DolomiteMarginOptions, EthereumAccount, Networks } from './types';

export class DolomiteMargin {
  public networkId: number;
  public web3: Web3;
  // Contract Wrappers
  public arbitrumGasInfo: ArbitrumGasInfo;
  public admin: Admin;
  public borrowPositionProxyV1: BorrowPositionProxyV1;
  public borrowPositionProxyV2: BorrowPositionProxyV2;
  public ammRebalancerProxyV1: AmmRebalancerProxyV1;
  public ammRebalancerProxyV2: AmmRebalancerProxyV2;
  public api: SubgraphAPI;
  public chainlinkPriceOracle: ChainlinkPriceOracleV1;
  public contracts: Contracts;
  public depositWithdrawalProxy: DepositProxy;
  public dolomiteAmmFactory: DolomiteAmmFactory;
  public dolomiteAmmRouterProxy: DolomiteAmmRouterProxy;
  public expiry: Expiry;
  public genericTraderProxyV1: GenericTraderProxyV1;
  public getters: Getters;
  public interest: Interest;
  public liquidatorAssetRegistry: LiquidatorAssetRegistry;
  public liquidatorProxyV1: LiquidatorProxyV1;
  public liquidatorProxyV1WithAmm: LiquidatorProxyV1WithAmm;
  public liquidatorProxyV2WithExternalLiquidity: LiquidatorProxyV2WithExternalLiquidity;
  public liquidatorProxyV3WithLiquidityToken: LiquidatorProxyV3WithLiquidityToken;
  public liquidatorProxyV4WithGenericTrader: LiquidatorProxyV4WithGenericTrader;
  public logs: Logs;
  public multiCall: MultiCall;
  public operation: Operation;
  public permissions: Permissions;
  public signedOperations: SignedOperations;
  public standardActions: StandardActions;
  public token: Token;
  public transferProxy: TransferProxy;
  public walletLogin: WalletLogin;
  public weth: WETH;

  constructor(provider: Provider | string, networkId: number = Networks.ARBITRUM, options: DolomiteMarginOptions = {}) {
    let realProvider: Provider;
    if (typeof provider === 'string') {
      realProvider = new Web3.providers.HttpProvider(provider, options.ethereumNodeTimeout || 10000);
    } else {
      realProvider = provider;
    }

    this.web3 = new Web3(realProvider);
    if (options.defaultAccount) {
      this.web3.eth.defaultAccount = options.defaultAccount;
    }
    this.contracts = this.createContractsModule(realProvider, networkId, this.web3, options);

    this.admin = new Admin(this.contracts);
    this.ammRebalancerProxyV1 = new AmmRebalancerProxyV1(this.contracts);
    this.ammRebalancerProxyV2 = new AmmRebalancerProxyV2(this.contracts);
    this.arbitrumGasInfo = new ArbitrumGasInfo(this.contracts);
    this.borrowPositionProxyV1 = new BorrowPositionProxyV1(this.contracts);
    this.borrowPositionProxyV2 = new BorrowPositionProxyV2(this.contracts);
    this.chainlinkPriceOracle = new ChainlinkPriceOracleV1(this.contracts);
    this.depositWithdrawalProxy = new DepositProxy(this.contracts);
    this.dolomiteAmmFactory = new DolomiteAmmFactory(this.contracts);
    this.dolomiteAmmRouterProxy = new DolomiteAmmRouterProxy(this.contracts);
    this.expiry = new Expiry(this.contracts);
    this.genericTraderProxyV1 = new GenericTraderProxyV1(this.contracts);
    this.getters = new Getters(this.contracts);
    this.interest = new Interest(networkId);
    this.liquidatorAssetRegistry = new LiquidatorAssetRegistry(this.contracts);
    this.liquidatorProxyV1 = new LiquidatorProxyV1(this.contracts);
    this.liquidatorProxyV1WithAmm = new LiquidatorProxyV1WithAmm(this.contracts);
    this.liquidatorProxyV2WithExternalLiquidity = new LiquidatorProxyV2WithExternalLiquidity(this.contracts);
    this.liquidatorProxyV3WithLiquidityToken = new LiquidatorProxyV3WithLiquidityToken(this.contracts);
    this.liquidatorProxyV4WithGenericTrader = new LiquidatorProxyV4WithGenericTrader(this.contracts);
    this.logs = new Logs(this.contracts, this.web3);
    this.multiCall = new MultiCall(this.contracts);
    this.networkId = networkId;
    this.operation = new Operation(this.contracts, new OrderMapper(this.contracts), networkId);
    this.permissions = new Permissions(this.contracts);
    this.signedOperations = new SignedOperations(this.contracts, this.web3, networkId);
    this.standardActions = new StandardActions(this.operation, this.contracts);
    this.token = new Token(this.contracts);
    this.transferProxy = new TransferProxy(this.contracts);
    this.walletLogin = new WalletLogin(this.web3, networkId);
    this.weth = new WETH(this.contracts, this.token);

    if (options.accounts) {
      options.accounts.forEach(a => this.loadAccount(a));
    }
  }

  /**
   * @return The address of the main DolomiteMargin smart contract
   */
  public get address(): address {
    return this.contracts.dolomiteMargin.options.address;
  }

  public setProvider(provider: Provider, networkId: number): void {
    this.web3.setProvider(provider);
    this.contracts.setProvider(provider, networkId);
    this.interest.setNetworkId(networkId);
  }

  public setDefaultAccount(account: address): void {
    this.web3.eth.defaultAccount = account;
    this.contracts.setDefaultAccount(account);
  }

  public getDefaultAccount(): address {
    return this.web3.eth.defaultAccount;
  }

  // ============ Helper Functions ============

  public loadAccount(account: EthereumAccount): void {
    const newAccount = this.web3.eth.accounts.wallet.add(account.privateKey);

    if (!newAccount || (account.address && account.address.toLowerCase() !== newAccount.address.toLowerCase())) {
      throw new Error(`Loaded account address mismatch.
        Expected ${account.address}, got ${newAccount ? newAccount.address : null}`);
    }
  }

  getDolomiteAmmPair(pairAddress: address): DolomiteAmmPair {
    return new DolomiteAmmPair(this.contracts, this.contracts.getDolomiteAmmPair(pairAddress));
  }

  getTokenUnwrapper(unwrapperAddress: address): LiquidityTokenUnwrapper {
    return new LiquidityTokenUnwrapper(this.contracts, this.contracts.getTokenUnwrapper(unwrapperAddress));
  }

  protected createContractsModule(
    provider: Provider,
    networkId: number,
    web3: Web3,
    options: DolomiteMarginOptions,
  ): any {
    return new Contracts(provider, networkId, web3, options);
  }
}
