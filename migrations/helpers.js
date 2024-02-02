const {
  coefficientsToString,
  decimalToString
} = require('../dist/src/lib/Helpers');

// ============ Network Helper Functions ============

function isDevNetwork(network) {
  verifyNetwork(network);
  return network === 'dev'
    || network === 'docker'
    || isCoverageTestNetwork(network)
    || isLocalTestNetwork(network);
}

function isLocalTestNetwork(network) {
  verifyNetwork(network);
  return network.startsWith('test');
}

function isCoverageTestNetwork(network) {
  verifyNetwork(network);
  return network.startsWith('coverage');
}

// ================== Filtered Networks ==================

function isEthereumNetwork(network) {
  return isEthereumMainnet(network);
}

function isArbitrumNetwork(network) {
  return isArbitrumOne(network) || isArbitrumGoerli(network);
}

function isPolygonZkEvmNetwork(network) {
  return isPolygonZkEvm(network);
}

function isBaseNetwork(network) {
  return isBase(network) || isBaseSepolia(network);
}

function isProductionNetwork(network) {
  return isEthereumMainnet(network) || isPolygonZkEvm(network) || isArbitrumOne(network) || isBase(network) || isX1(network);
}

// ================== Production Networks ==================

function isEthereumMainnet(network) {
  verifyNetwork(network);
  return network === 'mainnet';
}

function isPolygonZkEvm(network) {
  verifyNetwork(network);
  return network === 'polygon_zkevm';
}

function isArbitrumOne(network) {
  verifyNetwork(network);
  return network === 'arbitrum_one';
}

function isBase(network) {
  verifyNetwork(network);
  return network === 'base';
}

function isX1(network) {
  verifyNetwork(network);
  return network === 'x1';
}

function isX1Network(network) {
  verifyNetwork(network);
  return isX1(network);
}

// ================== Test Networks ==================

function isArbitrumGoerli(network) {
  verifyNetwork(network);
  return network === 'arbitrum_goerli';
}

function isBaseSepolia(network) {
  verifyNetwork(network);
  return network === 'base_sepolia';
}

function isDocker(network) {
  verifyNetwork(network);
  return network === 'docker';
}

function getChainId(network) {
  if (isEthereumMainnet(network)) {
    return 1;
  }
  if (isArbitrumOne(network)) {
    return 42161;
  }
  if (isArbitrumGoerli(network)) {
    return 421613;
  }
  if (isPolygonZkEvm(network)) {
    return 1101;
  }
  if (isBase(network)) {
    return 8453;
  }
  if (isBaseSepolia(network)) {
    return 84532;
  }
  if (isCoverageTestNetwork(network)) {
    return 1002;
  }
  if (network === 'docker') {
    return 1313;
  }
  if (isLocalTestNetwork(network)) {
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
    earningsRate: { value: decimalToString('0.85') },
    minBorrowedValue: { value: decimalToString(minBorrowedValue) },
    accountMaxNumberOfMarketsWithBalances: '32',
    callbackGasLimit: 2000000, // 2M
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

function getExpiryRampTime() {
  return '300'; // 5 minutes
}

function verifyNetwork(network) {
  if (!network) {
    throw new Error('No network provided');
  }
}

function getSenderAddress(network, accounts) {
  return accounts[0];
}

function getDelayedMultisigAddress(network) {
  if (
    isEthereumMainnet(network)
    || isArbitrumNetwork(network)
    || isPolygonZkEvmNetwork(network)
    || isBaseNetwork(network)
    || isX1(network)
  ) {
    return '0x52d7BcB650c591f6E8da90f797A1d0Bfd8fD05F9';
  }
  throw new Error('Cannot find DelayedMultisig for network: ' + network);
}

function getGnosisSafeAddress(network) {
  if (isEthereumMainnet(network) || isArbitrumOne(network) || isPolygonZkEvm(network)) {
    return '0xa75c21C5BE284122a87A37a76cc6C4DD3E55a1D4';
  }
  if (isBase(network)) {
    return '0x145637A4Aa6B2001DC9ECBc89CEf75bB960F90B2';
  }
  if (isArbitrumGoerli(network) || isBaseSepolia(network)) {
    return getDelayedMultisigAddress(network); // use the delayed multi sig
  }
  // TODO: x1
  throw new Error('Cannot find GnosisSafe for network: ' + network);
}

function getChainlinkOracleSentinelGracePeriod() {
  return 3600; // 1 hour
}

function getChainlinkSequencerUptimeFeed(network, TestSequencerUptimeFeedAggregator) {
  if (isDevNetwork(network)) {
    return TestSequencerUptimeFeedAggregator.address;
  } else if (isArbitrumOne(network)) {
    return '0xFdB631F5EE196F0ed6FAa767959853A9F217697D';
  } else if (isArbitrumGoerli(network)) {
    return '0x4da69F028a5790fCCAfe81a75C0D24f46ceCDd69';
  } else if (isBase(network)) {
    return '0xBCF85224fc0756B9Fa45aA7892530B47e10b6433';
  } else if (isBaseSepolia(network)) {
    return null;
  } else if (isPolygonZkEvm(network)) {
    return null;
  } else if (isX1(network)) {
    throw null;
  }

  throw new Error(`Cannot find Sequencer Uptime Feed for ${network}`);
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
  isBase,
  isBaseNetwork,
  isPolygonZkEvmNetwork,
  isProductionNetwork,
  isArbitrumOne,
  isArbitrumGoerli,
  isX1Network,
  getChainId,
  isDevNetwork,
  isEthereumMainnet,
  isPolygonZkEvm,
  isDocker,
  getRiskLimits,
  getRiskParams,
  getPolynomialParams,
  getDoubleExponentParams,
  getExpiryRampTime,
  getSenderAddress,
  getDelayedMultisigAddress,
  getGnosisSafeAddress,
  getChainlinkSequencerUptimeFeed,
  getChainlinkOracleSentinelGracePeriod,
  shouldOverwrite,
  getNoOverwriteParams,
};
