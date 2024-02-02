require('ts-node/register'); // eslint-disable-line
require('dotenv-flow').config(); // eslint-disable-line
const HDWalletProvider = require('@truffle/hdwallet-provider'); // eslint-disable-line
const path = require('path');

const covReplicaContractsDir = path.join(process.cwd(), '.coverage_contracts');
const covContractsDir = path.join(process.cwd(), 'contracts_coverage');
const regContractsDir = path.join(process.cwd(), 'contracts');

const pollingInterval = 40000;

module.exports = {
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY,
    arbiscan: process.env.ARBISCAN_API_KEY,
    optimistic_etherscan: process.env.OPTIMISTIC_ETHERSCAN_API_KEY,
  },
  compilers: {
    solc: {
      version: '0.5.16',
      docker: process.env.DOCKER_COMPILER === 'true',
      parser: 'solcjs',
      settings: {
        optimizer: {
          // turn off optimizations if we're running coverage tests. Coverage won't work otherwise
          enabled: !(process.env.COVERAGE_REPLICA_DEPLOY === 'true' || process.env.COVERAGE === 'true'),
          runs: 10000,
        },
        evmVersion: 'istanbul',
      },
    },
  },
  contracts_directory:
    process.env.COVERAGE_REPLICA_DEPLOY === 'true'
      ? covReplicaContractsDir
      : process.env.COVERAGE === 'true'
        ? covContractsDir
        : regContractsDir,
  mocha: {
    parallel: false, // DO NOT CHANGE
    slow: 15000, // 15 seconds
    timeout: 3600000, // 1 hour
  },
  networks: {
    test: {
      host: '0.0.0.0',
      port: 8445,
      gasPrice: 1,
      network_id: '1001',
    },
    test_ci: {
      host: '0.0.0.0',
      port: 8545,
      gasPrice: 1,
      network_id: '1001',
    },
    mainnet: {
      network_id: '1',
      provider: () => new HDWalletProvider({
        privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
        providerOrUrl: process.env.NODE_URL,
      }),
      gasPrice: Number(process.env.GAS_PRICE),
      gas: 6900000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
    },
    dev: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
      gasPrice: 1000000000, // 1 gwei
      gas: 7900000,
    },
    coverage: {
      host: '127.0.0.1',
      network_id: '1002',
      port: 8555,
      gas: 0xffffffffff,
      gasPrice: 1,
      networkCheckTimeout: 60000,
    },
    // used for "replicating" the "coverage" network to get the contract addresses for running tests
    coverage_replica: {
      host: '127.0.0.1',
      network_id: '1002',
      port: 8545,
      gas: 0xffffffffff,
      gasPrice: 1,
      networkCheckTimeout: 60000,
    },
    docker: {
      host: 'localhost',
      network_id: '1313',
      port: 8545,
      gasPrice: 1,
    },
    arbitrum_one: {
      network_id: '42161',
      provider: () => {
        return new HDWalletProvider({
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: process.env.ARBITRUM_NODE_URL,
        });
      },
      gasPrice: 1000000000, // 1 gwei
      gas: 25000000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      disableConfirmationListener: true,
    },
    arbitrum_goerli: {
      network_id: '421613',
      provider: () => {
        return new HDWalletProvider({
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: process.env.ARBITRUM_GOERLI_NODE_URL,
        });
      },
      gasPrice: 1000000000, // 1 gwei
      gas: 25000000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      disableConfirmationListener: true,
    },
    polygon_zkevm: {
      network_id: '1101',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: 'https://polygon-zkevm.drpc.org',
        });
      },
      gasPrice: 7500000000, // 7.5 gwei
      gas: 12000000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://api-zkevm.polygonscan.com/api',
        apiKey: process.env.POLYGONSCAN_API_KEY,
        explorerUrl: 'https://zkevm.polygonscan.com/address',
      },
    },
    base: {
      network_id: '8453',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: 'https://base.publicnode.com',
        });
      },
      gasPrice: 1000000000, // 1 gwei
      gas: 25000000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://api.basescan.org/api',
        apiKey: process.env.BASESCAN_API_KEY,
        explorerUrl: 'https://basescan.org/address',
      },
    },
    base_sepolia: {
      network_id: '84532',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: 'https://sepolia.base.org',
        });
      },
      gasPrice: 1000000000, // 1 gwei
      gas: 25000000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
      verify: {
        apiUrl: 'https://api-sepolia.basescan.org/api',
        apiKey: process.env.BASESCAN_API_KEY,
        explorerUrl: 'https://sepolia.basescan.org/address',
      },
    },
    x1: {
      network_id: '195',
      provider: () => {
        return new HDWalletProvider({
          pollingInterval,
          privateKeys: [process.env.DEPLOYER_PRIVATE_KEY],
          providerOrUrl: 'https://testrpc.x1.tech',
        });
      },
      gasPrice: 1000000000, // 1 gwei
      gas: 25000000,
      timeoutBlocks: 5000,
      networkCheckTimeout: 120000,
      confirmations: 0,
      deploymentPollingInterval: pollingInterval,
      disableConfirmationListener: true,
    },
  },
  plugins: ['truffle-plugin-verify', 'solidity-coverage'],
};
