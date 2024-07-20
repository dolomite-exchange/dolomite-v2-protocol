import BigNumber from 'bignumber.js';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { fastForward, resetEVM, snapshot } from '../helpers/EVM';
import { address, ADDRESSES, INTEGERS } from '../../src';
import { expectThrow } from '../helpers/Expect';
import { TestChainlinkPriceOracleV1 } from '../../build/testing_wrappers/TestChainlinkPriceOracleV1';
import { deployContract } from '../helpers/Deploy';

// JSON
import ChainlinkPriceOracleJson from '../../build/contracts/ChainlinkPriceOracleV1.json';

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
  let chainlinkOracle: TestChainlinkPriceOracleV1;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    user = accounts[1];

    chainlinkOracle = dolomiteMargin.contracts.chainlinkPriceOracleV1;
    await resetEVM();
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('#constructor', () => {
    it('should succeed when values are aligned', async () => {
      await deployContract(dolomiteMargin, ChainlinkPriceOracleJson, [
        [ADDRESSES.ZERO],
        [ADDRESSES.ZERO],
        [8],
        [ADDRESSES.ZERO],
        dolomiteMargin.address,
      ]);
    });

    it('should fail when token length is not aligned', async () => {
      await expectThrow(
        deployContract(dolomiteMargin, ChainlinkPriceOracleJson, [
          [ADDRESSES.ZERO],
          [ADDRESSES.ZERO, ADDRESSES.ZERO],
          [8, 8],
          [ADDRESSES.ZERO, ADDRESSES.ZERO],
          dolomiteMargin.address,
        ]),
        'ChainlinkPriceOracleV1: Invalid tokens length',
      );
    });

    it('should fail when aggregator length is not aligned', async () => {
      await expectThrow(
        deployContract(dolomiteMargin, ChainlinkPriceOracleJson, [
          [ADDRESSES.ZERO, ADDRESSES.ZERO],
          [ADDRESSES.ZERO, ADDRESSES.ZERO],
          [8],
          [ADDRESSES.ZERO, ADDRESSES.ZERO],
          dolomiteMargin.address,
        ]),
        'ChainlinkPriceOracleV1: Invalid aggregators length',
      );
    });

    it('should fail when token decimal length is not aligned', async () => {
      await expectThrow(
        deployContract(dolomiteMargin, ChainlinkPriceOracleJson, [
          [ADDRESSES.ZERO, ADDRESSES.ZERO],
          [ADDRESSES.ZERO, ADDRESSES.ZERO],
          [8, 8],
          [ADDRESSES.ZERO],
          dolomiteMargin.address,
        ]),
        'ChainlinkPriceOracleV1: Invalid decimals length',
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value for a token with 18 decimals', async () => {
      const price = await dolomiteMargin.contracts.callConstantContractFunction(
        chainlinkOracle.methods.getPrice(dolomiteMargin.payableToken.address),
      );
      expect(new BigNumber(price.value)).to.eql(WETH_PRICE);
    });

    it('returns the correct value for a token with less than 18 decimals', async () => {
      const price = await dolomiteMargin.contracts.callConstantContractFunction(
        chainlinkOracle.methods.getPrice(dolomiteMargin.contracts.tokenD.options.address),
      );
      expect(new BigNumber(price.value)).to.eql(BTC_PRCE);
    });

    it('returns the correct value for a token with less than 18 decimals and non-USD base price', async () => {
      const price = await dolomiteMargin.contracts.callConstantContractFunction(
        chainlinkOracle.methods.getPrice(dolomiteMargin.contracts.tokenA.options.address),
      );
      expect(new BigNumber(price.value)).to.eql(USDC_PRCE);
    });

    it('returns the correct value for a token with non-USDC base and 18 decimals', async () => {
      const price = await dolomiteMargin.contracts.callConstantContractFunction(
        chainlinkOracle.methods.getPrice(dolomiteMargin.contracts.tokenF.options.address),
      );
      expect(new BigNumber(price.value)).to.eql(LRC_PRICE);
    });

    it('reverts when an invalid address is passed in', async () => {
      await expectThrow(
        dolomiteMargin.contracts.callConstantContractFunction(chainlinkOracle.methods.getPrice(ADDRESSES.ZERO)),
        `ChainlinkPriceOracleV1: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        dolomiteMargin.contracts.callConstantContractFunction(chainlinkOracle.methods.getPrice(ADDRESSES.ONE)),
        `ChainlinkPriceOracleV1: Invalid token <${ADDRESSES.ONE}>`,
      );
      await expectThrow(
        dolomiteMargin.contracts.callConstantContractFunction(
          chainlinkOracle.methods.getPrice(ADDRESSES.TEST_SAI_PRICE_ORACLE),
        ),
        `ChainlinkPriceOracleV1: Invalid token <${ADDRESSES.TEST_SAI_PRICE_ORACLE}>`,
      );
    });

    it('reverts when the price is expired', async () => {
      await dolomiteMargin.testing.chainlinkAggregator.setLatestPrice(new BigNumber('20000000000')); // $200
      await fastForward(60 * 60 * 36); // prices expire in 36 hours by default
      await dolomiteMargin.chainlinkPriceOracle.ownerInsertOrUpdateOracleToken(
        dolomiteMargin.testing.tokenD.address,
        18,
        dolomiteMargin.testing.chainlinkAggregator.address,
        ADDRESSES.ZERO,
        { from: admin },
      );
      await expectThrow(
        dolomiteMargin.contracts.callConstantContractFunction(
          chainlinkOracle.methods.getPrice(dolomiteMargin.testing.tokenD.address),
        ),
        `ChainlinkPriceOracleV1: Chainlink price expired <${dolomiteMargin.testing.tokenD.address.toLowerCase()}>`,
      );
    });

    it('reverts when the price is too low', async () => {
      await dolomiteMargin.testing.chainlinkAggregator.setLatestPrice(INTEGERS.ONE);
      await dolomiteMargin.testing.chainlinkAggregator.setMinAnswer(INTEGERS.MAX_INT_192);
      await dolomiteMargin.chainlinkPriceOracle.ownerInsertOrUpdateOracleToken(
        dolomiteMargin.testing.tokenD.address,
        18,
        dolomiteMargin.testing.chainlinkAggregator.address,
        ADDRESSES.ZERO,
        { from: admin },
      );
      await expectThrow(
        dolomiteMargin.contracts.callConstantContractFunction(
          chainlinkOracle.methods.getPrice(dolomiteMargin.testing.tokenD.address),
        ),
        'ChainlinkPriceOracleV1: Chainlink price too low',
      );
    });

    it('reverts when the price is too high', async () => {
      await dolomiteMargin.testing.chainlinkAggregator.setLatestPrice(INTEGERS.MAX_INT_192);
      await dolomiteMargin.testing.chainlinkAggregator.setMaxAnswer(INTEGERS.ONE);
      await dolomiteMargin.chainlinkPriceOracle.ownerInsertOrUpdateOracleToken(
        dolomiteMargin.testing.tokenD.address,
        18,
        dolomiteMargin.testing.chainlinkAggregator.address,
        ADDRESSES.ZERO,
        { from: admin },
      );
      await expectThrow(
        dolomiteMargin.contracts.callConstantContractFunction(
          chainlinkOracle.methods.getPrice(dolomiteMargin.testing.tokenD.address),
        ),
        'ChainlinkPriceOracleV1: Chainlink price too high',
      );
    });
  });

  describe('#ownerSetStalenessThreshold', () => {
    it('works normally', async () => {
      const stalenessThreshold = INTEGERS.ONE_DAY_IN_SECONDS.plus(1234);
      await dolomiteMargin.chainlinkPriceOracle.ownerSetStalenessThreshold(stalenessThreshold, { from: admin });
      expect(await dolomiteMargin.chainlinkPriceOracle.getStalenessThreshold()).to.eql(stalenessThreshold);
    });

    it('fails when invoked by non-admin', async () => {
      const stalenessThreshold = INTEGERS.ONE_DAY_IN_SECONDS;
      await expectThrow(
        dolomiteMargin.chainlinkPriceOracle.ownerSetStalenessThreshold(stalenessThreshold, { from: user }),
      );
    });

    it('fails when too low', async () => {
      const stalenessThreshold = INTEGERS.ONE_DAY_IN_SECONDS.minus(1);
      await expectThrow(
        dolomiteMargin.chainlinkPriceOracle.ownerSetStalenessThreshold(stalenessThreshold, { from: admin }),
        `ChainlinkPriceOracleV1: Staleness threshold too low <${stalenessThreshold.toFixed()}>`,
      );
    });

    it('fails when too high', async () => {
      const stalenessThreshold = INTEGERS.ONE_DAY_IN_SECONDS.times(7).plus(1);
      await expectThrow(
        dolomiteMargin.chainlinkPriceOracle.ownerSetStalenessThreshold(stalenessThreshold, { from: admin }),
        `ChainlinkPriceOracleV1: Staleness threshold too high <${stalenessThreshold.toFixed()}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateOracleToken', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = dolomiteMargin.testing.erroringToken.address;
      await dolomiteMargin.chainlinkPriceOracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        18,
        ADDRESSES.TEST_SAI_PRICE_ORACLE,
        ADDRESSES.ZERO,
        { from: admin },
      );
      expect(await dolomiteMargin.chainlinkPriceOracle.getTokenDecimalsByToken(tokenAddress)).to.eql(18);
      expect(await dolomiteMargin.chainlinkPriceOracle.getAggregatorByToken(tokenAddress)).to.eql(
        ADDRESSES.TEST_SAI_PRICE_ORACLE,
      );
      expect(await dolomiteMargin.chainlinkPriceOracle.getCurrencyPairingByToken(tokenAddress)).to.eql(ADDRESSES.ZERO);
    });

    it('can update an existing oracle', async () => {
      const tokenAddress = dolomiteMargin.testing.tokenA.address;
      await dolomiteMargin.chainlinkPriceOracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        9,
        ADDRESSES.TEST_SAI_PRICE_ORACLE,
        ADDRESSES.ZERO,
        { from: admin },
      );
      expect(await dolomiteMargin.chainlinkPriceOracle.getTokenDecimalsByToken(tokenAddress)).to.eql(9);
      expect(await dolomiteMargin.chainlinkPriceOracle.getAggregatorByToken(tokenAddress)).to.eql(
        ADDRESSES.TEST_SAI_PRICE_ORACLE,
      );
      expect(await dolomiteMargin.chainlinkPriceOracle.getCurrencyPairingByToken(tokenAddress)).to.eql(ADDRESSES.ZERO);
    });

    it('fails when invoked by non-admin', async () => {
      const tokenAddress = dolomiteMargin.testing.tokenA.address;
      await expectThrow(
        dolomiteMargin.chainlinkPriceOracle.ownerInsertOrUpdateOracleToken(
          tokenAddress,
          9,
          ADDRESSES.TEST_SAI_PRICE_ORACLE,
          ADDRESSES.TEST_UNISWAP,
          { from: user },
        ),
        `OnlyDolomiteMargin: Only Dolomite owner can call <${user.toLowerCase()}>`,
      );
    });

    it('fails when non-zero paired token does not have an aggregator', async () => {
      const tokenAddress = dolomiteMargin.testing.tokenA.address;
      await expectThrow(
        dolomiteMargin.chainlinkPriceOracle.ownerInsertOrUpdateOracleToken(
          tokenAddress,
          9,
          ADDRESSES.TEST_SAI_PRICE_ORACLE,
          ADDRESSES.TEST_UNISWAP,
          { from: admin },
        ),
        `ChainlinkPriceOracleV1: Invalid token pair <${ADDRESSES.TEST_UNISWAP.toLowerCase()}>`,
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
