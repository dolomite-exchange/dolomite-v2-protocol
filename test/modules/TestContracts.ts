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

import { Provider } from 'web3/providers';
import Web3 from 'web3';

// Contracts
import { TestDolomiteMargin } from '../../build/testing_wrappers/TestDolomiteMargin';
import { TestToken } from '../../build/testing_wrappers/TestToken';
import { TestDolomiteAmmLibrary } from '../../build/testing_wrappers/TestDolomiteAmmLibrary';
import { TestLib } from '../../build/testing_wrappers/TestLib';
import { TestAutoTrader } from '../../build/testing_wrappers/TestAutoTrader';
import { TestCallee } from '../../build/testing_wrappers/TestCallee';
import { TestSimpleCallee } from '../../build/testing_wrappers/TestSimpleCallee';
import { TestExchangeWrapper } from '../../build/testing_wrappers/TestExchangeWrapper';
import { TestPriceOracle } from '../../build/testing_wrappers/TestPriceOracle';
import { TestInterestSetter } from '../../build/testing_wrappers/TestInterestSetter';
import { TestPolynomialInterestSetter } from '../../build/testing_wrappers/TestPolynomialInterestSetter';
import { TestDoubleExponentInterestSetter } from '../../build/testing_wrappers/TestDoubleExponentInterestSetter';
import { TestParaswapAugustusRouter } from '../../build/testing_wrappers/TestParaswapAugustusRouter';

// JSON
import testDolomiteMarginJson from '../../build/testing_contracts/TestDolomiteMargin.json';
import tokenAJson from '../../build/testing_contracts/TokenA.json';
import tokenBJson from '../../build/testing_contracts/TokenB.json';
import tokenCJson from '../../build/testing_contracts/TokenC.json';
import tokenDJson from '../../build/testing_contracts/TokenD.json';
import tokenEJson from '../../build/testing_contracts/TokenE.json';
import tokenFJson from '../../build/testing_contracts/TokenF.json';
import erroringTokenJson from '../../build/testing_contracts/ErroringToken.json';
import omiseTokenJson from '../../build/testing_contracts/OmiseToken.json';
import malformedTokenJson from '../../build/testing_contracts/MalformedToken.json';
import testDolomiteAmmLibraryJson from '../../build/testing_contracts/TestDolomiteAmmLibrary.json';
import testLibJson from '../../build/testing_contracts/TestLib.json';
import testAutoTraderJson from '../../build/testing_contracts/TestAutoTrader.json';
import testCalleeJson from '../../build/testing_contracts/TestCallee.json';
import testSimpleCalleeJson from '../../build/testing_contracts/TestSimpleCallee.json';
import testExchangeWrapperJson from '../../build/testing_contracts/TestExchangeWrapper.json';
import testPriceOracleJson from '../../build/testing_contracts/TestPriceOracle.json';
import testPolynomialInterestSetterJson from '../../build/testing_contracts/TestPolynomialInterestSetter.json';
import testDoubleExponentInterestSetterJson from '../../build/testing_contracts/TestDoubleExponentInterestSetter.json';
import testInterestSetterJson from '../../build/testing_contracts/TestInterestSetter.json';
import testUniswapV2PairJson from '../../build/testing_contracts/UniswapV2Pair.json';
import testUniswapV2RouterJson from '../../build/testing_contracts/UniswapV2Router02.json';
import testUniswapV2FactoryJson from '../../build/testing_contracts/UniswapV2Factory.json';
import testAmmRebalancerProxyJson from '../../build/testing_contracts/TestAmmRebalancerProxy.json';
import testUniswapV3MultiRouterJson from '../../build/testing_contracts/TestUniswapV3MultiRouter.json';
import testChainlinkFlagsJson from '../../build/testing_contracts/TestChainlinkFlags.json';
import testChainlinkPriceOracleJson from '../../build/testing_contracts/TestChainlinkPriceOracleV1.json';
import testParaswapAugustusRouterJson from '../../build/testing_contracts/TestParaswapAugustusRouter.json';
import testLiquidityTokenUnwrapperForLiquidationJson from '../../build/testing_contracts/TestLiquidityTokenUnwrapperForLiquidation.json';

import { address, DolomiteMarginOptions } from '../../src';
import { Contracts } from '../../src/lib/Contracts';
import { UniswapV2Factory } from '../../build/testing_wrappers/UniswapV2Factory';
import { UniswapV2Router02 } from '../../build/testing_wrappers/UniswapV2Router02';
import { UniswapV2Pair } from '../../build/testing_wrappers/UniswapV2Pair';
import { TestAmmRebalancerProxy } from '../../build/testing_wrappers/TestAmmRebalancerProxy';
import { TestUniswapV3MultiRouter } from '../../build/testing_wrappers/TestUniswapV3MultiRouter';
import { TestChainlinkFlags } from '../../build/testing_wrappers/TestChainlinkFlags';
import { ChainlinkPriceOracleV1 } from '../../build/wrappers/ChainlinkPriceOracleV1';
import {
  TestLiquidityTokenUnwrapperForLiquidation
} from '../../build/testing_wrappers/TestLiquidityTokenUnwrapperForLiquidation';

export class TestContracts extends Contracts {
  // Contract instances
  public dolomiteMargin: TestDolomiteMargin;

  // Testing contract instances
  public testDolomiteMargin: TestDolomiteMargin;
  public tokenA: TestToken;
  public tokenB: TestToken;
  public tokenC: TestToken;
  public tokenD: TestToken;
  public tokenE: TestToken;
  public tokenF: TestToken;
  public erroringToken: TestToken;
  public malformedToken: TestToken;
  public omiseToken: TestToken;
  public testAmmRebalancerProxy: TestAmmRebalancerProxy;
  public testLib: TestLib;
  public testDolomiteAmmLibrary: TestDolomiteAmmLibrary;
  public testAutoTrader: TestAutoTrader;
  public testCallee: TestCallee;
  public testSimpleCallee: TestSimpleCallee;
  public testExchangeWrapper: TestExchangeWrapper;
  public testPriceOracle: TestPriceOracle;
  public testPolynomialInterestSetter: TestPolynomialInterestSetter;
  public testDoubleExponentInterestSetter: TestDoubleExponentInterestSetter;
  public testInterestSetter: TestInterestSetter;
  public testUniswapV2Factory: UniswapV2Factory;
  public testUniswapV2Router: UniswapV2Router02;
  public testUniswapV3MultiRouter: TestUniswapV3MultiRouter;
  public testChainlinkFlags: TestChainlinkFlags;
  public testParaswapAugustusRouter: TestParaswapAugustusRouter;
  public testLiquidityTokenUnwrapperForLiquidation: TestLiquidityTokenUnwrapperForLiquidation;

  constructor(
    provider: Provider,
    networkId: number,
    web3: Web3,
    options: DolomiteMarginOptions,
  ) {
    super(provider, networkId, web3, options);

    // Testing Contracts
    this.testDolomiteMargin = new this.web3.eth.Contract(
      testDolomiteMarginJson.abi,
    ) as TestDolomiteMargin;
    this.dolomiteMargin = this.testDolomiteMargin;
    this.tokenA = new this.web3.eth.Contract(tokenAJson.abi) as TestToken;
    this.tokenB = new this.web3.eth.Contract(tokenBJson.abi) as TestToken;
    this.tokenC = new this.web3.eth.Contract(tokenCJson.abi) as TestToken;
    this.tokenD = new this.web3.eth.Contract(tokenDJson.abi) as TestToken;
    this.tokenE = new this.web3.eth.Contract(tokenEJson.abi) as TestToken;
    this.tokenF = new this.web3.eth.Contract(tokenFJson.abi) as TestToken;
    this.erroringToken = new this.web3.eth.Contract(erroringTokenJson.abi) as TestToken;
    this.malformedToken = new this.web3.eth.Contract(malformedTokenJson.abi) as TestToken;
    this.omiseToken = new this.web3.eth.Contract(omiseTokenJson.abi) as TestToken;
    this.testAmmRebalancerProxy = new this.web3.eth.Contract(
      testAmmRebalancerProxyJson.abi,
    ) as TestAmmRebalancerProxy;
    this.testDolomiteAmmLibrary = new this.web3.eth.Contract(testDolomiteAmmLibraryJson.abi) as TestDolomiteAmmLibrary;
    this.testLib = new this.web3.eth.Contract(testLibJson.abi) as TestLib;
    this.testAutoTrader = new this.web3.eth.Contract(
      testAutoTraderJson.abi,
    ) as TestAutoTrader;
    this.testCallee = new this.web3.eth.Contract(
      testCalleeJson.abi,
    ) as TestCallee;
    this.testSimpleCallee = new this.web3.eth.Contract(
      testSimpleCalleeJson.abi,
    ) as TestSimpleCallee;
    this.testExchangeWrapper = new this.web3.eth.Contract(
      testExchangeWrapperJson.abi,
    ) as TestExchangeWrapper;
    this.testPriceOracle = new this.web3.eth.Contract(
      testPriceOracleJson.abi,
    ) as TestPriceOracle;
    this.testInterestSetter = new this.web3.eth.Contract(
      testInterestSetterJson.abi,
    ) as TestInterestSetter;
    this.testPolynomialInterestSetter = new this.web3.eth.Contract(
      testPolynomialInterestSetterJson.abi,
    ) as TestPolynomialInterestSetter;
    this.testDoubleExponentInterestSetter = new this.web3.eth.Contract(
      testDoubleExponentInterestSetterJson.abi,
    ) as TestDoubleExponentInterestSetter;
    this.testUniswapV2Factory = new this.web3.eth.Contract(
      testUniswapV2FactoryJson.abi,
    ) as UniswapV2Factory;
    this.testUniswapV2Router = new this.web3.eth.Contract(
      testUniswapV2RouterJson.abi,
    ) as UniswapV2Router02;
    this.testUniswapV3MultiRouter = new this.web3.eth.Contract(
      testUniswapV3MultiRouterJson.abi,
    ) as TestUniswapV3MultiRouter;
    this.chainlinkPriceOracleV1 = new this.web3.eth.Contract(
      testChainlinkPriceOracleJson.abi
    ) as ChainlinkPriceOracleV1;
    this.testChainlinkFlags = new this.web3.eth.Contract(
      testChainlinkFlagsJson.abi,
    ) as TestChainlinkFlags;
    this.testParaswapAugustusRouter = new this.web3.eth.Contract(
      testParaswapAugustusRouterJson.abi,
    ) as TestParaswapAugustusRouter;
    this.testLiquidityTokenUnwrapperForLiquidation = new this.web3.eth.Contract(
      testLiquidityTokenUnwrapperForLiquidationJson.abi,
    ) as TestLiquidityTokenUnwrapperForLiquidation;

    this.setProvider(provider, networkId);
    this.setDefaultAccount(this.web3.eth.defaultAccount);
  }

  public async getUniswapV2PairByTokens(
    tokenA: address,
    tokenB: address,
  ): Promise<UniswapV2Pair> {
    const pairAddress = await this.testUniswapV2Factory.methods
      .getPair(tokenA, tokenB)
      .call();
    const pair = new this.web3.eth.Contract(
      testUniswapV2PairJson.abi,
      pairAddress,
    ) as UniswapV2Pair;
    pair.options.from = this.testUniswapV2Factory.options.from;
    return pair;
  }

  public setProvider(provider: Provider, networkId: number): void {
    super.setProvider(provider, networkId);

    // do not continue if not initialized
    if (!this.tokenA) {
      return;
    }

    this.dolomiteMargin.setProvider(provider);

    const contracts = [
      // test contracts
      { contract: this.testDolomiteMargin, json: testDolomiteMarginJson },
      { contract: this.tokenA, json: tokenAJson },
      { contract: this.tokenB, json: tokenBJson },
      { contract: this.tokenC, json: tokenCJson },
      { contract: this.tokenD, json: tokenDJson },
      { contract: this.tokenE, json: tokenEJson },
      { contract: this.tokenF, json: tokenFJson },
      { contract: this.erroringToken, json: erroringTokenJson },
      { contract: this.malformedToken, json: malformedTokenJson },
      { contract: this.omiseToken, json: omiseTokenJson },
      { contract: this.testAmmRebalancerProxy, json: testAmmRebalancerProxyJson, },
      { contract: this.testDolomiteAmmLibrary, json: testDolomiteAmmLibraryJson },
      { contract: this.testLib, json: testLibJson },
      { contract: this.testAutoTrader, json: testAutoTraderJson },
      { contract: this.testCallee, json: testCalleeJson },
      { contract: this.testSimpleCallee, json: testSimpleCalleeJson },
      { contract: this.testExchangeWrapper, json: testExchangeWrapperJson },
      { contract: this.testPriceOracle, json: testPriceOracleJson },
      {
        contract: this.testPolynomialInterestSetter,
        json: testPolynomialInterestSetterJson,
      },
      {
        contract: this.testDoubleExponentInterestSetter,
        json: testDoubleExponentInterestSetterJson,
      },
      { contract: this.testInterestSetter, json: testInterestSetterJson },
      { contract: this.testUniswapV2Factory, json: testUniswapV2FactoryJson },
      { contract: this.testUniswapV2Router, json: testUniswapV2RouterJson },
      { contract: this.testUniswapV3MultiRouter, json: testUniswapV3MultiRouterJson },
      { contract: this.testChainlinkFlags, json: testChainlinkFlagsJson },
      { contract: this.chainlinkPriceOracleV1, json: testChainlinkPriceOracleJson },
      { contract: this.testParaswapAugustusRouter, json: testParaswapAugustusRouterJson },
      { contract: this.testLiquidityTokenUnwrapperForLiquidation, json: testLiquidityTokenUnwrapperForLiquidationJson },
    ];

    contracts.forEach(contract =>
      this.setContractProvider(
        contract.contract,
        contract.json,
        provider,
        networkId,
        null,
      ),
    );
  }

  public setDefaultAccount(account: address): void {
    super.setDefaultAccount(account);

    // do not continue if not initialized
    if (!this.tokenA) {
      return;
    }

    // Test Contracts
    this.tokenA.options.from = account;
    this.tokenB.options.from = account;
    this.tokenC.options.from = account;
    this.tokenD.options.from = account;
    this.tokenE.options.from = account;
    this.tokenF.options.from = account;
    this.erroringToken.options.from = account;
    this.malformedToken.options.from = account;
    this.omiseToken.options.from = account;
    this.testAmmRebalancerProxy.options.from = account;
    this.testDolomiteAmmLibrary.options.from = account;
    this.testLib.options.from = account;
    this.testAutoTrader.options.from = account;
    this.testCallee.options.from = account;
    this.testSimpleCallee.options.from = account;
    this.testExchangeWrapper.options.from = account;
    this.testPriceOracle.options.from = account;
    this.testPolynomialInterestSetter.options.from = account;
    this.testDoubleExponentInterestSetter.options.from = account;
    this.testInterestSetter.options.from = account;
    this.testUniswapV2Factory.options.from = account;
    this.testUniswapV2Router.options.from = account;
    this.testUniswapV3MultiRouter.options.from = account;
    this.testChainlinkFlags.options.from = account;
    this.testParaswapAugustusRouter.options.from = account;
    this.testLiquidityTokenUnwrapperForLiquidation.options.from = account;
  }

  public getDefaultGasLimit(): string | number {
    return this.defaultGas;
  }

  public getDefaultGasPrice(): string | number {
    return this.defaultGasPrice;
  }
}
