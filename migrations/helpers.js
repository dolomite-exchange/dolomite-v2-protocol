const Web3 = require('web3');
const {
  coefficientsToString,
  decimalToString
} = require('../dist/src/lib/Helpers');

// ============ Network Helper Functions ============

function isDevNetwork(network) {
  verifyNetwork(network);
  return network.startsWith('development')
    || network.startsWith('test')
    || network.startsWith('test_ci')
    || network.startsWith('develop')
    || network.startsWith('dev')
    || network.startsWith('docker')
    || network.startsWith('coverage');
}

// ================== Filtered Networks ==================

function isEthereumNetwork(network) {
  return isEthereumMainnet(network) || isKovan(network) || isGoerli(network);
}

function isArbitrumNetwork(network) {
  return isArbitrumOne(network) || isArbitrumGoerli(network);
}

function isMaticNetwork(network) {
  return isMaticProd(network) || isMumbaiMatic(network);
}

function isProductionNetwork(network) {
  return isEthereumMainnet(network) || isMaticProd(network) || isArbitrumOne(network);
}

// ================== Production Networks ==================

function isEthereumMainnet(network) {
  verifyNetwork(network);
  return network.startsWith('mainnet');
}

function isMaticProd(network) {
  verifyNetwork(network);
  return network.startsWith('matic');
}

function isArbitrumOne(network) {
  verifyNetwork(network);
  return network.startsWith('arbitrum_one');
}

// ================== Test Networks ==================

function isKovan(network) {
  verifyNetwork(network);
  return network.startsWith('kovan');
}

function isGoerli(network) {
  verifyNetwork(network);
  return network.startsWith('goerli');
}

function isMumbaiMatic(network) {
  verifyNetwork(network);
  return network.startsWith('mumbai_matic');
}

function isArbitrumGoerli(network) {
  verifyNetwork(network);
  return network.startsWith('arbitrum_goerli');
}

function isDocker(network) {
  verifyNetwork(network);
  return network.startsWith('docker');
}

function getChainId(network) {
  if (isEthereumMainnet(network)) {
    return 1;
  }
  if (isGoerli(network)) {
    return 5;
  }
  if (isArbitrumOne(network)) {
    return 42161;
  }
  if (isArbitrumGoerli(network)) {
    return 421613;
  }
  if (isMaticProd(network)) {
    return 137;
  }
  if (isMumbaiMatic(network)) {
    return 80001;
  }
  if (isKovan(network)) {
    return 42;
  }
  if (network.startsWith('coverage')) {
    return 1002;
  }
  if (network.startsWith('docker')) {
    return 1313;
  }
  if (network.startsWith('test') || network.startsWith('test_ci')) {
    return 1001;
  }
  throw new Error('No chainId for network ' + network);
}

async function getRiskLimits() {
  return {
    marginRatioMax: decimalToString('2.00'), // 200%
    liquidationSpreadMax: decimalToString('0.50'), // 50%
    earningsRateMax: decimalToString('1.00'), // 100%
    marginPremiumMax: decimalToString('2.00'), // 200%
    liquidationSpreadPremiumMax: decimalToString('5.00'), // 500%
    interestRateMax: decimalToString('100.00'), // 10,000%
    minBorrowedValueMax: '100000000000000000000000000000000000000', // $100
  };
}

async function getRiskParams(network) {
  verifyNetwork(network);
  let minBorrowedValue = '0.00';
  if (isDevNetwork(network)) {
    minBorrowedValue = '0.05';
  }
  return {
    marginRatio: { value: decimalToString('0.15') },
    liquidationSpread: { value: decimalToString('0.05') },
    earningsRate: { value: decimalToString('0.90') },
    minBorrowedValue: { value: decimalToString(minBorrowedValue) },
    accountMaxNumberOfMarketsWithBalances: '32',
    callbackGasLimit: '2000000',
  };
}

async function getPolynomialParams() {
  return {
    maxAPR: decimalToString('1.00'), // 100%
    coefficients: coefficientsToString([0, 10, 10, 0, 0, 80]),
  };
}

async function getDoubleExponentParams() {
  return {
    maxAPR: decimalToString('1.00'), // 100%
    coefficients: coefficientsToString([0, 20, 0, 0, 0, 0, 20, 60]),
  };
}

function getExpiryRampTime(network) {
  if (isArbitrumNetwork(network) || isMaticNetwork(network)) {
    return '300';
  } else {
    return '3600';
  }
}

function verifyNetwork(network) {
  if (!network) {
    throw new Error('No network provided');
  }
}

function getSenderAddress(network, accounts) {
  const web3 = new Web3(process.env.NODE_URL);
  if (isEthereumMainnet(network) || isKovan(network) || isGoerli(network)) {
    return accounts[0];
  }
  if (isDevNetwork(network)) {
    return accounts[0];
  }
  if (isMumbaiMatic(network)) {
    return accounts[0];
  }
  if (isMaticProd(network)) {
    return accounts[0];
  }
  if (isArbitrumOne(network) || isArbitrumGoerli(network)) {
    return web3.eth.accounts.privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY).address;
  }
  throw new Error('Cannot find Sender address');
}

function getDelayedMultisigAddress(network) {
  if (
    isEthereumMainnet(network)
    || isGoerli(network)
    || isArbitrumOne(network)
    || isArbitrumGoerli(network)
  ) {
    return '0xE412991Fb026df586C2f2F9EE06ACaD1A34f585B';
  }
  if (isKovan(network)) {
    throw new Error('No Kovan multisig');
  }
  if (isMumbaiMatic(network)) {
    return '0x874Ad8fb87a67B1A33C5834CC8820DBa80D18Bbb';
  }
  throw new Error('Cannot find DelayedMultisig for network: ' + network);
}

function getGnosisSafeAddress(network) {
  if (isEthereumMainnet(network) || isGoerli(network) || isArbitrumOne(network)) {
    return '0xa75c21C5BE284122a87A37a76cc6C4DD3E55a1D4';
  }
  if (isArbitrumGoerli(network)) {
    return '0xE412991Fb026df586C2f2F9EE06ACaD1A34f585B'; // use the delayed multi sig
  }
  if (isMumbaiMatic(network)) {
    return '0x874Ad8fb87a67B1A33C5834CC8820DBa80D18Bbb'; // use the delayed multi sig
  }
  throw new Error('Cannot find GnosisSafe for network: ' + network);
}

function getChainlinkFlags(network, TestChainlinkFlags) {
  if (isDevNetwork(network)) {
    return TestChainlinkFlags.address;
  } else if (isArbitrumOne(network)) {
    return '0xFdB631F5EE196F0ed6FAa767959853A9F217697D';
  } else if (isArbitrumGoerli(network)) {
    return '0x4da69F028a5790fCCAfe81a75C0D24f46ceCDd69';
  }
  return '0x0000000000000000000000000000000000000000';
}

function getUniswapV3MultiRouter(network, TestUniswapV3MultiRouter) {
  if (isDevNetwork(network)) {
    return TestUniswapV3MultiRouter.address;
  }

  return '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
}

const shouldOverwrite = (contract, network) => {
  const basicCondition = process.env.OVERWRITE_EXISTING_CONTRACTS === 'true' || isDevNetwork(network);
  if (basicCondition) {
    return true;
  }

  try {
    return !contract.address;
  } catch (e) {
    // The address can't be retrieved, which means there isn't one.
    return true;
  }
};

const getNoOverwriteParams = () => ({ overwrite: false });

module.exports = {
  isEthereumNetwork,
  isArbitrumNetwork,
  isMaticNetwork,
  isProductionNetwork,
  isGoerli,
  isArbitrumOne,
  isArbitrumGoerli,
  getChainId,
  isDevNetwork,
  isEthereumMainnet,
  isMaticProd,
  isMumbaiMatic,
  isKovan,
  isDocker,
  getRiskLimits,
  getRiskParams,
  getPolynomialParams,
  getDoubleExponentParams,
  getExpiryRampTime,
  getSenderAddress,
  getDelayedMultisigAddress,
  getGnosisSafeAddress,
  getChainlinkSequencerUptimeFeed: getChainlinkFlags,
  getUniswapV3MultiRouter,
  shouldOverwrite,
  getNoOverwriteParams,
};
