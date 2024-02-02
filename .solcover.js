const { execSync } = require('child_process');
const chainId = 1002;
const port = 8555;

// At this point, most of the files that are ignored are because our codebase is too large. So we ignore the things
// that we don't plan on using anymore
module.exports = {
  skipFiles: [
    'Migrations.sol',
    'external/interestsetters/',
    'external/interfaces/',
    'external/lib/TypedSignature.sol',
    'external/multisig/',
    'external/rebalancers/',
    'external/utils/',
    'protocol/interfaces/',
    'testing/',
  ],
  measureFunctionCoverage: false, // done because of this error here: https://github.com/sc-forks/solidity-coverage/blob/master/docs/faq.md#running-out-of-memory
  measureStatementCoverage: false, // done because of this error here: https://github.com/sc-forks/solidity-coverage/blob/master/docs/faq.md#running-out-of-memory
  providerOptions: {
    chainId: chainId,
    keepAliveTimeout: 600000,
    mnemonic: 'myth like bonus scare over problem client lizard pioneer submit female collect',
    network_id: chainId,
    port: port,
  },
  port: port,
  mocha: {
    parallel: false, // DO NOT CHANGE
    slow: 15000, // 15 seconds
    timeout: 3600000, // 1 hour
  },
  client: require('ganache-cli'),
  configureYulOptimizer: true,
  onServerReady: async () => {
    execSync('rm -rf contracts_coverage && cp -r contracts/ contracts_coverage/', { stdio: 'inherit' });
    execSync('python util/fix_contracts_for_coverage.py', { stdio: 'inherit' });
  },
  onCompileComplete: async () => {
    execSync('echo \"Deploying coverage instance\"', { stdio: 'inherit' });
    execSync('npm run deploy_coverage', { stdio: 'inherit' });
  },
};
