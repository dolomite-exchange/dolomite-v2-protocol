const {
  isDevNetwork,
  isArbitrumOne,
  isArbitrumGoerli,
  isArbitrumNetwork,
  isBaseNetwork,
  isEthereumMainnet,
  isPolygonZkEvmNetwork,
  isPolygonZkEvm,
  isMantleNetwork,
  isXLayerNetwork,
  isBase,
} = require('./helpers');
const {
  getDaiAddress,
  getLinkAddress,
  getLrcAddress,
  getUsdcAddress,
  getWbtcAddress,
  getWethAddress,
  getUsdtAddress,
} = require('./token_helpers');
const { ADDRESSES } = require('../dist/src/lib/Constants');

function getBtcUsdAggregatorAddress(network, TestBtcUsdChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestBtcUsdChainlinkAggregator.address;
  }
  if (isArbitrumOne(network)) {
    return '0x6ce185860a4963106506c203335a2910413708e9';
  }
  if (isArbitrumGoerli(network)) {
    return '0x6550bc2301936011c1334555e62A87705A81C12C';
  }
  if (isEthereumMainnet(network)) {
    return '0xF5fff180082d6017036B771bA883025c654BC935';
  }
  throw new Error(`Cannot find BTC-USD aggregator for network: ${network}`);
}

function getDaiUsdAggregatorAddress(network, TestDaiUsdChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestDaiUsdChainlinkAggregator.address;
  }
  if (isArbitrumOne(network)) {
    return '0xc5c8e77b397e531b8ec06bfb0048328b30e9ecfb';
  }
  if (isArbitrumGoerli(network)) {
    return '0x103b53E977DA6E4Fa92f76369c8b7e20E7fb7fe1';
  }
  throw new Error(`Cannot find DAI-USD aggregator for network: ${network}`);
}

function getEthUsdAggregatorAddress(network, TestEthUsdChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestEthUsdChainlinkAggregator.address;
  }
  if (isArbitrumOne(network)) {
    return '0x639fe6ab55c921f74e7fac1ee960c0b6293ba612';
  }
  if (isArbitrumGoerli(network)) {
    return '0x62CAe0FA2da220f43a51F86Db2EDb36DcA9A5A08';
  }
  if (isBase(network)) {
    return '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70';
  }
  if (isEthereumMainnet(network)) {
    return '0xF79D6aFBb6dA890132F9D7c355e3015f15F3406F';
  }
  if (isPolygonZkEvm(network)) {
    return '0x97d9F9A00dEE0004BE8ca0A8fa374d486567eE2D';
  }
  throw new Error(`Cannot find ETH-USD aggregator for network: ${network}`);
}

function getLinkUsdAggregatorAddress(network, TestLinkUsdChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestLinkUsdChainlinkAggregator.address;
  }
  if (isArbitrumOne(network)) {
    return '0x86e53cf1b870786351da77a57575e79cb55812cb';
  }
  if (isArbitrumGoerli(network)) {
    return '0xd28Ba6CA3bB72bF371b80a2a0a33cBcf9073C954';
  }
  if (isEthereumMainnet(network)) {
    return '0x32dbd3214aC75223e27e575C53944307914F7a90';
  }
  throw new Error(`Cannot find LINK-USD aggregator for network: ${network}`);
}

function getLrcEthAggregatorAddress(network, TestLrcEthChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestLrcEthChainlinkAggregator.address;
  }
  if (isEthereumMainnet(network)) {
    return '0x8770Afe90c52Fd117f29192866DE705F63e59407';
  }
  throw new Error(`Cannot find LRC-USD aggregator for network: ${network}`);
}

function getUsdcUsdAggregatorAddress(network) {
  if (isArbitrumOne(network)) {
    return '0x50834f3163758fcc1df9973b6e91f0f0f0434ad3';
  }
  if (isArbitrumGoerli(network)) {
    return '0x1692Bdd32F31b831caAc1b0c9fAF68613682813b';
  }
  throw new Error(`Cannot find USDC-USD aggregator for network: ${network}`);
}

function getUsdtUsdAggregatorAddress(network) {
  if (isArbitrumOne(network)) {
    return '0x3f3f5df88dc9f13eac63df89ec16ef6e7e25dde7';
  }
  throw new Error(`Cannot find USDT-USD aggregator for network: ${network}`);
}

function getUsdcEthAggregatorAddress(network, TestUsdcEthChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestUsdcEthChainlinkAggregator.address;
  }
  if (isEthereumMainnet(network)) {
    return '0xdE54467873c3BCAA76421061036053e371721708';
  }
  throw new Error(`Cannot find USDC-ETH aggregator for network: ${network}`);
}

function getChainlinkPriceOracleContract(network, artifacts) {
  if (isDevNetwork(network)) {
    return artifacts.require('TestChainlinkPriceOracleV1');
  } else {
    return artifacts.require('ChainlinkPriceOracleV1');
  }
}

function getChainlinkPriceOracleV1Params(network, tokens, aggregators) {
  if (isArbitrumNetwork(network)) {
    const pairs = [
      [getDaiAddress(network), getDaiUsdAggregatorAddress(network), 18, ADDRESSES.ZERO],
      [getLinkAddress(network), getLinkUsdAggregatorAddress(network), 18, ADDRESSES.ZERO],
      [getUsdcAddress(network), getUsdcUsdAggregatorAddress(network), 6, ADDRESSES.ZERO],
      [getWethAddress(network), getEthUsdAggregatorAddress(network), 18, ADDRESSES.ZERO],
      [getWbtcAddress(network), getBtcUsdAggregatorAddress(network), 8, ADDRESSES.ZERO],
    ];
    if (isArbitrumOne(network)) {
      pairs.push([getUsdtAddress(network), getUsdtUsdAggregatorAddress(network), 6, ADDRESSES.ZERO]);
    }
    return mapPairsToParams(pairs);
  } else if (
    isBaseNetwork(network) ||
    isPolygonZkEvmNetwork(network)
  ) {
    const pairs = [[getWethAddress(network), getEthUsdAggregatorAddress(network), 18, ADDRESSES.ZERO]];
    return mapPairsToParams(pairs);
  } else if (isMantleNetwork(network) || isXLayerNetwork(network)) {
    return undefined; // return nothing since Chainlink is not live
  } else if (isDevNetwork(network)) {
    const { TokenA, TokenB, TokenD, TokenE, TokenF, TestWETH } = tokens;

    const {
      btcUsdAggregator,
      daiUsdAggregator,
      ethUsdAggregator,
      linkUsdAggregator,
      lrcEthAggregator,
      usdcUsdAggregator,
    } = aggregators;

    return mapPairsToParams([
      // eslint-disable-next-line max-len
      [getWethAddress(network, TestWETH), getEthUsdAggregatorAddress(network, ethUsdAggregator), 18, ADDRESSES.ZERO],
      // eslint-disable-next-line max-len
      [getDaiAddress(network, TokenB), getDaiUsdAggregatorAddress(network, daiUsdAggregator), 18, ADDRESSES.ZERO],
      // eslint-disable-next-line max-len
      [getLinkAddress(network, TokenE), getLinkUsdAggregatorAddress(network, linkUsdAggregator), 18, ADDRESSES.ZERO],
      // eslint-disable-next-line max-len
      [
        getLrcAddress(network, TokenF),
        getLrcEthAggregatorAddress(network, lrcEthAggregator),
        18,
        getWethAddress(network, TestWETH),
        18,
      ],
      // eslint-disable-next-line max-len
      [getUsdcAddress(network, TokenA), getUsdcEthAggregatorAddress(network, usdcUsdAggregator), 6, ADDRESSES.ZERO],
      // eslint-disable-next-line max-len
      [getWbtcAddress(network, TokenD), getBtcUsdAggregatorAddress(network, btcUsdAggregator), 8, ADDRESSES.ZERO],
    ]);
  }

  throw new Error(`Cannot find ChainlinkPriceOracleV1 params for network: ${network}`);
}

function mapPairsToParams(pairs) {
  return {
    tokens: pairs.map(pair => pair[0]),
    aggregators: pairs.map(pair => pair[1]),
    tokenDecimals: pairs.map(pair => pair[2]),
    tokenPairs: pairs.map(pair => pair[3]),
  };
}

module.exports = {
  getChainlinkPriceOracleV1Params,
  getChainlinkPriceOracleContract,
};
