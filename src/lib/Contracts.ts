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

import BigNumber from 'bignumber.js';
import Web3 from 'web3';
import { Block, TransactionObject, Tx } from 'web3/eth/types';
import PromiEvent from 'web3/promiEvent';
import { Provider } from 'web3/providers';
import { TransactionReceipt } from 'web3/types';

// JSON
import aaveCopyCatAltCoinInterestSetterJson from '../../build/published_contracts/AAVECopyCatAltCoinInterestSetter.json';
import aaveCopyCatStableCoinInterestSetterJson from '../../build/published_contracts/AAVECopyCatStableCoinInterestSetter.json';
import accountOverrideSetterJson from '../../build/published_contracts/IAccountRiskOverrideSetter.json';
import arbitrumMultiCallJson from '../../build/published_contracts/ArbitrumMultiCall.json';
import ammRebalancerProxyV1Json from '../../build/published_contracts/AmmRebalancerProxyV1.json';
import ammRebalancerProxyV2Json from '../../build/published_contracts/AmmRebalancerProxyV2.json';
import arbitrumGasInfoJson from '../../build/published_contracts/IArbitrumGasInfo.json';
import chainlinkPriceOracleV1Json from '../../build/published_contracts/ChainlinkPriceOracleV1.json';
import dolomiteAmmFactoryJson from '../../build/published_contracts/DolomiteAmmFactory.json';
import dolomiteAmmPairJson from '../../build/published_contracts/DolomiteAmmPair.json';
import dolomiteAmmRouterProxyJson from '../../build/published_contracts/DolomiteAmmRouterProxy.json';
import borrowPositionProxyV1Json from '../../build/published_contracts/BorrowPositionProxyV1.json';
import borrowPositionProxyV2Json from '../../build/published_contracts/BorrowPositionProxyV2.json';
import depositProxyJson from '../../build/published_contracts/DepositWithdrawalProxy.json';
import dolomiteMarginJson from '../../build/published_contracts/DolomiteMargin.json';
import doubleExponentInterestSetterJson from '../../build/published_contracts/DoubleExponentInterestSetter.json';
import erc20Json from '../../build/published_contracts/IERC20Detailed.json';
import eventEmitterRegistryJson from '../../build/published_contracts/EventEmitterRegistry.json';
import expiryJson from '../../build/published_contracts/Expiry.json';
import expiryProxyJson from '../../build/published_contracts/ExpiryProxy.json';
import genericTraderProxyV1Json from '../../build/published_contracts/GenericTraderProxyV1.json';
import interestSetterJson from '../../build/published_contracts/IInterestSetter.json';
import isolationModeUnwrapperJson from '../../build/published_contracts/IIsolationModeUnwrapperTrader.json';
import isolationModeWrapperJson from '../../build/published_contracts/IIsolationModeWrapperTrader.json';
import liquidatorAssetRegistryJson from '../../build/published_contracts/LiquidatorAssetRegistry.json';
import liquidatorProxyV1Json from '../../build/published_contracts/LiquidatorProxyV1.json';
import liquidatorProxyV1WithAmmJson from '../../build/published_contracts/LiquidatorProxyV1WithAmm.json';
import liquidatorProxyV2WithExternalLiquidityJson from '../../build/published_contracts/LiquidatorProxyV2WithExternalLiquidity.json';
import liquidatorProxyV3WithLiquidityTokenJson from '../../build/published_contracts/LiquidatorProxyV3WithLiquidityToken.json';
import liquidatorProxyV4WithGenericTraderJson from '../../build/published_contracts/LiquidatorProxyV4WithGenericTrader.json';
import multiCallJson from '../../build/published_contracts/MultiCall.json';
import oracleSentinelJson from '../../build/published_contracts/IOracleSentinel.json';
import payableProxyJson from '../../build/published_contracts/PayableProxy.json';
import polynomialInterestSetterJson from '../../build/published_contracts/PolynomialInterestSetter.json';
import priceOracleJson from '../../build/published_contracts/IPriceOracle.json';
import signedOperationProxyJson from '../../build/published_contracts/SignedOperationProxy.json';
import simpleFeeOwnerJson from '../../build/published_contracts/SimpleFeeOwner.json';
import testUniswapAmmRebalancerJson from '../../build/published_contracts/TestUniswapAmmRebalancerProxy.json';
import transferProxyJson from '../../build/published_contracts/TransferProxy.json';
import wethJson from '../../build/published_contracts/WETH.json';

// Contracts
import { AAVECopyCatAltCoinInterestSetter } from '../../build/wrappers/AAVECopyCatAltCoinInterestSetter';
import { AAVECopyCatStableCoinInterestSetter } from '../../build/wrappers/AAVECopyCatStableCoinInterestSetter';
import { AmmRebalancerProxyV1 } from '../../build/wrappers/AmmRebalancerProxyV1';
import { AmmRebalancerProxyV2 } from '../../build/wrappers/AmmRebalancerProxyV2';
import { ArbitrumMultiCall } from '../../build/wrappers/ArbitrumMultiCall';
import { BorrowPositionProxyV1 } from '../../build/wrappers/BorrowPositionProxyV1';
import { BorrowPositionProxyV2 } from '../../build/wrappers/BorrowPositionProxyV2';
import { ChainlinkPriceOracleV1 } from '../../build/wrappers/ChainlinkPriceOracleV1';
import { DepositWithdrawalProxy } from '../../build/wrappers/DepositWithdrawalProxy';
import { DolomiteAmmFactory } from '../../build/wrappers/DolomiteAmmFactory';
import { DolomiteAmmPair } from '../../build/wrappers/DolomiteAmmPair';
import { DolomiteAmmRouterProxy } from '../../build/wrappers/DolomiteAmmRouterProxy';
import { DolomiteMargin } from '../../build/wrappers/DolomiteMargin';
import { DoubleExponentInterestSetter } from '../../build/wrappers/DoubleExponentInterestSetter';
import { EventEmitterRegistry } from '../../build/wrappers/EventEmitterRegistry';
import { Expiry } from '../../build/wrappers/Expiry';
import { ExpiryProxy } from '../../build/wrappers/ExpiryProxy';
import { GenericTraderProxyV1 } from '../../build/wrappers/GenericTraderProxyV1';
import { IAccountRiskOverrideSetter } from '../../build/wrappers/IAccountRiskOverrideSetter';
import { IArbitrumGasInfo } from '../../build/wrappers/IArbitrumGasInfo';
import { IERC20Detailed as ERC20 } from '../../build/wrappers/IERC20Detailed';
import { IInterestSetter as InterestSetter } from '../../build/wrappers/IInterestSetter';
import { IIsolationModeUnwrapperTrader } from '../../build/wrappers/IIsolationModeUnwrapperTrader';
import { IIsolationModeWrapperTrader } from '../../build/wrappers/IIsolationModeWrapperTrader';
import { IOracleSentinel } from '../../build/wrappers/IOracleSentinel';
import { IPriceOracle as PriceOracle } from '../../build/wrappers/IPriceOracle';
import { LiquidatorAssetRegistry } from '../../build/wrappers/LiquidatorAssetRegistry';
import { LiquidatorProxyV1 } from '../../build/wrappers/LiquidatorProxyV1';
import { LiquidatorProxyV1WithAmm } from '../../build/wrappers/LiquidatorProxyV1WithAmm';
import { LiquidatorProxyV2WithExternalLiquidity } from '../../build/wrappers/LiquidatorProxyV2WithExternalLiquidity';
import { LiquidatorProxyV3WithLiquidityToken } from '../../build/wrappers/LiquidatorProxyV3WithLiquidityToken';
import { LiquidatorProxyV4WithGenericTrader } from '../../build/wrappers/LiquidatorProxyV4WithGenericTrader';
import { MultiCall } from '../../build/wrappers/MultiCall';
import { PayableProxy as PayableProxy } from '../../build/wrappers/PayableProxy';
import { PolynomialInterestSetter } from '../../build/wrappers/PolynomialInterestSetter';
import { SignedOperationProxy } from '../../build/wrappers/SignedOperationProxy';
import { SimpleFeeOwner } from '../../build/wrappers/SimpleFeeOwner';
import { TestUniswapAmmRebalancerProxy } from '../../build/wrappers/TestUniswapAmmRebalancerProxy';
import { TransferProxy } from '../../build/wrappers/TransferProxy';
import { WETH } from '../../build/wrappers/WETH';
import {
  address,
  ConfirmationType,
  ContractCallOptions,
  ContractConstantCallOptions,
  DolomiteMarginOptions,
  TxResult,
} from '../types';

import { SUBTRACT_GAS_LIMIT } from './Constants';

interface CallableTransactionObject<T> {
  call(tx?: Tx, blockNumber?: number): Promise<T>;
}

export class Contracts {
  // Contract instances
  public aaveCopyCatAltCoinInterestSetter: AAVECopyCatAltCoinInterestSetter;
  public aaveCopyCatStableCoinInterestSetter: AAVECopyCatStableCoinInterestSetter;
  public ammRebalancerProxyV1: AmmRebalancerProxyV1;
  public ammRebalancerProxyV2: AmmRebalancerProxyV2;
  public arbitrumGasInfo: IArbitrumGasInfo;
  public arbitrumMultiCall: ArbitrumMultiCall;
  public borrowPositionProxyV1: BorrowPositionProxyV1;
  public borrowPositionProxyV2: BorrowPositionProxyV2;
  public chainlinkPriceOracleV1: ChainlinkPriceOracleV1;
  public depositProxy: DepositWithdrawalProxy;
  public dolomiteAmmRouterProxy: DolomiteAmmRouterProxy;
  public dolomiteAmmFactory: DolomiteAmmFactory;
  public dolomiteMargin: DolomiteMargin;
  public doubleExponentInterestSetter: DoubleExponentInterestSetter;
  public erc20: ERC20;
  public expiry: Expiry;
  public eventEmitterRegistry: EventEmitterRegistry;
  public expiryProxy: ExpiryProxy;
  public genericTraderProxyV1: GenericTraderProxyV1;
  public interestSetter: InterestSetter;
  public liquidatorAssetRegistry: LiquidatorAssetRegistry;
  public liquidatorProxyV1: LiquidatorProxyV1;
  public liquidatorProxyV1WithAmm: LiquidatorProxyV1WithAmm;
  public liquidatorProxyV2WithExternalLiquidity: LiquidatorProxyV2WithExternalLiquidity;
  public liquidatorProxyV3WithLiquidityToken: LiquidatorProxyV3WithLiquidityToken;
  public liquidatorProxyV4WithGenericTrader: LiquidatorProxyV4WithGenericTrader;
  public multiCall: MultiCall;
  public payableProxy: PayableProxy;
  public polynomialInterestSetter: PolynomialInterestSetter;
  public priceOracle: PriceOracle;
  public signedOperationProxy: SignedOperationProxy;
  public simpleFeeOwner: SimpleFeeOwner;
  public testUniswapAmmRebalancer: TestUniswapAmmRebalancerProxy;
  public transferProxy: TransferProxy;
  public weth: WETH;

  // protected field variables
  protected provider: Provider;
  protected web3: Web3;
  protected blockGasLimit: number;
  protected readonly autoGasMultiplier: number;
  protected readonly defaultConfirmations: number;
  protected readonly confirmationType: ConfirmationType;
  protected readonly defaultGas: string | number;
  protected readonly defaultGasPrice: string | number;

  constructor(provider: Provider, networkId: number, web3: Web3, options: DolomiteMarginOptions) {
    this.provider = provider;
    this.web3 = web3;
    this.defaultConfirmations = options.defaultConfirmations;
    this.autoGasMultiplier = options.autoGasMultiplier || 1.5;
    this.confirmationType = options.confirmationType || ConfirmationType.Confirmed;
    this.defaultGas = options.defaultGas;
    this.defaultGasPrice = options.defaultGasPrice;
    this.blockGasLimit = options.blockGasLimit;

    // Contracts
    this.aaveCopyCatAltCoinInterestSetter = new this.web3.eth.Contract(
      aaveCopyCatAltCoinInterestSetterJson.abi,
    ) as AAVECopyCatAltCoinInterestSetter;
    this.aaveCopyCatStableCoinInterestSetter = new this.web3.eth.Contract(
      aaveCopyCatStableCoinInterestSetterJson.abi,
    ) as AAVECopyCatStableCoinInterestSetter;
    this.ammRebalancerProxyV1 = new this.web3.eth.Contract(ammRebalancerProxyV1Json.abi) as AmmRebalancerProxyV1;
    this.ammRebalancerProxyV2 = new this.web3.eth.Contract(ammRebalancerProxyV2Json.abi) as AmmRebalancerProxyV2;
    this.arbitrumGasInfo = new this.web3.eth.Contract(arbitrumGasInfoJson.abi) as IArbitrumGasInfo;
    this.arbitrumMultiCall = new this.web3.eth.Contract(arbitrumMultiCallJson.abi) as ArbitrumMultiCall;
    this.borrowPositionProxyV1 = new this.web3.eth.Contract(borrowPositionProxyV1Json.abi) as BorrowPositionProxyV1;
    this.borrowPositionProxyV2 = new this.web3.eth.Contract(borrowPositionProxyV2Json.abi) as BorrowPositionProxyV2;
    this.chainlinkPriceOracleV1 = new this.web3.eth.Contract(chainlinkPriceOracleV1Json.abi) as ChainlinkPriceOracleV1;
    this.depositProxy = new this.web3.eth.Contract(depositProxyJson.abi) as DepositWithdrawalProxy;
    this.dolomiteAmmFactory = new this.web3.eth.Contract(dolomiteAmmFactoryJson.abi) as DolomiteAmmFactory;
    this.dolomiteAmmRouterProxy = new this.web3.eth.Contract(dolomiteAmmRouterProxyJson.abi) as DolomiteAmmRouterProxy;
    this.dolomiteMargin = new this.web3.eth.Contract(dolomiteMarginJson.abi) as DolomiteMargin;
    this.doubleExponentInterestSetter = new this.web3.eth.Contract(
      doubleExponentInterestSetterJson.abi,
    ) as DoubleExponentInterestSetter;
    this.erc20 = new this.web3.eth.Contract(erc20Json.abi) as ERC20;
    this.expiry = new this.web3.eth.Contract(expiryJson.abi) as Expiry;
    this.expiryProxy = new this.web3.eth.Contract(expiryProxyJson.abi) as ExpiryProxy;
    this.genericTraderProxyV1 = new this.web3.eth.Contract(genericTraderProxyV1Json.abi) as GenericTraderProxyV1;
    this.interestSetter = new this.web3.eth.Contract(interestSetterJson.abi) as InterestSetter;
    this.liquidatorAssetRegistry = new this.web3.eth.Contract(
      liquidatorAssetRegistryJson.abi,
    ) as LiquidatorAssetRegistry;
    this.liquidatorProxyV1 = new this.web3.eth.Contract(liquidatorProxyV1Json.abi) as LiquidatorProxyV1;
    this.liquidatorProxyV1WithAmm = new this.web3.eth.Contract(
      liquidatorProxyV1WithAmmJson.abi,
    ) as LiquidatorProxyV1WithAmm;
    this.liquidatorProxyV2WithExternalLiquidity = new this.web3.eth.Contract(
      liquidatorProxyV2WithExternalLiquidityJson.abi,
    ) as LiquidatorProxyV2WithExternalLiquidity;
    this.liquidatorProxyV3WithLiquidityToken = new this.web3.eth.Contract(
      liquidatorProxyV3WithLiquidityTokenJson.abi,
    ) as LiquidatorProxyV3WithLiquidityToken;
    this.liquidatorProxyV4WithGenericTrader = new this.web3.eth.Contract(
      liquidatorProxyV4WithGenericTraderJson.abi,
    ) as LiquidatorProxyV4WithGenericTrader;
    this.eventEmitterRegistry = new this.web3.eth.Contract(eventEmitterRegistryJson.abi) as EventEmitterRegistry;
    this.multiCall = new this.web3.eth.Contract(multiCallJson.abi) as MultiCall;
    this.payableProxy = new this.web3.eth.Contract(payableProxyJson.abi) as PayableProxy;
    this.polynomialInterestSetter = new this.web3.eth.Contract(
      polynomialInterestSetterJson.abi,
    ) as PolynomialInterestSetter;
    this.priceOracle = new this.web3.eth.Contract(priceOracleJson.abi) as PriceOracle;
    this.signedOperationProxy = new this.web3.eth.Contract(signedOperationProxyJson.abi) as SignedOperationProxy;
    this.simpleFeeOwner = new this.web3.eth.Contract(simpleFeeOwnerJson.abi) as SimpleFeeOwner;
    this.testUniswapAmmRebalancer = new this.web3.eth.Contract(
      testUniswapAmmRebalancerJson.abi,
    ) as TestUniswapAmmRebalancerProxy;
    this.transferProxy = new this.web3.eth.Contract(transferProxyJson.abi) as TransferProxy;
    this.weth = new this.web3.eth.Contract(wethJson.abi) as WETH;

    this.setProvider(provider, networkId);
    this.setDefaultAccount(this.web3.eth.defaultAccount);
  }

  public getDolomiteLpTokenAddress(tokenA: address, tokenB: address): Promise<string> {
    return this.dolomiteAmmFactory.methods.getPair(tokenA, tokenB).call();
  }

  public async getDolomiteAmmPairFromTokens(tokenA: address, tokenB: address): Promise<DolomiteAmmPair> {
    const contractAddress = await this.getDolomiteLpTokenAddress(tokenA, tokenB);
    return this.getDolomiteAmmPair(contractAddress);
  }

  public getDolomiteAmmPair(contractAddress: address): DolomiteAmmPair {
    const pair = new this.web3.eth.Contract(dolomiteAmmPairJson.abi, contractAddress) as DolomiteAmmPair;
    pair.setProvider(this.provider);
    pair.options.from = this.dolomiteMargin.options.from;
    return pair;
  }

  public getIsolationModeUnwrapper(contractAddress: address): IIsolationModeUnwrapperTrader {
    const unwrapper = new this.web3.eth.Contract(
      isolationModeUnwrapperJson.abi,
      contractAddress,
    ) as IIsolationModeUnwrapperTrader;
    unwrapper.setProvider(this.provider);
    unwrapper.options.from = this.dolomiteMargin.options.from;
    return unwrapper;
  }

  public getIsolationModeWrapper(contractAddress: address): IIsolationModeWrapperTrader {
    const unwrapper = new this.web3.eth.Contract(
      isolationModeWrapperJson.abi,
      contractAddress,
    ) as IIsolationModeWrapperTrader;
    unwrapper.setProvider(this.provider);
    unwrapper.options.from = this.dolomiteMargin.options.from;
    return unwrapper;
  }

  public getOracleSentinel(contractAddress: address): IOracleSentinel {
    const oracleSentinel = new this.web3.eth.Contract(oracleSentinelJson.abi, contractAddress) as IOracleSentinel;
    oracleSentinel.setProvider(this.provider);
    oracleSentinel.options.from = this.dolomiteMargin.options.from;
    return oracleSentinel;
  }

  public getAccountRiskOverrideSetter(contractAddress: address): IAccountRiskOverrideSetter {
    const accountRiskOverrideSetter = new this.web3.eth.Contract(
      accountOverrideSetterJson.abi,
      contractAddress,
    ) as IAccountRiskOverrideSetter;
    accountRiskOverrideSetter.setProvider(this.provider);
    accountRiskOverrideSetter.options.from = this.dolomiteMargin.options.from;
    return accountRiskOverrideSetter;
  }

  public setProvider(provider: Provider, networkId: number): void {
    this.dolomiteMargin.setProvider(provider);
    this.provider = provider;

    const contracts = [
      // contracts
      { contract: this.aaveCopyCatAltCoinInterestSetter, json: aaveCopyCatAltCoinInterestSetterJson },
      { contract: this.aaveCopyCatStableCoinInterestSetter, json: aaveCopyCatStableCoinInterestSetterJson },
      { contract: this.ammRebalancerProxyV1, json: ammRebalancerProxyV1Json },
      { contract: this.ammRebalancerProxyV2, json: ammRebalancerProxyV2Json },
      { contract: this.arbitrumGasInfo, json: arbitrumGasInfoJson },
      { contract: this.arbitrumMultiCall, json: arbitrumMultiCallJson },
      { contract: this.borrowPositionProxyV1, json: borrowPositionProxyV1Json },
      { contract: this.borrowPositionProxyV2, json: borrowPositionProxyV2Json },
      { contract: this.chainlinkPriceOracleV1, json: chainlinkPriceOracleV1Json },
      { contract: this.depositProxy, json: depositProxyJson },
      { contract: this.dolomiteAmmFactory, json: dolomiteAmmFactoryJson },
      { contract: this.dolomiteAmmRouterProxy, json: dolomiteAmmRouterProxyJson },
      { contract: this.dolomiteMargin, json: dolomiteMarginJson },
      { contract: this.doubleExponentInterestSetter, json: doubleExponentInterestSetterJson },
      { contract: this.erc20, json: erc20Json },
      { contract: this.eventEmitterRegistry, json: eventEmitterRegistryJson },
      { contract: this.expiry, json: expiryJson },
      { contract: this.expiryProxy, json: expiryProxyJson },
      { contract: this.genericTraderProxyV1, json: genericTraderProxyV1Json },
      { contract: this.interestSetter, json: interestSetterJson },
      { contract: this.liquidatorAssetRegistry, json: liquidatorAssetRegistryJson },
      { contract: this.liquidatorProxyV1, json: liquidatorProxyV1Json },
      { contract: this.liquidatorProxyV1WithAmm, json: liquidatorProxyV1WithAmmJson },
      { contract: this.liquidatorProxyV2WithExternalLiquidity, json: liquidatorProxyV2WithExternalLiquidityJson },
      { contract: this.liquidatorProxyV3WithLiquidityToken, json: liquidatorProxyV3WithLiquidityTokenJson },
      { contract: this.liquidatorProxyV4WithGenericTrader, json: liquidatorProxyV4WithGenericTraderJson },
      { contract: this.multiCall, json: multiCallJson },
      { contract: this.payableProxy, json: payableProxyJson },
      { contract: this.polynomialInterestSetter, json: polynomialInterestSetterJson },
      { contract: this.priceOracle, json: priceOracleJson },
      { contract: this.signedOperationProxy, json: signedOperationProxyJson },
      { contract: this.simpleFeeOwner, json: simpleFeeOwnerJson },
      { contract: this.testUniswapAmmRebalancer, json: testUniswapAmmRebalancerJson },
      { contract: this.transferProxy, json: transferProxyJson },
      { contract: this.weth, json: wethJson },
    ];

    contracts.forEach(contract => this.setContractProvider(contract.contract, contract.json, provider, networkId, {}));
  }

  public setDefaultAccount(account: address): void {
    // Contracts
    this.aaveCopyCatAltCoinInterestSetter.options.from = account;
    this.aaveCopyCatStableCoinInterestSetter.options.from = account;
    this.ammRebalancerProxyV1.options.from = account;
    this.ammRebalancerProxyV2.options.from = account;
    this.arbitrumGasInfo.options.from = account;
    this.arbitrumMultiCall.options.from = account;
    this.borrowPositionProxyV1.options.from = account;
    this.borrowPositionProxyV2.options.from = account;
    this.chainlinkPriceOracleV1.options.from = account;
    this.depositProxy.options.from = account;
    this.dolomiteAmmFactory.options.from = account;
    this.dolomiteAmmRouterProxy.options.from = account;
    this.dolomiteMargin.options.from = account;
    this.doubleExponentInterestSetter.options.from = account;
    this.erc20.options.from = account;
    this.eventEmitterRegistry.options.from = account;
    this.expiry.options.from = account;
    this.expiryProxy.options.from = account;
    this.genericTraderProxyV1.options.from = account;
    this.interestSetter.options.from = account;
    this.liquidatorAssetRegistry.options.from = account;
    this.liquidatorProxyV1.options.from = account;
    this.liquidatorProxyV1WithAmm.options.from = account;
    this.liquidatorProxyV2WithExternalLiquidity.options.from = account;
    this.liquidatorProxyV3WithLiquidityToken.options.from = account;
    this.liquidatorProxyV4WithGenericTrader.options.from = account;
    this.multiCall.options.from = account;
    this.payableProxy.options.from = account;
    this.polynomialInterestSetter.options.from = account;
    this.priceOracle.options.from = account;
    this.signedOperationProxy.options.from = account;
    this.simpleFeeOwner.options.from = account;
    this.testUniswapAmmRebalancer.options.from = account;
    this.transferProxy.options.from = account;
    this.weth.options.from = account;
  }

  public async callContractFunction<T>(
    method: TransactionObject<T>,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    const { confirmations, confirmationType, autoGasMultiplier, ...txOptions } = options;

    if (!this.blockGasLimit) {
      await this.setGasLimit();
    }

    if (!txOptions.gasPrice && this.defaultGasPrice) {
      txOptions.gasPrice = this.defaultGasPrice;
    }

    if (confirmationType === ConfirmationType.Simulate || !options.gas) {
      let gasEstimate: number;

      if (this.defaultGas && confirmationType !== ConfirmationType.Simulate) {
        txOptions.gas = this.defaultGas;
      } else {
        try {
          gasEstimate = await method.estimateGas(txOptions);
        } catch (error) {
          const data = method.encodeABI();
          const { from, value } = options;
          const to = (method as any)._parent._address;
          error.transactionData = { from, value, data, to };
          throw error;
        }

        const multiplier = autoGasMultiplier || this.autoGasMultiplier;
        const totalGas: number = Math.floor(gasEstimate * multiplier);
        txOptions.gas = totalGas < this.blockGasLimit ? totalGas : this.blockGasLimit;
      }

      if (confirmationType === ConfirmationType.Simulate) {
        return { gasEstimate, gas: Number(txOptions.gas) };
      }
    }

    if (txOptions.value) {
      txOptions.value = new BigNumber(txOptions.value).toFixed(0);
    } else {
      txOptions.value = '0';
    }

    const promi: PromiEvent<T> = method.send(txOptions);

    const OUTCOMES = {
      INITIAL: 0,
      RESOLVED: 1,
      REJECTED: 2,
    };

    let hashOutcome = OUTCOMES.INITIAL;
    let confirmationOutcome = OUTCOMES.INITIAL;

    const t = confirmationType !== undefined ? confirmationType : this.confirmationType;

    if (!Object.values(ConfirmationType).includes(t)) {
      throw new Error(`Invalid confirmation type: ${t}`);
    }

    let hashPromise: Promise<string>;
    let confirmationPromise: Promise<TransactionReceipt>;

    if (t === ConfirmationType.Hash || t === ConfirmationType.Both) {
      hashPromise = new Promise((resolve, reject) => {
        promi.on('error', (error: Error) => {
          if (hashOutcome === OUTCOMES.INITIAL) {
            hashOutcome = OUTCOMES.REJECTED;
            reject(error);
            const anyPromi = promi as any;
            anyPromi.off();
          }
        });

        promi.on('transactionHash', (txHash: string) => {
          if (hashOutcome === OUTCOMES.INITIAL) {
            hashOutcome = OUTCOMES.RESOLVED;
            resolve(txHash);
            if (t !== ConfirmationType.Both) {
              const anyPromi = promi as any;
              anyPromi.off();
            }
          }
        });
      });
    }

    if (t === ConfirmationType.Confirmed || t === ConfirmationType.Both) {
      confirmationPromise = new Promise((resolve, reject) => {
        promi.on('error', (error: Error) => {
          if (
            (t === ConfirmationType.Confirmed || hashOutcome === OUTCOMES.RESOLVED) &&
            confirmationOutcome === OUTCOMES.INITIAL
          ) {
            confirmationOutcome = OUTCOMES.REJECTED;
            reject(error);
            const anyPromi = promi as any;
            anyPromi.off();
          }
        });

        const desiredConf = confirmations || this.defaultConfirmations;
        if (desiredConf) {
          promi.on('confirmation', (confNumber: number, receipt: TransactionReceipt) => {
            if (confNumber >= desiredConf) {
              if (confirmationOutcome === OUTCOMES.INITIAL) {
                confirmationOutcome = OUTCOMES.RESOLVED;
                resolve(receipt);
                const anyPromi = promi as any;
                anyPromi.off();
              }
            }
          });
        } else {
          promi.on('receipt', (receipt: TransactionReceipt) => {
            confirmationOutcome = OUTCOMES.RESOLVED;
            resolve(receipt);
            const anyPromi = promi as any;
            anyPromi.off();
          });
        }
      });
    }

    if (t === ConfirmationType.Hash) {
      const transactionHash = await hashPromise;
      return { transactionHash };
    }

    if (t === ConfirmationType.Confirmed) {
      return confirmationPromise;
    }

    const transactionHash = await hashPromise;

    return {
      transactionHash,
      confirmation: confirmationPromise,
    };
  }

  public async callConstantContractFunction<T>(
    method: TransactionObject<T>,
    options: ContractConstantCallOptions = {},
  ): Promise<T> {
    const m2 = method as CallableTransactionObject<T>;
    const { blockNumber, ...txOptions } = options;
    return m2.call(txOptions, blockNumber);
  }

  protected setContractProvider(
    contract: any,
    contractJson: any,
    provider: Provider,
    networkId: number,
    overrides: any,
  ): void {
    contract.setProvider(provider);

    const contractAddress = contractJson.networks[networkId] && contractJson.networks[networkId].address;
    const overrideAddress = overrides && overrides[networkId];

    contract.options.address = overrideAddress || contractAddress;
  }

  private async setGasLimit(): Promise<void> {
    const block: Block = await this.web3.eth.getBlock('latest');
    this.blockGasLimit = block.gasLimit - SUBTRACT_GAS_LIMIT;
  }
}
