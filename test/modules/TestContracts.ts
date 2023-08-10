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

// JSON - Contracts
import alwaysOnlineOracleSentinelJson from '../../build/published_contracts/AlwaysOnlineOracleSentinel.json';
import chainlinkOracleSentinelJson from '../../build/published_contracts/ChainlinkOracleSentinel.json';
import erroringTokenJson from '../../build/testing_contracts/ErroringToken.json';
import malformedTokenJson from '../../build/testing_contracts/MalformedToken.json';
import omiseTokenJson from '../../build/testing_contracts/OmiseToken.json';
import testAccountRiskOverrideSetterJson from '../../build/testing_contracts/TestAccountRiskOverrideSetter.json';
import testAmmRebalancerProxyJson from '../../build/testing_contracts/TestAmmRebalancerProxy.json';
import testAutoTraderJson from '../../build/testing_contracts/TestAutoTrader.json';
import testCalleeJson from '../../build/testing_contracts/TestCallee.json';
import testChainlinkPriceAggregatorJson from '../../build/testing_contracts/TestChainlinkAggregator.json';
import testChainlinkPriceOracleJson from '../../build/testing_contracts/TestChainlinkPriceOracleV1.json';
import testDolomiteAmmLibraryJson from '../../build/testing_contracts/TestDolomiteAmmLibrary.json';
import testDolomiteMarginJson from '../../build/testing_contracts/TestDolomiteMargin.json';
import testDoubleExponentInterestSetterJson from '../../build/testing_contracts/TestDoubleExponentInterestSetter.json';
import testExchangeWrapperJson from '../../build/testing_contracts/TestExchangeWrapper.json';
import testInterestSetterJson from '../../build/testing_contracts/TestInterestSetter.json';
import testLibJson from '../../build/testing_contracts/TestLib.json';
import testParaswapAugustusRouterJson from '../../build/testing_contracts/TestParaswapAugustusRouter.json';
import testParaswapTraderJson from '../../build/testing_contracts/TestParaswapTrader.json';
import testPolynomialInterestSetterJson from '../../build/testing_contracts/TestPolynomialInterestSetter.json';
import testPriceOracleJson from '../../build/testing_contracts/TestPriceOracle.json';
import testSequencerUptimeFeedAggregatorJson from '../../build/testing_contracts/TestSequencerUptimeFeedAggregator.json';
import testSimpleCalleeJson from '../../build/testing_contracts/TestSimpleCallee.json';
import testUniswapV3MultiRouterJson from '../../build/testing_contracts/TestUniswapV3MultiRouter.json';
import testWeth from '../../build/testing_contracts/TestWETH.json';

// JSON - Tokens
import tokenAJson from '../../build/testing_contracts/TokenA.json';
import tokenBJson from '../../build/testing_contracts/TokenB.json';
import tokenCJson from '../../build/testing_contracts/TokenC.json';
import tokenDJson from '../../build/testing_contracts/TokenD.json';
import tokenEJson from '../../build/testing_contracts/TokenE.json';
import tokenFJson from '../../build/testing_contracts/TokenF.json';
import testUniswapV2FactoryJson from '../../build/testing_contracts/UniswapV2Factory.json';
import testUniswapV2PairJson from '../../build/testing_contracts/UniswapV2Pair.json';
import testUniswapV2RouterJson from '../../build/testing_contracts/UniswapV2Router02.json';
import { TestAccountRiskOverrideSetter } from '../../build/testing_wrappers/TestAccountRiskOverrideSetter';
import { TestAmmRebalancerProxy } from '../../build/testing_wrappers/TestAmmRebalancerProxy';
import { TestAutoTrader } from '../../build/testing_wrappers/TestAutoTrader';
import { TestCallee } from '../../build/testing_wrappers/TestCallee';
import { TestChainlinkAggregator } from '../../build/testing_wrappers/TestChainlinkAggregator';
import { TestChainlinkPriceOracleV1 } from '../../build/testing_wrappers/TestChainlinkPriceOracleV1';
import { TestDolomiteAmmLibrary } from '../../build/testing_wrappers/TestDolomiteAmmLibrary';
import { TestDolomiteMargin } from '../../build/testing_wrappers/TestDolomiteMargin';
import { TestDoubleExponentInterestSetter } from '../../build/testing_wrappers/TestDoubleExponentInterestSetter';
import { TestExchangeWrapper } from '../../build/testing_wrappers/TestExchangeWrapper';
import { TestInterestSetter } from '../../build/testing_wrappers/TestInterestSetter';
import { TestLib } from '../../build/testing_wrappers/TestLib';
import { TestParaswapAugustusRouter } from '../../build/testing_wrappers/TestParaswapAugustusRouter';
import { TestParaswapTrader } from '../../build/testing_wrappers/TestParaswapTrader';
import { TestPolynomialInterestSetter } from '../../build/testing_wrappers/TestPolynomialInterestSetter';
import { TestPriceOracle } from '../../build/testing_wrappers/TestPriceOracle';
import { TestSequencerUptimeFeedAggregator } from '../../build/testing_wrappers/TestSequencerUptimeFeedAggregator';
import { TestSimpleCallee } from '../../build/testing_wrappers/TestSimpleCallee';
import { TestToken } from '../../build/testing_wrappers/TestToken';
import { TestUniswapV3MultiRouter } from '../../build/testing_wrappers/TestUniswapV3MultiRouter';
import { TestWETH } from '../../build/testing_wrappers/TestWETH';
import { UniswapV2Factory } from '../../build/testing_wrappers/UniswapV2Factory';
import { UniswapV2Pair } from '../../build/testing_wrappers/UniswapV2Pair';
import { UniswapV2Router02 } from '../../build/testing_wrappers/UniswapV2Router02';

// Contracts
import { IOracleSentinel } from '../../build/wrappers/IOracleSentinel';

import { address, DolomiteMarginOptions } from '../../src';
import { Contracts } from '../../src/lib/Contracts';

export class TestContracts extends Contracts {
  // Contract instances
  public dolomiteMargin: TestDolomiteMargin;

  // Testing tokens
  public tokenA: TestToken;
  public tokenB: TestToken;
  public tokenC: TestToken;
  public tokenD: TestToken;
  public tokenE: TestToken;
  public tokenF: TestToken;
  public erroringToken: TestToken;
  public malformedToken: TestToken;
  public omiseToken: TestToken;

  // Testing contract instances
  public alwaysOnlineOracleSentinel: IOracleSentinel;
  public chainlinkOracleSentinel: IOracleSentinel;
  public testAccountRiskOverrideSetter: TestAccountRiskOverrideSetter;
  public testAmmRebalancerProxy: TestAmmRebalancerProxy;
  public testAutoTrader: TestAutoTrader;
  public testCallee: TestCallee;
  public testChainlinkPriceAggregator: TestChainlinkAggregator;
  public testDolomiteAmmLibrary: TestDolomiteAmmLibrary;
  public testDolomiteMargin: TestDolomiteMargin;
  public testInterestSetter: TestInterestSetter;
  public testLib: TestLib;
  public testDoubleExponentInterestSetter: TestDoubleExponentInterestSetter;
  public testExchangeWrapper: TestExchangeWrapper;
  public testParaswapAugustusRouter: TestParaswapAugustusRouter;
  public testParaswapTrader: TestParaswapTrader;
  public testPolynomialInterestSetter: TestPolynomialInterestSetter;
  public testPriceOracle: TestPriceOracle;
  public testSequencerUptimeFeedAggregator: TestSequencerUptimeFeedAggregator;
  public testSimpleCallee: TestSimpleCallee;
  public testUniswapV2Factory: UniswapV2Factory;
  public testUniswapV3MultiRouter: TestUniswapV3MultiRouter;
  public testUniswapV2Router: UniswapV2Router02;

  constructor(provider: Provider, networkId: number, web3: Web3, options: DolomiteMarginOptions) {
    super(provider, networkId, web3, options);

    // Token instances
    this.tokenA = new this.web3.eth.Contract(tokenAJson.abi) as TestToken;
    this.tokenB = new this.web3.eth.Contract(tokenBJson.abi) as TestToken;
    this.tokenC = new this.web3.eth.Contract(tokenCJson.abi) as TestToken;
    this.tokenD = new this.web3.eth.Contract(tokenDJson.abi) as TestToken;
    this.tokenE = new this.web3.eth.Contract(tokenEJson.abi) as TestToken;
    this.tokenF = new this.web3.eth.Contract(tokenFJson.abi) as TestToken;
    this.erroringToken = new this.web3.eth.Contract(erroringTokenJson.abi) as TestToken;
    this.malformedToken = new this.web3.eth.Contract(malformedTokenJson.abi) as TestToken;
    this.omiseToken = new this.web3.eth.Contract(omiseTokenJson.abi) as TestToken;
    this.weth = new this.web3.eth.Contract(testWeth.abi) as TestWETH;

    // Testing Contracts
    this.alwaysOnlineOracleSentinel = new this.web3.eth.Contract(alwaysOnlineOracleSentinelJson.abi) as IOracleSentinel;
    this.chainlinkOracleSentinel = new this.web3.eth.Contract(chainlinkOracleSentinelJson.abi) as IOracleSentinel;
    this.chainlinkPriceOracleV1 = new this.web3.eth.Contract(
      testChainlinkPriceOracleJson.abi,
    ) as TestChainlinkPriceOracleV1;
    this.testAccountRiskOverrideSetter = new this.web3.eth.Contract(
      testAccountRiskOverrideSetterJson.abi,
    ) as TestAccountRiskOverrideSetter;
    this.testAmmRebalancerProxy = new this.web3.eth.Contract(testAmmRebalancerProxyJson.abi) as TestAmmRebalancerProxy;
    this.testAutoTrader = new this.web3.eth.Contract(testAutoTraderJson.abi) as TestAutoTrader;
    this.testCallee = new this.web3.eth.Contract(testCalleeJson.abi) as TestCallee;
    this.testChainlinkPriceAggregator = new this.web3.eth.Contract(
      testChainlinkPriceAggregatorJson.abi,
    ) as TestChainlinkAggregator;
    this.testSequencerUptimeFeedAggregator = new this.web3.eth.Contract(
      testSequencerUptimeFeedAggregatorJson.abi,
    ) as TestSequencerUptimeFeedAggregator;
    this.testDolomiteAmmLibrary = new this.web3.eth.Contract(testDolomiteAmmLibraryJson.abi) as TestDolomiteAmmLibrary;
    this.testDolomiteMargin = new this.web3.eth.Contract(testDolomiteMarginJson.abi) as TestDolomiteMargin;
    this.dolomiteMargin = this.testDolomiteMargin;
    this.testDoubleExponentInterestSetter = new this.web3.eth.Contract(
      testDoubleExponentInterestSetterJson.abi,
    ) as TestDoubleExponentInterestSetter;
    this.testExchangeWrapper = new this.web3.eth.Contract(testExchangeWrapperJson.abi) as TestExchangeWrapper;
    this.testInterestSetter = new this.web3.eth.Contract(testInterestSetterJson.abi) as TestInterestSetter;
    this.testLib = new this.web3.eth.Contract(testLibJson.abi) as TestLib;
    this.testParaswapAugustusRouter = new this.web3.eth.Contract(
      testParaswapAugustusRouterJson.abi,
    ) as TestParaswapAugustusRouter;
    this.testParaswapTrader = new this.web3.eth.Contract(testParaswapTraderJson.abi) as TestParaswapTrader;
    this.testPolynomialInterestSetter = new this.web3.eth.Contract(
      testPolynomialInterestSetterJson.abi,
    ) as TestPolynomialInterestSetter;
    this.testPriceOracle = new this.web3.eth.Contract(testPriceOracleJson.abi) as TestPriceOracle;
    this.testSimpleCallee = new this.web3.eth.Contract(testSimpleCalleeJson.abi) as TestSimpleCallee;
    this.testUniswapV2Factory = new this.web3.eth.Contract(testUniswapV2FactoryJson.abi) as UniswapV2Factory;
    this.testUniswapV3MultiRouter = new this.web3.eth.Contract(
      testUniswapV3MultiRouterJson.abi,
    ) as TestUniswapV3MultiRouter;
    this.testUniswapV2Router = new this.web3.eth.Contract(testUniswapV2RouterJson.abi) as UniswapV2Router02;

    this.setProvider(provider, networkId);
    this.setDefaultAccount(this.web3.eth.defaultAccount);
  }

  public async getUniswapV2PairByTokens(tokenA: address, tokenB: address): Promise<UniswapV2Pair> {
    const pairAddress = await this.testUniswapV2Factory.methods.getPair(tokenA, tokenB).call();
    const pair = new this.web3.eth.Contract(testUniswapV2PairJson.abi, pairAddress) as UniswapV2Pair;
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
      // test tokens
      { contract: this.tokenA, json: tokenAJson },
      { contract: this.tokenB, json: tokenBJson },
      { contract: this.tokenC, json: tokenCJson },
      { contract: this.tokenD, json: tokenDJson },
      { contract: this.tokenE, json: tokenEJson },
      { contract: this.tokenF, json: tokenFJson },
      { contract: this.erroringToken, json: erroringTokenJson },
      { contract: this.malformedToken, json: malformedTokenJson },
      { contract: this.omiseToken, json: omiseTokenJson },
      { contract: this.weth, json: testWeth },
      // test contracts
      { contract: this.alwaysOnlineOracleSentinel, json: alwaysOnlineOracleSentinelJson },
      { contract: this.chainlinkOracleSentinel, json: chainlinkOracleSentinelJson },
      { contract: this.chainlinkPriceOracleV1, json: testChainlinkPriceOracleJson },
      { contract: this.dolomiteMargin, json: testDolomiteMarginJson },
      { contract: this.testAmmRebalancerProxy, json: testAmmRebalancerProxyJson },
      { contract: this.testAccountRiskOverrideSetter, json: testAccountRiskOverrideSetterJson },
      { contract: this.testAutoTrader, json: testAutoTraderJson },
      { contract: this.testCallee, json: testCalleeJson },
      { contract: this.testChainlinkPriceAggregator, json: testChainlinkPriceAggregatorJson },
      { contract: this.testDolomiteMargin, json: testDolomiteMarginJson },
      { contract: this.testDolomiteAmmLibrary, json: testDolomiteAmmLibraryJson },
      { contract: this.testDoubleExponentInterestSetter, json: testDoubleExponentInterestSetterJson },
      { contract: this.testExchangeWrapper, json: testExchangeWrapperJson },
      { contract: this.testInterestSetter, json: testInterestSetterJson },
      { contract: this.testLib, json: testLibJson },
      { contract: this.testParaswapAugustusRouter, json: testParaswapAugustusRouterJson },
      { contract: this.testParaswapTrader, json: testParaswapTraderJson },
      { contract: this.testPolynomialInterestSetter, json: testPolynomialInterestSetterJson },
      { contract: this.testPriceOracle, json: testPriceOracleJson },
      { contract: this.testSequencerUptimeFeedAggregator, json: testSequencerUptimeFeedAggregatorJson },
      { contract: this.testSimpleCallee, json: testSimpleCalleeJson },
      { contract: this.testUniswapV2Factory, json: testUniswapV2FactoryJson },
      { contract: this.testUniswapV2Router, json: testUniswapV2RouterJson },
      { contract: this.testUniswapV3MultiRouter, json: testUniswapV3MultiRouterJson },
    ];

    contracts.forEach(contract =>
      this.setContractProvider(contract.contract, contract.json, provider, networkId, null),
    );
  }

  public setDefaultAccount(account: address): void {
    super.setDefaultAccount(account);

    // do not continue if not initialized
    if (!this.tokenA) {
      return;
    }

    this.dolomiteMargin.options.from = account;

    // Test Tokens
    this.tokenA.options.from = account;
    this.tokenB.options.from = account;
    this.tokenC.options.from = account;
    this.tokenD.options.from = account;
    this.tokenE.options.from = account;
    this.tokenF.options.from = account;
    this.erroringToken.options.from = account;
    this.malformedToken.options.from = account;
    this.omiseToken.options.from = account;
    // // Test Contracts
    this.alwaysOnlineOracleSentinel.options.from = account;
    this.chainlinkOracleSentinel.options.from = account;
    this.testAccountRiskOverrideSetter.options.from = account;
    this.testAmmRebalancerProxy.options.from = account;
    this.testAutoTrader.options.from = account;
    this.testCallee.options.from = account;
    this.testChainlinkPriceAggregator.options.from = account;
    this.testDolomiteAmmLibrary.options.from = account;
    this.testDolomiteMargin.options.from = account;
    this.testDoubleExponentInterestSetter.options.from = account;
    this.testExchangeWrapper.options.from = account;
    this.testInterestSetter.options.from = account;
    this.testLib.options.from = account;
    this.testParaswapAugustusRouter.options.from = account;
    this.testParaswapTrader.options.from = account;
    this.testPolynomialInterestSetter.options.from = account;
    this.testPriceOracle.options.from = account;
    this.testSequencerUptimeFeedAggregator.options.from = account;
    this.testSimpleCallee.options.from = account;
    this.testUniswapV2Factory.options.from = account;
    this.testUniswapV2Router.options.from = account;
    this.testUniswapV3MultiRouter.options.from = account;
  }

  public getTestAccountRiskOverrideSetter(contractAddress: address): TestAccountRiskOverrideSetter {
    const accountRiskOverrideSetter = new this.web3.eth.Contract(
      testAccountRiskOverrideSetterJson.abi,
      contractAddress,
    ) as TestAccountRiskOverrideSetter;
    accountRiskOverrideSetter.setProvider(this.provider);
    accountRiskOverrideSetter.options.from = this.dolomiteMargin.options.from;
    return accountRiskOverrideSetter;
  }

  public getDefaultGasLimit(): string | number {
    return this.defaultGas;
  }

  public getDefaultGasPrice(): string | number {
    return this.defaultGasPrice;
  }
}
