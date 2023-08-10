const {
  isDevNetwork,
  isEthereumMainnet,
  isKovan,
  isMumbaiMatic,
  isMaticProd,
  isArbitrumOne,
  isArbitrumGoerli,
  isArbitrumNetwork,
} = require('./helpers');
const {
  getDaiAddress,
  getLinkAddress,
  getLrcAddress,
  getMaticAddress,
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
  if (isEthereumMainnet(network)) {
    return '0xF5fff180082d6017036B771bA883025c654BC935';
  }
  if (isKovan(network)) {
    return '0x6F47077D3B6645Cb6fb7A29D280277EC1e5fFD90';
  }
  if (isArbitrumOne(network)) {
    return '0x6ce185860a4963106506c203335a2910413708e9';
  }
  if (isArbitrumGoerli(network)) {
    return '0x6550bc2301936011c1334555e62A87705A81C12C';
  }
  throw new Error('Cannot find BTC-USD aggregator for network ' + network);
}

function getDaiUsdAggregatorAddress(network, TestDaiUsdChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestDaiUsdChainlinkAggregator.address;
  }
  if (isMumbaiMatic(network)) {
    return '0x0FCAa9c899EC5A91eBc3D5Dd869De833b06fB046';
  }
  if (isMaticProd(network)) {
    return '0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D';
  }
  if (isArbitrumOne(network)) {
    return '0xc5c8e77b397e531b8ec06bfb0048328b30e9ecfb';
  }
  if (isArbitrumGoerli(network)) {
    return '0x103b53E977DA6E4Fa92f76369c8b7e20E7fb7fe1';
  }
  throw new Error('Cannot find DAI-USD aggregator for network ' + network);
}

function getEthUsdAggregatorAddress(network, TestEthUsdChainlinkAggregator) {
  if (isMumbaiMatic(network)) {
    return '0x0715A7794a1dc8e42615F059dD6e406A6594651A';
  }
  if (isMaticProd(network)) {
    return '0xF9680D99D6C9589e2a93a78A04A279e509205945';
  }
  if (isDevNetwork(network)) {
    return TestEthUsdChainlinkAggregator.address;
  }
  if (isEthereumMainnet(network)) {
    return '0xF79D6aFBb6dA890132F9D7c355e3015f15F3406F';
  }
  if (isKovan(network)) {
    return '0xD21912D8762078598283B14cbA40Cb4bFCb87581';
  }
  if (isArbitrumOne(network)) {
    return '0x639fe6ab55c921f74e7fac1ee960c0b6293ba612';
  }
  if (isArbitrumGoerli(network)) {
    return '0x62CAe0FA2da220f43a51F86Db2EDb36DcA9A5A08';
  }
  throw new Error('Cannot find ETH-USD aggregator for network ' + network);
}

function getLinkUsdAggregatorAddress(network, TestLinkUsdChainlinkAggregator) {
  if (isMaticProd(network)) {
    return '0xd9FFdb71EbE7496cC440152d43986Aae0AB76665';
  }
  if (isDevNetwork(network)) {
    return TestLinkUsdChainlinkAggregator.address;
  }
  if (isEthereumMainnet(network)) {
    return '0x32dbd3214aC75223e27e575C53944307914F7a90';
  }
  if (isKovan(network)) {
    return '0x326C977E6efc84E512bB9C30f76E30c160eD06FB';
  }
  if (isArbitrumOne(network)) {
    return '0x86e53cf1b870786351da77a57575e79cb55812cb';
  }
  if (isArbitrumGoerli(network)) {
    return '0xd28Ba6CA3bB72bF371b80a2a0a33cBcf9073C954';
  }
  throw new Error('Cannot find LINK-USD aggregator for network ' + network);
}

function getLrcEthAggregatorAddress(network, TestLrcEthChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestLrcEthChainlinkAggregator.address;
  }
  if (isEthereumMainnet(network)) {
    return '0x8770Afe90c52Fd117f29192866DE705F63e59407';
  }
  if (isKovan(network)) {
    // This really is KNC/ETH. Chainlink doesn't support LRC on Kovan, so we're spoofing it.
    return '0x0893AaF58f62279909F9F6FF2E5642f53342e77F';
  }
  throw new Error('Cannot find LRC-USD aggregator');
}

function getMaticUsdAggregatorAddress(network) {
  if (isMaticProd(network)) {
    return '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0';
  }
  if (isMumbaiMatic(network)) {
    return '0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada';
  }

  throw new Error('Cannot find MATIC-USD aggregator');
}

function getUsdcUsdAggregatorAddress(network) {
  if (isMaticProd(network)) {
    return '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7';
  }
  if (isMumbaiMatic(network)) {
    return '0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0';
  }
  if (isArbitrumOne(network)) {
    return '0x50834f3163758fcc1df9973b6e91f0f0f0434ad3';
  }
  if (isArbitrumGoerli(network)) {
    return '0x1692Bdd32F31b831caAc1b0c9fAF68613682813b';
  }
  throw new Error('Cannot find USDC-USD aggregator for network ' + network);
}

function getUsdtUsdAggregatorAddress(network) {
  if (isArbitrumOne(network)) {
    return '0x3f3f5df88dc9f13eac63df89ec16ef6e7e25dde7';
  }
  throw new Error('Cannot find USDT-USD aggregator for network ' + network);
}

function getUsdcEthAggregatorAddress(network, TestUsdcEthChainlinkAggregator) {
  if (isDevNetwork(network)) {
    return TestUsdcEthChainlinkAggregator.address;
  }
  if (isEthereumMainnet(network)) {
    return '0xdE54467873c3BCAA76421061036053e371721708';
  }
  if (isKovan(network)) {
    return '0x672c1C0d1130912D83664011E7960a42E8cA05D5';
  }
  throw new Error('Cannot find USDC-ETH aggregator');
}

function getChainlinkPriceOracleContract(network, artifacts) {
  // Oracles
  const ChainlinkPriceOracleV1 = artifacts.require('ChainlinkPriceOracleV1');
  const TestChainlinkPriceOracleV1 = artifacts.require('TestChainlinkPriceOracleV1');

  if (isDevNetwork(network)) {
    return TestChainlinkPriceOracleV1;
  } else {
    return ChainlinkPriceOracleV1;
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
  } else if (isMaticProd(network)) {
    const pairs = mapPairsToParams([
      [getDaiAddress(network), getDaiUsdAggregatorAddress(network), 18, ADDRESSES.ZERO],
      [getMaticAddress(network), getMaticUsdAggregatorAddress(network), 18, ADDRESSES.ZERO],
      [getUsdcAddress(network), getUsdcUsdAggregatorAddress(network), 6, ADDRESSES.ZERO],
      [getWethAddress(network), getEthUsdAggregatorAddress(network), 18, ADDRESSES.ZERO],
    ]);
    if (isMaticProd(network)) {
      pairs.push([getLinkAddress(network), getLinkUsdAggregatorAddress(network), 18, ADDRESSES.ZERO]);
    }
    return pairs;
  } else if (isDevNetwork(network)) {
    const {
      TokenA,
      TokenB,
      TokenD,
      TokenE,
      TokenF,
      TestWETH
    } = tokens;

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

  throw new Error('Chainlink params not set up for other networks');
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
