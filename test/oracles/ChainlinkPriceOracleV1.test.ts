import BigNumber from 'bignumber.js';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { resetEVM, snapshot } from '../helpers/EVM';
import { address, ADDRESSES, INTEGERS } from '../../src';
import { expectThrow } from '../helpers/Expect';
import TestChainlinkPriceOracleV1Json from '../../build/contracts/TestChainlinkPriceOracleV1.json';
import { TestChainlinkPriceOracleV1 } from '../../build/testing_wrappers/TestChainlinkPriceOracleV1';

let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
let admin: address;
let user: address;
const BTC_PRCE = new BigNumber('96205880000000000000000000000000'); // 30 decimals
const LRC_PRICE = new BigNumber('39402846000000000'); // 18 decimals
const USDC_PRCE = new BigNumber('1000000000000000000000000000000'); // 30 decimals
const WETH_PRICE = new BigNumber('211400000000000000000'); // 18 decimals
const defaultIsClosing = false;

describe('ChainlinkPriceOracleV1', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    user = accounts[1];

    await resetEVM();
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  function chainlinkOracle() {
    return dolomiteMargin.contracts.chainlinkPriceOracleV1.methods;
  }

  describe('#getPrice', () => {
    it('returns the correct value for a token with 18 decimals', async () => {
      const price = await dolomiteMargin.contracts.callConstantContractFunction(
        chainlinkOracle().getPrice(dolomiteMargin.contracts.weth.options.address),
      );
      expect(new BigNumber(price.value)).to.eql(WETH_PRICE);
    });

    it('returns the correct value for a token with 18 decimals when chainlink flags are active', async () => {
      const testOracle = new dolomiteMargin.web3.eth.Contract(
        TestChainlinkPriceOracleV1Json.abi,
        dolomiteMargin.contracts.chainlinkPriceOracleV1.options.address,
      ) as TestChainlinkPriceOracleV1;
      await dolomiteMargin.contracts.callContractFunction(
        testOracle.methods.setChainlinkFlags(dolomiteMargin.contracts.testChainlinkFlags.options.address),
        { from: admin },
      );
      const price = await dolomiteMargin.contracts.callConstantContractFunction(
        chainlinkOracle().getPrice(dolomiteMargin.contracts.weth.options.address),
      );
      expect(new BigNumber(price.value)).to.eql(WETH_PRICE);
    });

    it('Fails when Arbitrum sequencer is offline', async () => {
      const testOracle = new dolomiteMargin.web3.eth.Contract(
        TestChainlinkPriceOracleV1Json.abi,
        dolomiteMargin.contracts.chainlinkPriceOracleV1.options.address,
      ) as TestChainlinkPriceOracleV1;
      await dolomiteMargin.contracts.callContractFunction(
        dolomiteMargin.contracts.testChainlinkFlags.methods.setShouldReturnOffline(true),
        { from: admin }
      );
      await dolomiteMargin.contracts.callContractFunction(
        testOracle.methods.setChainlinkFlags(dolomiteMargin.contracts.testChainlinkFlags.options.address),
        { from: admin }
      );
      await expectThrow(
        dolomiteMargin.contracts.callConstantContractFunction(
          chainlinkOracle().getPrice(dolomiteMargin.contracts.weth.options.address),
        ),
        'ChainlinkPriceOracleV1: Chainlink price oracles offline',
      );
    });

    it('returns the correct value for a token with less than 18 decimals', async () => {
      const price = await dolomiteMargin.contracts.callConstantContractFunction(
        chainlinkOracle().getPrice(dolomiteMargin.contracts.tokenD.options.address),
      );
      expect(new BigNumber(price.value)).to.eql(BTC_PRCE);
    });

    it('returns the correct value for a token with less than 18 decimals and non-USD base price', async () => {
      const price = await dolomiteMargin.contracts.callConstantContractFunction(
        chainlinkOracle().getPrice(dolomiteMargin.contracts.tokenA.options.address),
      );
      expect(new BigNumber(price.value)).to.eql(USDC_PRCE);
    });

    it('returns the correct value for a token with non-USDC base and 18 decimals', async () => {
      const price = await dolomiteMargin.contracts.callConstantContractFunction(
        chainlinkOracle().getPrice(dolomiteMargin.contracts.tokenF.options.address),
      );
      expect(new BigNumber(price.value)).to.eql(LRC_PRICE);
    });

    it('reverts when an invalid address is passed in', async () => {
      const pricePromise = dolomiteMargin.contracts.callConstantContractFunction(
        chainlinkOracle().getPrice(ADDRESSES.ZERO),
      );
      await expectThrow(pricePromise, `ChainlinkPriceOracleV1: invalid token <${ADDRESSES.ZERO}>`);
    });
  });

  describe('integration', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = dolomiteMargin.testing.erroringToken.address;
      await dolomiteMargin.chainlinkPriceOracle.insertOrUpdateOracleToken(
        tokenAddress,
       18,
        ADDRESSES.TEST_SAI_PRICE_ORACLE,
        8,
        ADDRESSES.ZERO,
        { from: admin },
      );
      expect(await dolomiteMargin.chainlinkPriceOracle.getTokenDecimalsByToken(tokenAddress)).to.eql(18);
      expect(await dolomiteMargin.chainlinkPriceOracle.getAggregatorByToken(tokenAddress))
        .to.eql(ADDRESSES.TEST_SAI_PRICE_ORACLE);
      expect(await dolomiteMargin.chainlinkPriceOracle.getAggregatorDecimalsByToken(tokenAddress)).to.eql(8);
      expect(await dolomiteMargin.chainlinkPriceOracle.getCurrencyPairingByToken(tokenAddress)).to.eql(ADDRESSES.ZERO);
    });

    it('can update an existing oracle', async () => {
      const tokenAddress = dolomiteMargin.testing.tokenA.address;
      await dolomiteMargin.chainlinkPriceOracle.insertOrUpdateOracleToken(
        tokenAddress,
       9,
        ADDRESSES.TEST_SAI_PRICE_ORACLE,
        18,
        ADDRESSES.TEST_UNISWAP,
        { from: admin },
      );
      expect(await dolomiteMargin.chainlinkPriceOracle.getTokenDecimalsByToken(tokenAddress)).to.eql(9);
      expect(await dolomiteMargin.chainlinkPriceOracle.getAggregatorByToken(tokenAddress))
        .to.eql(ADDRESSES.TEST_SAI_PRICE_ORACLE);
      expect(await dolomiteMargin.chainlinkPriceOracle.getAggregatorDecimalsByToken(tokenAddress)).to.eql(18);
      expect(await dolomiteMargin.chainlinkPriceOracle.getCurrencyPairingByToken(tokenAddress))
        .to.eql(ADDRESSES.TEST_UNISWAP);
    });

    it('fails when invoked by non-admin', async () => {
      const tokenAddress = dolomiteMargin.testing.tokenA.address;
      await expectThrow(
        dolomiteMargin.chainlinkPriceOracle.insertOrUpdateOracleToken(
          tokenAddress,
          9,
          ADDRESSES.TEST_SAI_PRICE_ORACLE,
          18,
          ADDRESSES.TEST_UNISWAP,
          { from: user },
        ),
      );
    });

    it('can be set as the oracle for a market', async () => {
      await dolomiteMargin.admin.addMarket(
        dolomiteMargin.testing.tokenA.address,
        dolomiteMargin.contracts.chainlinkPriceOracleV1.options.address,
        dolomiteMargin.contracts.testInterestSetter.options.address,
        INTEGERS.ZERO,
        INTEGERS.ZERO,
        INTEGERS.ZERO,
        INTEGERS.ZERO,
        INTEGERS.ZERO,
        defaultIsClosing,
        { from: admin },
      );
      const price = await dolomiteMargin.getters.getMarketPrice(INTEGERS.ZERO);
      expect(price).to.eql(USDC_PRCE);
    });
  });
});
