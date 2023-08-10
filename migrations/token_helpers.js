const {
  isDevNetwork,
  isEthereumMainnet,
  isKovan,
  isMaticProd,
  isMumbaiMatic,
  isArbitrumOne,
  isArbitrumGoerli,
} = require('./helpers');

function getDaiAddress(network, TokenB) {
  if (isMaticProd(network)) {
    return '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063';
  }
  if (isMumbaiMatic(network)) {
    return '0x8ac8Ae0A208bEf466512Cd26142aC5A3DDb5B99E';
  }
  if (isDevNetwork(network)) {
    return TokenB.address;
  }
  if (isEthereumMainnet(network)) {
    return '0x6b175474e89094c44da98b954eedeac495271d0f';
  }
  if (isKovan(network)) {
    return '0x4448d5F172FC3073C458d72C8Ee97A81cd824962';
  }
  if (isArbitrumOne(network)) {
    return '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1';
  }
  if (isArbitrumGoerli(network)) {
    return '0xE65A051E0ae02eB66a11c73B2BA14021B5aadAEE';
  }
  throw new Error('Cannot find DAI');
}

function getLinkAddress(network, TokenE) {
  if (isDevNetwork(network)) {
    return TokenE.address;
  }
  if (isEthereumMainnet(network)) {
    return '0x514910771af9ca656af840dff83e8264ecf986ca';
  }
  if (isKovan(network)) {
    return '0xBd86728Ce5b0da9760c18E871Fe9AaA3F8AC6E10';
  }
  if (isMaticProd(network)) {
    return '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39';
  }
  if (isMumbaiMatic(network)) {
    return '0x326C977E6efc84E512bB9C30f76E30c160eD06FB';
  }
  if (isArbitrumOne(network)) {
    return '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4';
  }
  if (isArbitrumGoerli(network)) {
    return '0x2d3B3F17d6694d5AA643Cb89A82Ac9214a41536d';
  }
  throw new Error('Cannot find LINK');
}

function getLrcAddress(network, TokenF) {
  if (isDevNetwork(network)) {
    return TokenF.address;
  }
  if (isEthereumMainnet(network)) {
    return '0xbbbbca6a901c926f240b89eacb641d8aec7aeafd';
  }
  if (isKovan(network)) {
    return '0x9372c3ecf9487418739be231b2d3bcb69f19cdfc';
  }
  if (isMumbaiMatic(network)) {
    return '0xd64cD7A5Cd54C90be14B601dEe83b87546f975c7';
  }
  if (isArbitrumOne(network)) {
    return '0x46d0cE7de6247b0A95f67b43B589b4041BaE7fbE'
  }
  throw new Error('Cannot find LRC');
}

function getMaticAddress(network, artifact) {
  if (isMaticProd(network)) {
    return '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  }
  if (isMumbaiMatic(network)) {
    return '0xBeE8c17b7449fa0cC54D857D774cE523A7A35d00';
  }
  if (isDevNetwork(network)) {
    return artifact.address;
  }
  if (isEthereumMainnet(network)) {
    return '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0';
  }
  if (isKovan(network)) {
    return '';
  }
  if (isArbitrumOne(network)) {
    throw new Error('MATIC is not supported on Arbitrum');
  }
  throw new Error('Cannot find MATIC');
}

function getUsdcAddress(network, TokenA) {
  if (isMaticProd(network)) {
    return '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  }
  if (isMumbaiMatic(network)) {
    return '0xaDe692C9B8C36e6b04bCFD01f0E91c7EbeE0A160';
  }
  if (isDevNetwork(network)) {
    return TokenA.address;
  }
  if (isEthereumMainnet(network)) {
    return '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  }
  if (isKovan(network)) {
    return '0xfb5755567e071663F2DA276aC1D6167B093f00f4';
  }
  if (isArbitrumOne(network)) {
    return '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8';
  }
  if (isArbitrumGoerli(network)) {
    return '0x7317eb743583250739862644cef74B982708eBB4';
  }
  throw new Error('Cannot find USDC');
}

function getUsdtAddress(network) {
  if (isArbitrumOne(network)) {
    return '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';
  }
  throw new Error('Cannot find USDT');
}

function getWbtcAddress(network, TokenD) {
  if (isDevNetwork(network)) {
    return TokenD.address;
  }
  if (isEthereumMainnet(network)) {
    return '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
  }
  if (isKovan(network)) {
    return '0xB889322114475137815678748419b67818fBa92c';
  }
  if (isMumbaiMatic(network)) {
    return '0x49769b4755ea8B83A340c24eAeD9d887A4b61104';
  }
  if (isMaticProd(network)) {
    return '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6';
  }
  if (isArbitrumOne(network)) {
    return '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';
  }
  if (isArbitrumGoerli(network)) {
    return '0x6fA07522F1dd8D8cb5b400c957418b4bD2C96F80';
  }
  throw new Error('Cannot find WBTC');
}

function getWethAddress(network, WETH) {
  if (isMaticProd(network)) {
    return '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619';
  }
  if (isMumbaiMatic(network)) {
    return '0xa38eF095D071ebBAFeA5E7D1Ce02BE79fc376793';
  }
  if (isDevNetwork(network)) {
    return WETH.address;
  }
  if (isEthereumMainnet(network)) {
    return '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  }
  if (isKovan(network)) {
    return '0xd0a1e359811322d97991e03f863a0c30c2cf029c';
  }
  if (isArbitrumOne(network)) {
    return '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
  }
  if (isArbitrumGoerli(network)) {
    return '0xC033378c6eEa969C001CE9438973ca4d6460999a';
  }
  throw new Error('Cannot find WETH');
}

function getWrappedCurrencyAddress(network, WETH) {
  if (isMaticProd(network) || isMumbaiMatic(network)) {
    return getMaticAddress(network)
  }

  // fall through case
  return getWethAddress(network, WETH)
}

module.exports = {
  getDaiAddress,
  getLinkAddress,
  getLrcAddress,
  getMaticAddress,
  getUsdcAddress,
  getUsdtAddress,
  getWbtcAddress,
  getWethAddress,
  getWrappedCurrencyAddress,
};
