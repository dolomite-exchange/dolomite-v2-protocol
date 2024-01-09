/*

    Copyright 2019 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License";
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

/**
 * @typedef {Object} artifacts
 */

const ethers = require('ethers');

const {
  isDevNetwork,
  isEthereumMainnet,
  getPolynomialParams,
  getDoubleExponentParams,
  getRiskLimits,
  getRiskParams,
  getExpiryRampTime,
  getSenderAddress,
  getChainId,
  getChainlinkOracleSentinelGracePeriod,
  getChainlinkSequencerUptimeFeed,
  getUniswapV3MultiRouter,
  shouldOverwrite,
  getNoOverwriteParams,
  isArbitrumGoerli,
  isArbitrumNetwork,
  isPolygonZkEvmNetwork,
  isBaseNetwork,
  isX1Network,
} = require('./helpers');
const {
  getChainlinkPriceOracleContract,
  getChainlinkPriceOracleV1Params
} = require('./oracle_helpers');
const {
  getParaswapAugustusRouter,
  getParaswapTransferProxy
} = require('./liquidator_helpers');
const {
  getWethAddress,
  getWrappedCurrencyAddress
} = require('./token_helpers');
const { bytecode: uniswapV2PairBytecode } = require('../build/contracts/UniswapV2Pair.json');
const {
  getRebalancerV1Routers,
  getRebalancerV1InitHashes
} = require('./rebalancer_helpers');

// ============ Contracts ============

// Base Protocol
const AdminImpl = artifacts.require('AdminImpl');
const GettersImpl = artifacts.require('GettersImpl');
const DolomiteMargin = artifacts.require('DolomiteMargin');
const CallImpl = artifacts.require('CallImpl');
const DepositImpl = artifacts.require('DepositImpl');
const LiquidateOrVaporizeImpl = artifacts.require('LiquidateOrVaporizeImpl');
const TradeImpl = artifacts.require('TradeImpl');
const TransferImpl = artifacts.require('TransferImpl');
const WithdrawalImpl = artifacts.require('WithdrawalImpl');
const OperationImpl = artifacts.require('OperationImpl');
const TestOperationImpl = artifacts.require('TestOperationImpl');

// MultiCall
const ArbitrumMultiCall = artifacts.require('ArbitrumMultiCall');
const MultiCall = artifacts.require('MultiCall');

// Test Tokens
const TokenA = artifacts.require('TokenA');
const TokenB = artifacts.require('TokenB');
const TokenC = artifacts.require('TokenC');
const TokenD = artifacts.require('TokenD');
const TokenE = artifacts.require('TokenE');
const TokenF = artifacts.require('TokenF');
const ErroringToken = artifacts.require('ErroringToken');
const MalformedToken = artifacts.require('MalformedToken');
const OmiseToken = artifacts.require('OmiseToken');

// Test Contracts
const TestAccountRiskOverrideSetter = artifacts.require('TestAccountRiskOverrideSetter');
const TestDolomiteAmmLibrary = artifacts.require('TestDolomiteAmmLibrary');
const TestDolomiteMargin = artifacts.require('TestDolomiteMargin');
const TestAutoTrader = artifacts.require('TestAutoTrader');
const TestBtcUsdChainlinkAggregator = artifacts.require('TestBtcUsdChainlinkAggregator');
const TestCallee = artifacts.require('TestCallee');
const TestChainlinkAggregator = artifacts.require('TestChainlinkAggregator');
const TestDoubleExponentInterestSetter = artifacts.require('TestDoubleExponentInterestSetter');
const TestDaiUsdChainlinkAggregator = artifacts.require('TestDaiUsdChainlinkAggregator');
const TestEthUsdChainlinkAggregator = artifacts.require('TestEthUsdChainlinkAggregator');
const TestExchangeWrapper = artifacts.require('TestExchangeWrapper');
const TestInterestSetter = artifacts.require('TestInterestSetter');
const TestLib = artifacts.require('TestLib');
const TestLinkUsdChainlinkAggregator = artifacts.require('TestLinkUsdChainlinkAggregator');
const TestLrcEthChainlinkAggregator = artifacts.require('TestLrcEthChainlinkAggregator');
const TestMaticUsdChainlinkAggregator = artifacts.require('TestMaticUsdChainlinkAggregator');
const TestPolynomialInterestSetter = artifacts.require('TestPolynomialInterestSetter');
const TestPriceOracle = artifacts.require('TestPriceOracle');
const TestSequencerUptimeFeedAggregator = artifacts.require('TestSequencerUptimeFeedAggregator');
const TestSimpleCallee = artifacts.require('TestSimpleCallee');
const TestUsdcUsdChainlinkAggregator = artifacts.require('TestUsdcUsdChainlinkAggregator');
const TestWETH = artifacts.require('TestWETH');

// Second-Layer Contracts
const AmmRebalancerProxyV1 = artifacts.require('AmmRebalancerProxyV1');
const AmmRebalancerProxyV2 = artifacts.require('AmmRebalancerProxyV2');
const BorrowPositionProxyV1 = artifacts.require('BorrowPositionProxyV1');
const BorrowPositionProxyV2 = artifacts.require('BorrowPositionProxyV2');
const DepositWithdrawalProxy = artifacts.require('DepositWithdrawalProxy');
const DolomiteAmmRouterProxy = artifacts.require('DolomiteAmmRouterProxy');
const Expiry = artifacts.require('Expiry');
const ExpiryProxy = artifacts.require('ExpiryProxy');
const GenericTraderProxyV1 = artifacts.require('GenericTraderProxyV1');
const GenericTraderProxyV1Lib = artifacts.require('GenericTraderProxyV1Lib');
const LiquidatorAssetRegistry = artifacts.require('LiquidatorAssetRegistry');
const LiquidatorProxyV1 = artifacts.require('LiquidatorProxyV1');
const LiquidatorProxyV1WithAmm = artifacts.require('LiquidatorProxyV1WithAmm');
const LiquidatorProxyV2WithExternalLiquidity = artifacts.require('LiquidatorProxyV2WithExternalLiquidity');
const LiquidatorProxyV3WithLiquidityToken = artifacts.require('LiquidatorProxyV3WithLiquidityToken');
const LiquidatorProxyV4WithGenericTrader = artifacts.require('LiquidatorProxyV4WithGenericTrader');
const EventEmitterRegistry = artifacts.require('EventEmitterRegistry');
const PayableProxy = artifacts.require('PayableProxy');
const SignedOperationProxy = artifacts.require('SignedOperationProxy');
const TestAmmRebalancerProxy = artifacts.require('TestAmmRebalancerProxy');
const TestUniswapAmmRebalancerProxy = artifacts.require('TestUniswapAmmRebalancerProxy');
const TestUniswapV3MultiRouter = artifacts.require('TestUniswapV3MultiRouter');
const TransferProxy = artifacts.require('TransferProxy');

// Oracle Sentinels
const AlwaysOnlineOracleSentinel = artifacts.require('AlwaysOnlineOracleSentinel');
const ChainlinkOracleSentinel = artifacts.require('ChainlinkOracleSentinel');

// Interest Setters
const AAVECopyCatAltCoinInterestSetter = artifacts.require('AAVECopyCatAltCoinInterestSetter');
const AAVECopyCatStableCoinInterestSetter = artifacts.require('AAVECopyCatStableCoinInterestSetter');
const AlwaysZeroInterestSetter = artifacts.require('AlwaysZeroInterestSetter');
const DoubleExponentInterestSetter = artifacts.require('DoubleExponentInterestSetter');

// Amm
const DolomiteAmmFactory = artifacts.require('DolomiteAmmFactory');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');
const SimpleFeeOwner = artifacts.require('SimpleFeeOwner');

// Paraswap
const TestParaswapTrader = artifacts.require('TestParaswapTrader');
const TestParaswapAugustusRouter = artifacts.require('TestParaswapAugustusRouter');
const TestParaswapTransferProxy = artifacts.require('TestParaswapTransferProxy');

// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await deployTestContracts(deployer, network);
  await deployBaseProtocol(deployer, network);
  await deployMultiCall(deployer, network);
  await deployInterestSetters(deployer, network);
  await deployPriceOracles(deployer, network, accounts);
  await deploySecondLayer(deployer, network, accounts);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployTestContracts(deployer, network) {
  if (isDevNetwork(network)) {
    await Promise.all([
      // Test Tokens
      deployer.deploy(TokenA),
      deployer.deploy(TokenB),
      deployer.deploy(TokenC),
      deployer.deploy(TokenD),
      deployer.deploy(TokenE),
      deployer.deploy(TokenF),
      deployer.deploy(TestWETH, 'Wrapped Ether', 'WETH'),
      deployer.deploy(ErroringToken),
      deployer.deploy(MalformedToken),
      deployer.deploy(OmiseToken),
      // Test Contracts
      deployer.deploy(TestAccountRiskOverrideSetter),
      deployer.deploy(TestAutoTrader),
      deployer.deploy(TestChainlinkAggregator),
      deployer.deploy(TestDolomiteAmmLibrary),
      deployer.deploy(TestDoubleExponentInterestSetter, getDoubleExponentParams(network)),
      deployer.deploy(TestExchangeWrapper),
      deployer.deploy(TestLib),
      deployer.deploy(TestPolynomialInterestSetter, getPolynomialParams(network)),
      deployer.deploy(TestSequencerUptimeFeedAggregator),
    ]);
  }
}

async function deployBaseProtocol(deployer, network) {
  if (shouldOverwrite(CallImpl, network)) {
    await deployer.deploy(CallImpl);
  } else {
    await deployer.deploy(CallImpl, getNoOverwriteParams());
  }

  if (shouldOverwrite(DepositImpl, network)) {
    await deployer.deploy(DepositImpl);
  } else {
    await deployer.deploy(DepositImpl, getNoOverwriteParams());
  }

  if (shouldOverwrite(LiquidateOrVaporizeImpl, network)) {
    await deployer.deploy(LiquidateOrVaporizeImpl);
  } else {
    await deployer.deploy(LiquidateOrVaporizeImpl, getNoOverwriteParams());
  }

  if (shouldOverwrite(TradeImpl, network)) {
    await deployer.deploy(TradeImpl);
  } else {
    await deployer.deploy(TradeImpl, getNoOverwriteParams());
  }

  if (shouldOverwrite(TransferImpl, network)) {
    await deployer.deploy(TransferImpl);
  } else {
    await deployer.deploy(TransferImpl, getNoOverwriteParams());
  }

  if (shouldOverwrite(WithdrawalImpl, network)) {
    await deployer.deploy(WithdrawalImpl);
  } else {
    await deployer.deploy(WithdrawalImpl, getNoOverwriteParams());
  }

  if (shouldOverwrite(AdminImpl, network)) {
    await deployer.deploy(AdminImpl);
  } else {
    await deployer.deploy(AdminImpl, getNoOverwriteParams());
  }

  if (shouldOverwrite(GettersImpl, network)) {
    await deployer.deploy(GettersImpl);
  } else {
    await deployer.deploy(GettersImpl, getNoOverwriteParams());
  }

  OperationImpl.link('CallImpl', CallImpl.address);
  OperationImpl.link('DepositImpl', DepositImpl.address);
  OperationImpl.link('LiquidateOrVaporizeImpl', LiquidateOrVaporizeImpl.address);
  OperationImpl.link('TradeImpl', TradeImpl.address);
  OperationImpl.link('TransferImpl', TransferImpl.address);
  OperationImpl.link('WithdrawalImpl', WithdrawalImpl.address);
  if (shouldOverwrite(OperationImpl, network)) {
    await deployer.deploy(OperationImpl);
  } else {
    await deployer.deploy(OperationImpl, getNoOverwriteParams());
  }

  let dolomiteMargin;
  if (isDevNetwork(network)) {
    await deployer.deploy(TestOperationImpl);
    dolomiteMargin = TestDolomiteMargin;
  } else if (
    isEthereumMainnet(network) ||
    isPolygonZkEvmNetwork(network) ||
    isBaseNetwork(network) ||
    isArbitrumNetwork(network) ||
    isX1Network(network)
  ) {
    dolomiteMargin = DolomiteMargin;
  } else {
    throw new Error('Cannot deploy DolomiteMargin');
  }

  await Promise.all([
    dolomiteMargin.link('AdminImpl', AdminImpl.address),
    dolomiteMargin.link('GettersImpl', GettersImpl.address),
    dolomiteMargin.link('OperationImpl', OperationImpl.address),
  ]);
  if (isDevNetwork(network)) {
    await dolomiteMargin.link('TestOperationImpl', TestOperationImpl.address);
  }

  if (shouldOverwrite(AlwaysOnlineOracleSentinel, network)) {
    await deployer.deploy(AlwaysOnlineOracleSentinel);
  } else {
    await deployer.deploy(AlwaysOnlineOracleSentinel, getNoOverwriteParams());
  }

  if (shouldOverwrite(dolomiteMargin, network)) {
    const riskParams = await getRiskParams(network);
    await deployer.deploy(
      dolomiteMargin,
      getRiskLimits(),
      riskParams.marginRatio,
      riskParams.liquidationSpread,
      riskParams.earningsRate,
      riskParams.minBorrowedValue,
      riskParams.accountMaxNumberOfMarketsWithBalances,
      AlwaysOnlineOracleSentinel.address,
      riskParams.callbackGasLimit,
    );
  } else {
    await deployer.deploy(dolomiteMargin, getNoOverwriteParams());
  }

  let uptimeFeed = getChainlinkSequencerUptimeFeed(network, TestSequencerUptimeFeedAggregator);
  if (uptimeFeed) {
    if (shouldOverwrite(ChainlinkOracleSentinel, network)) {
      await deployer.deploy(
        ChainlinkOracleSentinel,
        getChainlinkOracleSentinelGracePeriod(),
        uptimeFeed,
        dolomiteMargin.address,
      );
    } else {
      await deployer.deploy(ChainlinkOracleSentinel, getNoOverwriteParams());
    }

    dolomiteMargin = await getDolomiteMargin(network);
    if ((await dolomiteMargin.getOracleSentinel()).toLowerCase() !== ChainlinkOracleSentinel.address.toLowerCase()) {
      await dolomiteMargin.ownerSetOracleSentinel(ChainlinkOracleSentinel.address);
    }
  }
}

async function deployMultiCall(deployer, network) {
  let multiCall;
  if (isArbitrumNetwork(network)) {
    multiCall = ArbitrumMultiCall;
  } else {
    multiCall = MultiCall;
  }

  if (shouldOverwrite(multiCall, network)) {
    await deployer.deploy(multiCall);
  } else {
    await deployer.deploy(multiCall, getNoOverwriteParams());
  }
}

async function deployInterestSetters(deployer, network) {
  if (isDevNetwork(network)) {
    await deployer.deploy(TestInterestSetter);
  }

  if (shouldOverwrite(AAVECopyCatAltCoinInterestSetter, network)) {
    await deployer.deploy(AAVECopyCatAltCoinInterestSetter);
  } else {
    await deployer.deploy(AAVECopyCatAltCoinInterestSetter, getNoOverwriteParams());
  }

  if (shouldOverwrite(AAVECopyCatStableCoinInterestSetter, network)) {
    await deployer.deploy(AAVECopyCatStableCoinInterestSetter);
  } else {
    await deployer.deploy(AAVECopyCatStableCoinInterestSetter, getNoOverwriteParams());
  }

  if (shouldOverwrite(AlwaysZeroInterestSetter, network)) {
    await deployer.deploy(AlwaysZeroInterestSetter);
  } else {
    await deployer.deploy(AlwaysZeroInterestSetter, getNoOverwriteParams());
  }

  if (shouldOverwrite(DoubleExponentInterestSetter, network)) {
    await deployer.deploy(DoubleExponentInterestSetter, getDoubleExponentParams(network));
  } else {
    await deployer.deploy(DoubleExponentInterestSetter, getNoOverwriteParams());
  }
}

async function deployPriceOracles(deployer, network) {
  if (isDevNetwork(network)) {
    await deployer.deploy(TestPriceOracle);
  }

  if (isDevNetwork(network)) {
    await Promise.all([
      deployer.deploy(TestBtcUsdChainlinkAggregator),
      deployer.deploy(TestDaiUsdChainlinkAggregator),
      deployer.deploy(TestEthUsdChainlinkAggregator),
      deployer.deploy(TestLinkUsdChainlinkAggregator),
      deployer.deploy(TestLrcEthChainlinkAggregator),
      deployer.deploy(TestMaticUsdChainlinkAggregator),
      deployer.deploy(TestUsdcUsdChainlinkAggregator),
    ]);
  }

  const tokens = {
    TokenA,
    TokenB,
    TokenD,
    TokenE,
    TokenF,
    TestWETH,
  };

  const aggregators = {
    btcUsdAggregator: TestBtcUsdChainlinkAggregator,
    daiUsdAggregator: TestDaiUsdChainlinkAggregator,
    ethUsdAggregator: TestEthUsdChainlinkAggregator,
    linkUsdAggregator: TestLinkUsdChainlinkAggregator,
    lrcEthAggregator: TestLrcEthChainlinkAggregator,
    maticUsdAggregator: TestMaticUsdChainlinkAggregator,
    usdcUsdAggregator: TestUsdcUsdChainlinkAggregator,
  };

  const oracleContract = getChainlinkPriceOracleContract(network, artifacts);
  const params = getChainlinkPriceOracleV1Params(network, tokens, aggregators);

  if (params && shouldOverwrite(oracleContract, network)) {
    const dolomiteMargin = await getDolomiteMargin(network);
    await deployer.deploy(
      oracleContract,
      params.tokens,
      params.aggregators,
      params.tokenDecimals,
      params.tokenPairs,
      dolomiteMargin.address,
    );
  } else {
    await deployer.deploy(oracleContract, getNoOverwriteParams());
  }
}

async function deploySecondLayer(deployer, network, accounts) {
  const dolomiteMargin = await getDolomiteMargin(network);

  if (isDevNetwork(network)) {
    await Promise.all([
      deployer.deploy(TestCallee, dolomiteMargin.address),
      deployer.deploy(TestSimpleCallee, dolomiteMargin.address),
      deployer.deploy(UniswapV2Factory, getSenderAddress(network, accounts)),
    ]);

    const weth = getWethAddress(network, TestWETH);
    const uniswapV2Factory = await UniswapV2Factory.deployed();
    await deployer.deploy(UniswapV2Router02, uniswapV2Factory.address, weth);
    await UniswapV2Router02.deployed();
  }

  if (shouldOverwrite(TransferProxy, network)) {
    await deployer.deploy(TransferProxy, dolomiteMargin.address);
  } else {
    await deployer.deploy(TransferProxy, getNoOverwriteParams());
  }

  if (shouldOverwrite(BorrowPositionProxyV1, network)) {
    await deployer.deploy(BorrowPositionProxyV1, dolomiteMargin.address);
  } else {
    await deployer.deploy(BorrowPositionProxyV1, getNoOverwriteParams());
  }

  if (shouldOverwrite(BorrowPositionProxyV2, network)) {
    await deployer.deploy(BorrowPositionProxyV2, dolomiteMargin.address);
  } else {
    await deployer.deploy(BorrowPositionProxyV2, getNoOverwriteParams());
  }

  if (shouldOverwrite(DepositWithdrawalProxy, network)) {
    await deployer.deploy(DepositWithdrawalProxy, dolomiteMargin.address);
  } else {
    await deployer.deploy(DepositWithdrawalProxy, getNoOverwriteParams());
  }

  if (isDevNetwork(network)) {
    if (shouldOverwrite(DolomiteAmmFactory, network)) {
      await deployer.deploy(
        DolomiteAmmFactory,
        getSenderAddress(network, accounts),
        dolomiteMargin.address,
        TransferProxy.address,
      );
    } else {
      await deployer.deploy(DolomiteAmmFactory, getNoOverwriteParams());
    }

    if (shouldOverwrite(SimpleFeeOwner, network)) {
      await deployer.deploy(SimpleFeeOwner, DolomiteAmmFactory.address, dolomiteMargin.address);
    } else {
      await deployer.deploy(SimpleFeeOwner, getNoOverwriteParams());
    }
  }

  if (shouldOverwrite(Expiry, network)) {
    await deployer.deploy(Expiry, dolomiteMargin.address, getExpiryRampTime(network));
  } else {
    await deployer.deploy(Expiry, getNoOverwriteParams());
  }

  if (isDevNetwork(network)) {
    if (shouldOverwrite(DolomiteAmmRouterProxy, network)) {
      try {
        await deployer.deploy(DolomiteAmmRouterProxy, dolomiteMargin.address, DolomiteAmmFactory.address, Expiry.address);
      } catch (e) {
        const pairInitCodeHash = await (await DolomiteAmmFactory.deployed()).getPairInitCodeHash();
        console.log('\n\nError deploying DolomiteAmmRouterProxy. Hash: ', pairInitCodeHash, '\n\n');
        throw e;
      }
    } else {
      await deployer.deploy(DolomiteAmmRouterProxy, getNoOverwriteParams());
    }
  }

  if (isDevNetwork(network) || isArbitrumGoerli(network)) {
    await deployer.deploy(TestAmmRebalancerProxy, dolomiteMargin.address, DolomiteAmmFactory.address);
    await deployer.deploy(TestUniswapAmmRebalancerProxy);
  }

  if (isDevNetwork(network)) {
    await deployer.deploy(TestUniswapV3MultiRouter);

    const uniswapV2Router = await UniswapV2Router02.deployed();
    await deployer.deploy(
      AmmRebalancerProxyV1,
      dolomiteMargin.address,
      DolomiteAmmFactory.address,
      [uniswapV2Router.address],
      [ethers.utils.solidityKeccak256(['bytes'], [uniswapV2PairBytecode])],
    );
  } else if (isArbitrumNetwork(network)) {
    if (shouldOverwrite(AmmRebalancerProxyV1, network)) {
      await deployer.deploy(
        AmmRebalancerProxyV1,
        dolomiteMargin.address,
        DolomiteAmmFactory.address,
        getRebalancerV1Routers(network),
        getRebalancerV1InitHashes(network),
      );
    } else {
      await deployer.deploy(AmmRebalancerProxyV1, getNoOverwriteParams());
    }
  }

  if (isDevNetwork(network) || isArbitrumGoerli(network)) {
    await deployer.deploy(
      TestAmmRebalancerProxy,
      dolomiteMargin.address,
      DolomiteAmmFactory.address,
      getNoOverwriteParams(),
    );
    await deployer.deploy(TestUniswapAmmRebalancerProxy, getNoOverwriteParams());
  }

  if (isArbitrumNetwork(network)) {
    if (shouldOverwrite(AmmRebalancerProxyV2, network)) {
      await deployer.deploy(
        AmmRebalancerProxyV2,
        dolomiteMargin.address,
        DolomiteAmmFactory.address,
        getUniswapV3MultiRouter(network, TestUniswapV3MultiRouter),
      );
    } else {
      await deployer.deploy(AmmRebalancerProxyV2, getNoOverwriteParams());
    }
  }

  if (shouldOverwrite(EventEmitterRegistry, network)) {
    await deployer.deploy(EventEmitterRegistry, dolomiteMargin.address);
  } else {
    await deployer.deploy(EventEmitterRegistry, getNoOverwriteParams());
  }

  if (shouldOverwrite(GenericTraderProxyV1, network)) {
    await deployer.deploy(GenericTraderProxyV1Lib);
    GenericTraderProxyV1.link('GenericTraderProxyV1Lib', GenericTraderProxyV1Lib.address);
    await deployer.deploy(GenericTraderProxyV1, Expiry.address, EventEmitterRegistry.address, dolomiteMargin.address);
  } else {
    await deployer.deploy(GenericTraderProxyV1, getNoOverwriteParams());
  }

  if (shouldOverwrite(PayableProxy, network)) {
    await deployer.deploy(PayableProxy, dolomiteMargin.address, getWrappedCurrencyAddress(network, TestWETH));
  } else {
    await deployer.deploy(PayableProxy, getNoOverwriteParams());
  }

  if (shouldOverwrite(LiquidatorAssetRegistry, network)) {
    await deployer.deploy(LiquidatorAssetRegistry, dolomiteMargin.address);
  } else {
    await deployer.deploy(LiquidatorAssetRegistry, getNoOverwriteParams());
  }

  if (shouldOverwrite(ExpiryProxy, network)) {
    await deployer.deploy(ExpiryProxy, LiquidatorAssetRegistry.address, Expiry.address, dolomiteMargin.address);
  } else {
    await deployer.deploy(ExpiryProxy, getNoOverwriteParams());
  }

  if (shouldOverwrite(LiquidatorProxyV1, network)) {
    await deployer.deploy(LiquidatorProxyV1, LiquidatorAssetRegistry.address, dolomiteMargin.address);
  } else {
    await deployer.deploy(LiquidatorProxyV1, getNoOverwriteParams());
  }

  if (isDevNetwork(network)) {
    if (shouldOverwrite(LiquidatorProxyV1WithAmm, network)) {
      await deployer.deploy(
        LiquidatorProxyV1WithAmm,
        dolomiteMargin.address,
        DolomiteAmmRouterProxy.address,
        Expiry.address,
        LiquidatorAssetRegistry.address,
      );
    } else {
      await deployer.deploy(LiquidatorProxyV1WithAmm, getNoOverwriteParams());
    }

    if (shouldOverwrite(LiquidatorProxyV2WithExternalLiquidity, network)) {
      if (isDevNetwork(network)) {
        await deployer.deploy(TestParaswapTransferProxy);
        await deployer.deploy(TestParaswapAugustusRouter, TestParaswapTransferProxy.address);
        await deployer.deploy(
          TestParaswapTrader,
          TestParaswapAugustusRouter.address,
          TestParaswapTransferProxy.address,
          dolomiteMargin.address,
        );
      }

      await deployer.deploy(
        LiquidatorProxyV2WithExternalLiquidity,
        Expiry.address,
        getParaswapAugustusRouter(network, TestParaswapAugustusRouter),
        getParaswapTransferProxy(network, TestParaswapTransferProxy),
        dolomiteMargin.address,
        LiquidatorAssetRegistry.address,
      );
    } else {
      await deployer.deploy(LiquidatorProxyV2WithExternalLiquidity, getNoOverwriteParams());
    }

    if (shouldOverwrite(LiquidatorProxyV3WithLiquidityToken, network)) {
      if (isDevNetwork(network)) {
        await deployer.deploy(TestParaswapTransferProxy);
        await deployer.deploy(TestParaswapAugustusRouter, TestParaswapTransferProxy.address);
      }

      await deployer.deploy(
        LiquidatorProxyV3WithLiquidityToken,
        Expiry.address,
        getParaswapAugustusRouter(network, TestParaswapAugustusRouter),
        getParaswapTransferProxy(network, TestParaswapTransferProxy),
        dolomiteMargin.address,
        LiquidatorAssetRegistry.address,
      );
    } else {
      await deployer.deploy(LiquidatorProxyV3WithLiquidityToken, getNoOverwriteParams());
    }
  }

  if (shouldOverwrite(LiquidatorProxyV4WithGenericTrader, network)) {
    await deployer.deploy(
      LiquidatorProxyV4WithGenericTrader,
      Expiry.address,
      dolomiteMargin.address,
      LiquidatorAssetRegistry.address,
    );
  } else {
    await deployer.deploy(LiquidatorProxyV4WithGenericTrader, getNoOverwriteParams());
  }

  if (shouldOverwrite(SignedOperationProxy, network)) {
    await deployer.deploy(SignedOperationProxy, dolomiteMargin.address, getChainId(network));
  } else {
    await deployer.deploy(SignedOperationProxy, getNoOverwriteParams());
  }

  if (isDevNetwork(network)) {
    await Promise.all([
      dolomiteMargin.ownerSetGlobalOperator(BorrowPositionProxyV1.address, true),
      dolomiteMargin.ownerSetGlobalOperator(BorrowPositionProxyV2.address, true),
      dolomiteMargin.ownerSetGlobalOperator(Expiry.address, true),
      dolomiteMargin.ownerSetGlobalOperator(ExpiryProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(DepositWithdrawalProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(DolomiteAmmFactory.address, true),
      dolomiteMargin.ownerSetGlobalOperator(DolomiteAmmRouterProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(GenericTraderProxyV1.address, true),
      dolomiteMargin.ownerSetGlobalOperator(LiquidatorProxyV1.address, true),
      dolomiteMargin.ownerSetGlobalOperator(LiquidatorProxyV1WithAmm.address, true),
      dolomiteMargin.ownerSetGlobalOperator(LiquidatorProxyV2WithExternalLiquidity.address, true),
      dolomiteMargin.ownerSetGlobalOperator(LiquidatorProxyV3WithLiquidityToken.address, true),
      dolomiteMargin.ownerSetGlobalOperator(LiquidatorProxyV4WithGenericTrader.address, true),
      dolomiteMargin.ownerSetGlobalOperator(PayableProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(SignedOperationProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(TransferProxy.address, true),
    ]);
  } else {
    await Promise.all([
      dolomiteMargin.ownerSetGlobalOperator(BorrowPositionProxyV1.address, true),
      dolomiteMargin.ownerSetGlobalOperator(BorrowPositionProxyV2.address, true),
      dolomiteMargin.ownerSetGlobalOperator(Expiry.address, true),
      dolomiteMargin.ownerSetGlobalOperator(ExpiryProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(DepositWithdrawalProxy.address, true),
      dolomiteMargin.ownerSetGlobalOperator(GenericTraderProxyV1.address, true),
      dolomiteMargin.ownerSetGlobalOperator(LiquidatorProxyV1.address, true),
      dolomiteMargin.ownerSetGlobalOperator(LiquidatorProxyV4WithGenericTrader.address, true),
      dolomiteMargin.ownerSetGlobalOperator(TransferProxy.address, true),
    ]);
  }
}

async function getDolomiteMargin(network) {
  if (isDevNetwork(network)) {
    return TestDolomiteMargin.deployed();
  }
  return DolomiteMargin.deployed();
}
