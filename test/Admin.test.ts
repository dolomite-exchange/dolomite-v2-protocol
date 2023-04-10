import BigNumber from 'bignumber.js';

import { address, ADDRESSES, Decimal, Integer, INTEGERS, MarketWithInfo, RiskLimits, RiskParams } from '../src';
import { stringToDecimal } from '../src/lib/Helpers';
import { getDolomiteMargin } from './helpers/DolomiteMargin';
import { setupMarkets } from './helpers/DolomiteMarginHelpers';
import { resetEVM, snapshot } from './helpers/EVM';
import { expectThrow } from './helpers/Expect';
import { TestDolomiteMargin } from './modules/TestDolomiteMargin';

let txr: any;
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
let admin: address;
let nonAdmin: address;
let operator: address;
let riskLimits: RiskLimits;
let riskParams: RiskParams;
let dolomiteMarginAddress: address;
let oracleAddress: address;
let setterAddress: address;
const smallestDecimal = stringToDecimal('1');
const defaultPrice = new BigNumber(999);
const invalidPrice = new BigNumber(0);
const defaultRate = new BigNumber(0);
const defaultPremium = new BigNumber(0);
const defaultMaxSupplyWei = new BigNumber(0);
const defaultMaxBorrowWei = new BigNumber(0);
const highPremium = new BigNumber('0.2');
const highMaxSupplyWei = new BigNumber('1000e18');
const highMaxBorrowWei = new BigNumber('1000e18');
const defaultMarket = new BigNumber(1);
const defaultIsClosing = false;
const defaultEarningsRateOverride = new BigNumber(0);
const secondaryMarket = new BigNumber(0);
const invalidMarket = new BigNumber(101);

describe('Admin', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    nonAdmin = accounts[2];
    operator = accounts[6];
    expect(admin).not.to.eql(nonAdmin);

    await resetEVM();

    [riskLimits, riskParams] = await Promise.all([
      dolomiteMargin.getters.getRiskLimits(),
      dolomiteMargin.getters.getRiskParams(),
      setupMarkets(dolomiteMargin, accounts, 2),
    ]);

    dolomiteMarginAddress = dolomiteMargin.address;
    oracleAddress = dolomiteMargin.testing.priceOracle.address;
    setterAddress = dolomiteMargin.testing.interestSetter.address;

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  // ============ Token Functions ============

  describe('#ownerWithdrawExcessTokens', () => {
    const recipient = ADDRESSES.TEST[1];
    const owner = ADDRESSES.TEST[0];
    const account1 = INTEGERS.ZERO;
    const account2 = INTEGERS.ONE;
    const market = INTEGERS.ZERO;
    const amount = new BigNumber(100);

    it('Succeeds even if has more tokens than enough', async () => {
      // has 2X tokens but has X excess
      await Promise.all([
        dolomiteMargin.testing.setAccountBalance(owner, account1, market, amount.times(2)),
        dolomiteMargin.testing.setAccountBalance(owner, account2, market, amount.times(-1)),
        dolomiteMargin.testing.tokenA.issueTo(amount.times(2), dolomiteMarginAddress),
      ]);
      const excess = await dolomiteMargin.getters.getNumExcessTokens(market);
      expect(excess).to.eql(amount);

      txr = await dolomiteMargin.admin.withdrawExcessTokens(market, recipient, {
        from: admin,
      });
      await expectBalances(txr, amount, amount);
    });

    it('Succeeds even if existing tokens arent enough', async () => {
      // has X tokens but has 3X excess
      await Promise.all([
        dolomiteMargin.testing.setAccountBalance(owner, account1, market, amount.times(-3)),
        dolomiteMargin.testing.setAccountBalance(owner, account2, market, amount.times(1)),
        dolomiteMargin.testing.tokenA.issueTo(amount, dolomiteMarginAddress),
      ]);
      const excess = await dolomiteMargin.getters.getNumExcessTokens(market);
      expect(excess).to.eql(amount.times(3));

      txr = await dolomiteMargin.admin.withdrawExcessTokens(market, recipient, {
        from: admin,
      });
      await expectBalances(txr, INTEGERS.ZERO, amount);
    });

    it('Succeeds for zero available', async () => {
      await Promise.all([
        dolomiteMargin.testing.setAccountBalance(owner, account1, market, amount.times(-2)),
        dolomiteMargin.testing.setAccountBalance(owner, account2, market, amount.times(1)),
      ]);
      const excess = await dolomiteMargin.getters.getNumExcessTokens(market);
      expect(excess).to.eql(amount);

      txr = await dolomiteMargin.admin.withdrawExcessTokens(market, recipient, {
        from: admin,
      });
      await expectBalances(txr, INTEGERS.ZERO, INTEGERS.ZERO);
    });

    it('Succeeds for zero excess', async () => {
      await Promise.all([
        dolomiteMargin.testing.setAccountBalance(owner, account1, market, amount.times(-1)),
        dolomiteMargin.testing.setAccountBalance(owner, account2, market, amount.times(2)),
        dolomiteMargin.testing.tokenA.issueTo(amount, dolomiteMarginAddress),
      ]);
      const excess = await dolomiteMargin.getters.getNumExcessTokens(market);
      expect(excess).to.eql(INTEGERS.ZERO);
      txr = await dolomiteMargin.admin.withdrawExcessTokens(market, recipient, {
        from: admin,
      });
      await expectBalances(txr, amount, INTEGERS.ZERO);
    });

    it('Fails for negative excess', async () => {
      await Promise.all([
        dolomiteMargin.testing.setAccountBalance(owner, account1, market, amount.times(-1)),
        dolomiteMargin.testing.setAccountBalance(owner, account2, market, amount.times(3)),
        dolomiteMargin.testing.tokenA.issueTo(amount, dolomiteMarginAddress),
      ]);
      const excess = await dolomiteMargin.getters.getNumExcessTokens(market);
      expect(excess).to.eql(amount.times(-1));

      await expectThrow(
        dolomiteMargin.admin.withdrawExcessTokens(market, recipient, { from: admin }),
        'AdminImpl: Negative excess',
      );
    });

    it('Fails for non-existent market', async () => {
      await expectThrow(
        dolomiteMargin.admin.withdrawExcessTokens(invalidMarket, recipient, {
          from: nonAdmin,
        }),
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(dolomiteMargin.admin.withdrawExcessTokens(market, recipient, { from: nonAdmin }));
    });

    async function expectBalances(txResult: any, expectedDolomiteMargin: Integer, expectedRecipient: Integer) {
      if (txResult) {
        const token = dolomiteMargin.testing.tokenA.address;
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogWithdrawExcessTokens');
        expect(log.args.token).to.eql(token);
        expect(log.args.amount).to.eql(expectedRecipient);
      }
      const [dolomiteMarginBalance, recipientBalance] = await Promise.all([
        dolomiteMargin.testing.tokenA.getBalance(dolomiteMarginAddress),
        dolomiteMargin.testing.tokenA.getBalance(recipient),
      ]);
      expect(dolomiteMarginBalance).to.eql(expectedDolomiteMargin);
      expect(recipientBalance).to.eql(expectedRecipient);
    }
  });

  describe('#ownerWithdrawUnsupportedTokens', () => {
    const recipient = ADDRESSES.TEST[1];

    it('Succeeds', async () => {
      const amount = new BigNumber(100);
      await dolomiteMargin.testing.tokenC.issueTo(amount, dolomiteMarginAddress);
      await expectBalances(null, amount, INTEGERS.ZERO);
      txr = await dolomiteMargin.admin.withdrawUnsupportedTokens(dolomiteMargin.testing.tokenC.address, recipient, {
        from: admin,
      });
      await expectBalances(txr, INTEGERS.ZERO, amount);
    });

    it('Succeeds for zero tokens', async () => {
      txr = await dolomiteMargin.admin.withdrawUnsupportedTokens(dolomiteMargin.testing.tokenC.address, recipient, {
        from: admin,
      });
      await expectBalances(txr, INTEGERS.ZERO, INTEGERS.ZERO);
    });

    it('Fails for token with existing market', async () => {
      await expectThrow(
        dolomiteMargin.admin.withdrawUnsupportedTokens(dolomiteMargin.testing.tokenA.address, recipient, {
          from: admin,
        }),
        'AdminImpl: Market exists',
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(
        dolomiteMargin.admin.withdrawUnsupportedTokens(ADDRESSES.TEST[1], recipient, {
          from: nonAdmin,
        }),
      );
    });

    async function expectBalances(txResult: any, expectedDolomiteMargin: Integer, expectedRecipient: Integer) {
      if (txResult) {
        const token = dolomiteMargin.testing.tokenC.address;
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogWithdrawUnsupportedTokens');
        expect(log.args.token).to.eql(token);
        expect(log.args.amount).to.eql(expectedRecipient);
      }
      const [dolomiteMarginBalance, recipientBalance] = await Promise.all([
        dolomiteMargin.testing.tokenC.getBalance(dolomiteMarginAddress),
        dolomiteMargin.testing.tokenC.getBalance(recipient),
      ]);
      expect(dolomiteMarginBalance).to.eql(expectedDolomiteMargin);
      expect(recipientBalance).to.eql(expectedRecipient);
    }
  });

  // ============ Market Functions ============

  describe('#setAccountMaxNumberOfMarketsWithBalances', () => {
    it('Successfully sets value', async () => {
      const txResult = await dolomiteMargin.admin.setAccountMaxNumberOfMarketsWithBalances(100, { from: admin });
      const logs = dolomiteMargin.logs.parseLogs(txResult);
      expect(logs.length).to.eql(1);
      expect(logs[0].name).to.eql('LogSetAccountMaxNumberOfMarketsWithBalances');
      expect(logs[0].args.accountMaxNumberOfMarketsWithBalances).to.eql(new BigNumber('100'));
      expect(await dolomiteMargin.getters.getAccountMaxNumberOfMarketsWithBalances()).to.eql(new BigNumber('100'));
    });

    it('Fails for non-admin', async () => {
      await expectThrow(dolomiteMargin.admin.setAccountMaxNumberOfMarketsWithBalances(100, { from: nonAdmin }));
    });

    it('Fails for when too low', async () => {
      await expectThrow(
        dolomiteMargin.admin.setAccountMaxNumberOfMarketsWithBalances(1, { from: admin }),
        'AdminImpl: Acct MaxNumberOfMarkets too low',
      );
    });
  });

  describe('#ownerAddMarket', () => {
    const token = ADDRESSES.TEST[2];

    it('Successfully adds a market', async () => {
      await dolomiteMargin.testing.priceOracle.setPrice(token, defaultPrice);

      const marginPremium = new BigNumber('0.11');
      const liquidationSpreadPremium = new BigNumber('0.22');
      const maxSupplyWei = new BigNumber('333');
      const maxBorrowWei = new BigNumber('444');
      const earningsRateOverride = new BigNumber('0.55');

      const txResult = await dolomiteMargin.admin.addMarket(
        token,
        oracleAddress,
        setterAddress,
        marginPremium,
        liquidationSpreadPremium,
        maxSupplyWei,
        maxBorrowWei,
        earningsRateOverride,
        defaultIsClosing,
        { from: admin },
      );

      const { timestamp } = await dolomiteMargin.web3.eth.getBlock(txResult.blockNumber);

      const numMarkets = await dolomiteMargin.getters.getNumMarkets();
      const marketId = numMarkets.minus(1);
      const marketInfo: MarketWithInfo = await dolomiteMargin.getters.getMarketWithInfo(marketId);

      expect(marketInfo.market.token.toLowerCase()).to.eql(token);
      expect(marketInfo.market.priceOracle).to.eql(oracleAddress);
      expect(marketInfo.market.interestSetter).to.eql(setterAddress);
      expect(marketInfo.market.marginPremium).to.eql(marginPremium);
      expect(marketInfo.market.liquidationSpreadPremium).to.eql(liquidationSpreadPremium);
      expect(marketInfo.market.maxSupplyWei).to.eql(maxSupplyWei);
      expect(marketInfo.market.maxBorrowWei).to.eql(maxBorrowWei);
      expect(marketInfo.market.earningsRateOverride).to.eql(earningsRateOverride);
      expect(marketInfo.market.isClosing).to.eql(false);
      expect(marketInfo.market.totalPar.borrow).to.eql(INTEGERS.ZERO);
      expect(marketInfo.market.totalPar.supply).to.eql(INTEGERS.ZERO);
      expect(marketInfo.market.index.borrow).to.eql(INTEGERS.ONE);
      expect(marketInfo.market.index.supply).to.eql(INTEGERS.ONE);
      expect(marketInfo.market.index.lastUpdate).to.eql(new BigNumber(timestamp));
      expect(marketInfo.currentPrice).to.eql(defaultPrice);
      expect(marketInfo.currentInterestRate).to.eql(INTEGERS.ZERO);
      expect(marketInfo.currentIndex.borrow).to.eql(INTEGERS.ONE);
      expect(marketInfo.currentIndex.supply).to.eql(INTEGERS.ONE);
      expect(marketInfo.market.index.lastUpdate).to.eql(new BigNumber(timestamp));

      const logs = dolomiteMargin.logs.parseLogs(txResult);
      expect(logs.length).to.eql(8);

      const addLog = logs[0];
      expect(addLog.name).to.eql('LogAddMarket');
      expect(addLog.args.marketId).to.eql(marketId);
      expect(addLog.args.token.toLowerCase()).to.eql(token);

      const oracleLog = logs[1];
      expect(oracleLog.name).to.eql('LogSetPriceOracle');
      expect(oracleLog.args.marketId).to.eql(marketId);
      expect(oracleLog.args.priceOracle).to.eql(oracleAddress);

      const setterLog = logs[2];
      expect(setterLog.name).to.eql('LogSetInterestSetter');
      expect(setterLog.args.marketId).to.eql(marketId);
      expect(setterLog.args.interestSetter).to.eql(setterAddress);

      const marginPremiumLog = logs[3];
      expect(marginPremiumLog.name).to.eql('LogSetMarginPremium');
      expect(marginPremiumLog.args.marketId).to.eql(marketId);
      expect(marginPremiumLog.args.marginPremium).to.eql(marginPremium);

      const spreadPremiumLog = logs[4];
      expect(spreadPremiumLog.name).to.eql('LogSetLiquidationSpreadPremium');
      expect(spreadPremiumLog.args.marketId).to.eql(marketId);
      expect(spreadPremiumLog.args.spreadPremium).to.eql(liquidationSpreadPremium);

      const maxSupplyWeiLog = logs[5];
      expect(maxSupplyWeiLog.name).to.eql('LogSetMaxSupplyWei');
      expect(maxSupplyWeiLog.args.marketId).to.eql(marketId);
      expect(maxSupplyWeiLog.args.maxSupplyWei).to.eql(maxSupplyWei);

      const maxBorrowWeiLog = logs[6];
      expect(maxBorrowWeiLog.name).to.eql('LogSetMaxBorrowWei');
      expect(maxBorrowWeiLog.args.marketId).to.eql(marketId);
      expect(maxBorrowWeiLog.args.maxBorrowWei).to.eql(maxBorrowWei);

      const earningsRateOverrideLog = logs[7];
      expect(earningsRateOverrideLog.name).to.eql('LogSetEarningsRateOverride');
      expect(earningsRateOverrideLog.args.marketId).to.eql(marketId);
      expect(earningsRateOverrideLog.args.earningsRateOverride).to.eql(earningsRateOverride);
    });

    it('Successfully adds a market that is closing and recyclable', async () => {
      const marginPremium = new BigNumber('0.11');
      const spreadPremium = new BigNumber('0.22');
      const maxSupplyWei = new BigNumber('333');
      const maxBorrowWei = new BigNumber('444');
      const earningsRateOverride = new BigNumber('0.55');
      const isClosing = true;

      const txResult = await dolomiteMargin.admin.addMarket(
        token,
        oracleAddress,
        setterAddress,
        marginPremium,
        spreadPremium,
        maxSupplyWei,
        maxBorrowWei,
        earningsRateOverride,
        isClosing,
        { from: admin },
      );

      const { timestamp } = await dolomiteMargin.web3.eth.getBlock(txResult.blockNumber);

      const numMarkets = await dolomiteMargin.getters.getNumMarkets();
      const marketId = numMarkets.minus(1);
      const marketInfo: MarketWithInfo = await dolomiteMargin.getters.getMarketWithInfo(marketId);
      const isClosingResult = await dolomiteMargin.getters.getMarketIsClosing(marketId);

      expect(marketInfo.market.token.toLowerCase()).to.eql(token.toLowerCase());
      expect(marketInfo.market.priceOracle).to.eql(oracleAddress);
      expect(marketInfo.market.interestSetter).to.eql(setterAddress);
      expect(marketInfo.market.marginPremium).to.eql(marginPremium);
      expect(marketInfo.market.liquidationSpreadPremium).to.eql(spreadPremium);
      expect(marketInfo.market.maxSupplyWei).to.eql(maxSupplyWei);
      expect(marketInfo.market.maxBorrowWei).to.eql(maxBorrowWei);
      expect(marketInfo.market.earningsRateOverride).to.eql(earningsRateOverride);
      expect(marketInfo.market.isClosing).to.eql(true);
      expect(marketInfo.market.totalPar.borrow).to.eql(INTEGERS.ZERO);
      expect(marketInfo.market.totalPar.supply).to.eql(INTEGERS.ZERO);
      expect(marketInfo.market.index.borrow).to.eql(INTEGERS.ONE);
      expect(marketInfo.market.index.supply).to.eql(INTEGERS.ONE);
      expect(marketInfo.market.index.lastUpdate).to.eql(new BigNumber(timestamp));
      expect(marketInfo.currentPrice).to.eql(defaultPrice);
      expect(marketInfo.currentInterestRate).to.eql(INTEGERS.ZERO);
      expect(marketInfo.currentIndex.borrow).to.eql(INTEGERS.ONE);
      expect(marketInfo.currentIndex.supply).to.eql(INTEGERS.ONE);
      expect(marketInfo.market.index.lastUpdate).to.eql(new BigNumber(timestamp));
      expect(isClosingResult).to.eql(isClosing);

      const logs = dolomiteMargin.logs.parseLogs(txResult);
      expect(logs.length).to.eql(9);

      const addLog = logs[0];
      expect(addLog.name).to.eql('LogAddMarket');
      expect(addLog.args.marketId).to.eql(marketId);
      expect(addLog.args.token.toLowerCase()).to.eql(token.toLowerCase());

      const isClosingLog = logs[1];
      expect(isClosingLog.name).to.eql('LogSetIsClosing');
      expect(isClosingLog.args.marketId).to.eql(marketId);
      expect(isClosingLog.args.isClosing).to.eql(isClosing);

      const oracleLog = logs[2];
      expect(oracleLog.name).to.eql('LogSetPriceOracle');
      expect(oracleLog.args.marketId).to.eql(marketId);
      expect(oracleLog.args.priceOracle).to.eql(oracleAddress);

      const setterLog = logs[3];
      expect(setterLog.name).to.eql('LogSetInterestSetter');
      expect(setterLog.args.marketId).to.eql(marketId);
      expect(setterLog.args.interestSetter).to.eql(setterAddress);

      const marginPremiumLog = logs[4];
      expect(marginPremiumLog.name).to.eql('LogSetMarginPremium');
      expect(marginPremiumLog.args.marketId).to.eql(marketId);
      expect(marginPremiumLog.args.marginPremium).to.eql(marginPremium);

      const spreadPremiumLog = logs[5];
      expect(spreadPremiumLog.name).to.eql('LogSetLiquidationSpreadPremium');
      expect(spreadPremiumLog.args.marketId).to.eql(marketId);
      expect(spreadPremiumLog.args.spreadPremium).to.eql(spreadPremium);

      const maxSupplyWeiLog = logs[6];
      expect(maxSupplyWeiLog.name).to.eql('LogSetMaxSupplyWei');
      expect(maxSupplyWeiLog.args.marketId).to.eql(marketId);
      expect(maxSupplyWeiLog.args.maxSupplyWei).to.eql(maxSupplyWei);

      const maxBorrowWeiLog = logs[7];
      expect(maxBorrowWeiLog.name).to.eql('LogSetMaxSupplyWei');
      expect(maxBorrowWeiLog.args.marketId).to.eql(marketId);
      expect(maxBorrowWeiLog.args.maxBorrowWei).to.eql(maxBorrowWei);

      const earningsRateOverrideLog = logs[8];
      expect(earningsRateOverrideLog.name).to.eql('LogSetEarningsRateOverride');
      expect(earningsRateOverrideLog.args.marketId).to.eql(marketId);
      expect(earningsRateOverrideLog.args.earningsRateOverride).to.eql(earningsRateOverride);
    });

    it('Fails to add a market of the same token', async () => {
      const duplicateToken = dolomiteMargin.testing.tokenA.address;
      await dolomiteMargin.testing.priceOracle.setPrice(duplicateToken, defaultPrice);
      await expectThrow(
        dolomiteMargin.admin.addMarket(
          duplicateToken,
          oracleAddress,
          setterAddress,
          defaultPremium,
          defaultPremium,
          defaultMaxSupplyWei,
          defaultMaxBorrowWei,
          defaultEarningsRateOverride,
          defaultIsClosing,
          { from: admin },
        ),
        'AdminImpl: Market exists',
      );
    });

    it('Fails for broken price', async () => {
      await dolomiteMargin.testing.priceOracle.setPrice(token, invalidPrice);
      await expectThrow(
        dolomiteMargin.admin.addMarket(
          token,
          oracleAddress,
          setterAddress,
          defaultPremium,
          defaultPremium,
          defaultMaxSupplyWei,
          defaultMaxBorrowWei,
          defaultEarningsRateOverride,
          defaultIsClosing,
          { from: admin },
        ),
        'AdminImpl: Invalid oracle price',
      );
    });

    it('Fails for broken marginPremium', async () => {
      await Promise.all([
        dolomiteMargin.testing.priceOracle.setPrice(token, defaultPrice),
        dolomiteMargin.testing.interestSetter.setInterestRate(token, defaultRate),
      ]);
      await expectThrow(
        dolomiteMargin.admin.addMarket(
          token,
          oracleAddress,
          setterAddress,
          riskLimits.marginPremiumMax.plus(smallestDecimal),
          defaultPremium,
          defaultMaxSupplyWei,
          defaultMaxBorrowWei,
          defaultEarningsRateOverride,
          defaultIsClosing,
          { from: admin },
        ),
        'AdminImpl: Margin premium too high',
      );
    });

    it('Fails for broken spreadPremium', async () => {
      await Promise.all([
        dolomiteMargin.testing.priceOracle.setPrice(token, defaultPrice),
        dolomiteMargin.testing.interestSetter.setInterestRate(token, defaultRate),
      ]);
      await expectThrow(
        dolomiteMargin.admin.addMarket(
          token,
          oracleAddress,
          setterAddress,
          defaultPremium,
          riskLimits.liquidationSpreadPremiumMax.plus(smallestDecimal),
          defaultMaxSupplyWei,
          defaultMaxBorrowWei,
          defaultEarningsRateOverride,
          defaultIsClosing,
          { from: admin },
        ),
        'AdminImpl: Spread premium too high',
      );
    });

    it('Fails for non-admin', async () => {
      await Promise.all([
        dolomiteMargin.testing.priceOracle.setPrice(token, defaultPrice),
        dolomiteMargin.testing.interestSetter.setInterestRate(token, defaultRate),
      ]);
      await expectThrow(
        dolomiteMargin.admin.addMarket(
          token,
          oracleAddress,
          setterAddress,
          defaultPremium,
          defaultPremium,
          defaultMaxSupplyWei,
          defaultMaxBorrowWei,
          defaultEarningsRateOverride,
          defaultIsClosing,
          { from: nonAdmin },
        ),
      );
    });
  });

  describe('#ownerSetIsClosing', () => {
    it('Succeeds', async () => {
      await expectIsClosing(null, false);

      // set to false again
      txr = await dolomiteMargin.admin.setIsClosing(defaultMarket, false, {
        from: admin,
      });
      await expectIsClosing(txr, false);

      // set to true
      txr = await dolomiteMargin.admin.setIsClosing(defaultMarket, true, { from: admin });
      await expectIsClosing(txr, true);

      // set to true again
      txr = await dolomiteMargin.admin.setIsClosing(defaultMarket, true, { from: admin });
      await expectIsClosing(txr, true);

      // set to false
      txr = await dolomiteMargin.admin.setIsClosing(defaultMarket, false, {
        from: admin,
      });
      await expectIsClosing(txr, false);
    });

    it('Fails for invalid market', async () => {
      await expectThrow(
        dolomiteMargin.admin.setIsClosing(invalidMarket, true, { from: admin }),
        `AdminImpl: Invalid market <${invalidMarket.toFixed()}>`,
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(dolomiteMargin.admin.setIsClosing(defaultMarket, true, { from: nonAdmin }));
    });

    async function expectIsClosing(txResult: any, b: boolean) {
      if (txResult) {
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogSetIsClosing');
        expect(log.args.marketId).to.eql(defaultMarket);
        expect(log.args.isClosing).to.eql(b);
      }
      const isClosing = await dolomiteMargin.getters.getMarketIsClosing(defaultMarket);
      expect(isClosing).to.eql(b);
    }
  });

  describe('#ownerSetPriceOracle', () => {
    it('Succeeds', async () => {
      const token = await dolomiteMargin.getters.getMarketTokenAddress(defaultMarket);
      await dolomiteMargin.testing.priceOracle.setPrice(token, defaultPrice);
      txr = await dolomiteMargin.admin.setPriceOracle(defaultMarket, oracleAddress, {
        from: admin,
      });
      const logs = dolomiteMargin.logs.parseLogs(txr);
      expect(logs.length).to.eql(1);
      const log = logs[0];
      expect(log.name).to.eql('LogSetPriceOracle');
      expect(log.args.marketId).to.eql(defaultMarket);
      expect(log.args.priceOracle).to.eql(oracleAddress);
    });

    it('Fails for broken price', async () => {
      const token = await dolomiteMargin.getters.getMarketTokenAddress(defaultMarket);
      await dolomiteMargin.testing.priceOracle.setPrice(token, invalidPrice);
      await expectThrow(
        dolomiteMargin.admin.setPriceOracle(defaultMarket, oracleAddress, {
          from: admin,
        }),
        'AdminImpl: Invalid oracle price',
      );
    });

    it('Fails for contract without proper function', async () => {
      await expectThrow(
        dolomiteMargin.admin.setPriceOracle(defaultMarket, setterAddress, {
          from: admin,
        }),
      );
    });

    it('Fails for invalid market', async () => {
      const numMarkets = await dolomiteMargin.getters.getNumMarkets();
      await expectThrow(
        dolomiteMargin.admin.setPriceOracle(numMarkets, setterAddress, { from: admin }),
        `AdminImpl: Invalid market <${numMarkets.toFixed()}>`,
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(
        dolomiteMargin.admin.setPriceOracle(defaultMarket, oracleAddress, {
          from: nonAdmin,
        }),
      );
    });
  });

  describe('#ownerSetInterestSetter', () => {
    it('Succeeds', async () => {
      const token = await dolomiteMargin.getters.getMarketTokenAddress(defaultMarket);
      await dolomiteMargin.testing.interestSetter.setInterestRate(token, defaultRate);
      txr = await dolomiteMargin.admin.setInterestSetter(defaultMarket, setterAddress, {
        from: admin,
      });
      const logs = dolomiteMargin.logs.parseLogs(txr);
      expect(logs.length).to.eql(1);
      const log = logs[0];
      expect(log.name).to.eql('LogSetInterestSetter');
      expect(log.args.marketId).to.eql(defaultMarket);
      expect(log.args.interestSetter).to.eql(setterAddress);
    });

    it('Fails for contract without proper function', async () => {
      await expectThrow(
        dolomiteMargin.admin.setInterestSetter(defaultMarket, oracleAddress, {
          from: admin,
        }),
      );
    });

    it('Fails for invalid market', async () => {
      const numMarkets = await dolomiteMargin.getters.getNumMarkets();
      await expectThrow(
        dolomiteMargin.admin.setInterestSetter(numMarkets, setterAddress, {
          from: admin,
        }),
        `AdminImpl: Invalid market <${numMarkets.toFixed()}>`,
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(
        dolomiteMargin.admin.setInterestSetter(defaultMarket, setterAddress, {
          from: nonAdmin,
        }),
      );
    });
  });

  describe('#ownerSetMarginPremium', () => {
    it('Succeeds', async () => {
      await expectMarginPremium(null, defaultPremium);

      // set to default
      txr = await dolomiteMargin.admin.setMarginPremium(defaultMarket, defaultPremium, {
        from: admin,
      });
      await expectMarginPremium(txr, defaultPremium);

      // set risky
      txr = await dolomiteMargin.admin.setMarginPremium(defaultMarket, highPremium, {
        from: admin,
      });
      await expectMarginPremium(txr, highPremium);

      // set to risky again
      txr = await dolomiteMargin.admin.setMarginPremium(defaultMarket, highPremium, {
        from: admin,
      });
      await expectMarginPremium(txr, highPremium);

      // set back to default
      txr = await dolomiteMargin.admin.setMarginPremium(defaultMarket, defaultPremium, {
        from: admin,
      });
      await expectMarginPremium(txr, defaultPremium);
    });

    it('Fails for invalid market', async () => {
      await expectThrow(
        dolomiteMargin.admin.setMarginPremium(invalidMarket, highPremium, {
          from: admin,
        }),
        `AdminImpl: Invalid market <${invalidMarket.toFixed()}>`,
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(
        dolomiteMargin.admin.setMarginPremium(defaultMarket, highPremium, {
          from: nonAdmin,
        }),
      );
    });

    it('Fails for too-high value', async () => {
      await expectThrow(
        dolomiteMargin.admin.setMarginPremium(defaultMarket, riskLimits.marginPremiumMax.plus(smallestDecimal), {
          from: admin,
        }),
        'AdminImpl: Margin premium too high',
      );
    });

    async function expectMarginPremium(txResult: any, e: Decimal) {
      if (txResult) {
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogSetMarginPremium');
        expect(log.args.marginPremium).to.eql(e);
      }
      const premium = await dolomiteMargin.getters.getMarketMarginPremium(defaultMarket);
      expect(premium).to.eql(e);
    }
  });

  describe('#ownerSetLiquidationSpreadPremium', () => {
    it('Succeeds', async () => {
      await expectSpreadPremium(null, defaultPremium);

      // set to default
      txr = await dolomiteMargin.admin.setLiquidationSpreadPremium(defaultMarket, defaultPremium, {
        from: admin,
      });
      await expectSpreadPremium(txr, defaultPremium);

      // set risky
      txr = await dolomiteMargin.admin.setLiquidationSpreadPremium(defaultMarket, highPremium, {
        from: admin,
      });
      await expectSpreadPremium(txr, highPremium);

      // set to risky again
      txr = await dolomiteMargin.admin.setLiquidationSpreadPremium(defaultMarket, highPremium, {
        from: admin,
      });
      await expectSpreadPremium(txr, highPremium);

      // set back to default
      txr = await dolomiteMargin.admin.setLiquidationSpreadPremium(defaultMarket, defaultPremium, {
        from: admin,
      });
      await expectSpreadPremium(txr, defaultPremium);
    });

    it('Succeeds for two markets', async () => {
      const premium1 = new BigNumber('0.2');
      const premium2 = new BigNumber('0.3');

      await Promise.all([
        dolomiteMargin.admin.setLiquidationSpreadPremium(defaultMarket, premium1, { from: admin }),
        dolomiteMargin.admin.setLiquidationSpreadPremium(secondaryMarket, premium2, { from: admin }),
      ]);

      const result = await dolomiteMargin.getters.getLiquidationSpreadForPair(
        ADDRESSES.ZERO,
        defaultMarket,
        secondaryMarket,
      );

      const expected = riskParams.liquidationSpread.times(premium1.plus(1)).times(premium2.plus(1));
      expect(result).to.eql(expected);
    });

    it('Fails for invalid market', async () => {
      await expectThrow(
        dolomiteMargin.admin.setLiquidationSpreadPremium(invalidMarket, highPremium, {
          from: admin,
        }),
        `AdminImpl: Invalid market <${invalidMarket.toFixed()}>`,
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(
        dolomiteMargin.admin.setLiquidationSpreadPremium(defaultMarket, highPremium, {
          from: nonAdmin,
        }),
      );
    });

    it('Fails for too-high value', async () => {
      await expectThrow(
        dolomiteMargin.admin.setLiquidationSpreadPremium(
          defaultMarket,
          riskLimits.liquidationSpreadPremiumMax.plus(smallestDecimal),
          {
            from: admin,
          },
        ),
        'AdminImpl: Spread premium too high',
      );
    });

    async function expectSpreadPremium(txResult: any, e: Decimal) {
      if (txResult) {
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogSetLiquidationSpreadPremium');
        expect(log.args.spreadPremium).to.eql(e);
      }
      const premium = await dolomiteMargin.getters.getMarketLiquidationSpreadPremium(defaultMarket);
      expect(premium).to.eql(e);
    }
  });

  describe('#ownerSetMaxSupplyWei', () => {
    it('Succeeds', async () => {
      await expectMaxWei(null, defaultMaxSupplyWei);

      // set to default
      txr = await dolomiteMargin.admin.setMaxSupplyWei(defaultMarket, defaultMaxSupplyWei, {
        from: admin,
      });
      await expectMaxWei(txr, defaultMaxSupplyWei);

      // set less risky
      txr = await dolomiteMargin.admin.setMaxSupplyWei(defaultMarket, highMaxSupplyWei, {
        from: admin,
      });
      await expectMaxWei(txr, highMaxSupplyWei);

      // set to risky again
      txr = await dolomiteMargin.admin.setMaxSupplyWei(defaultMarket, highMaxSupplyWei, {
        from: admin,
      });
      await expectMaxWei(txr, highMaxSupplyWei);

      // set back to default
      txr = await dolomiteMargin.admin.setMaxSupplyWei(defaultMarket, defaultMaxSupplyWei, {
        from: admin,
      });
      await expectMaxWei(txr, defaultMaxSupplyWei);
    });

    it('Succeeds for two markets', async () => {
      const maxWei1 = new BigNumber('200e18');
      const maxWei2 = new BigNumber('300e18');

      const [result1, result2] = await Promise.all([
        dolomiteMargin.admin.setMaxSupplyWei(defaultMarket, maxWei1, { from: admin }),
        dolomiteMargin.admin.setMaxSupplyWei(secondaryMarket, maxWei2, { from: admin }),
      ]);

      await expectMaxWei(result1, maxWei1, defaultMarket);
      await expectMaxWei(result2, maxWei2, secondaryMarket);
    });

    it('Fails for invalid market', async () => {
      await expectThrow(
        dolomiteMargin.admin.setMaxSupplyWei(invalidMarket, highPremium, {
          from: admin,
        }),
        `AdminImpl: Invalid market <${invalidMarket.toFixed()}>`,
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(
        dolomiteMargin.admin.setMaxSupplyWei(defaultMarket, highPremium, {
          from: nonAdmin,
        }),
      );
    });

    async function expectMaxWei(txResult: any, e: Integer, market: Integer = defaultMarket) {
      if (txResult) {
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogSetMaxSupplyWei');
        expect(log.args.maxWei).to.eql(e);
      }
      const maxWei = await dolomiteMargin.getters.getMarketMaxSupplyWei(market);
      expect(maxWei).to.eql(e);
    }
  });

  describe('#ownerSetMaxBorrowWei', () => {
    it('Succeeds', async () => {
      await expectMaxBorrowWei(null, defaultMaxBorrowWei);

      // set to default
      txr = await dolomiteMargin.admin.setMaxBorrowWei(defaultMarket, defaultMaxBorrowWei, {
        from: admin,
      });
      await expectMaxBorrowWei(txr, defaultMaxBorrowWei);

      // set less risky
      txr = await dolomiteMargin.admin.setMaxBorrowWei(defaultMarket, highMaxBorrowWei, {
        from: admin,
      });
      await expectMaxBorrowWei(txr, highMaxBorrowWei);

      // set to risky again
      txr = await dolomiteMargin.admin.setMaxBorrowWei(defaultMarket, highMaxBorrowWei, {
        from: admin,
      });
      await expectMaxBorrowWei(txr, highMaxBorrowWei);

      // set back to default
      txr = await dolomiteMargin.admin.setMaxBorrowWei(defaultMarket, defaultMaxBorrowWei, {
        from: admin,
      });
      await expectMaxBorrowWei(txr, defaultMaxBorrowWei);
    });

    it('Succeeds for two markets', async () => {
      const maxWei1 = new BigNumber('200e18');
      const maxWei2 = new BigNumber('300e18');

      const [result1, result2] = await Promise.all([
        dolomiteMargin.admin.setMaxBorrowWei(defaultMarket, maxWei1, { from: admin }),
        dolomiteMargin.admin.setMaxBorrowWei(secondaryMarket, maxWei2, { from: admin }),
      ]);

      await expectMaxBorrowWei(result1, maxWei1, defaultMarket);
      await expectMaxBorrowWei(result2, maxWei2, secondaryMarket);
    });

    it('Fails for invalid market', async () => {
      await expectThrow(
        dolomiteMargin.admin.setMaxBorrowWei(invalidMarket, highPremium, {
          from: admin,
        }),
        `AdminImpl: Invalid market <${invalidMarket.toFixed()}>`,
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(
        dolomiteMargin.admin.setMaxBorrowWei(defaultMarket, highPremium, {
          from: nonAdmin,
        }),
      );
    });

    async function expectMaxBorrowWei(txResult: any, e: Integer, market: Integer = defaultMarket) {
      if (txResult) {
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogSetMaxBorrowWei');
        expect(log.args.marketId).to.eql(market);
        expect(log.args.maxBorrowWei).to.eql(e);
      }
      const maxBorrowWei = await dolomiteMargin.getters.getMarketMaxBorrowWei(market);
      expect(maxBorrowWei).to.eql(e);
    }
  });

  // ============ Risk Functions ============

  describe('#ownerSetMarginRatio', () => {
    it('Succeeds', async () => {
      await expectMarginRatio(null, riskParams.marginRatio);

      // keep same
      txr = await dolomiteMargin.admin.setMarginRatio(riskParams.marginRatio, {
        from: admin,
      });
      await expectMarginRatio(txr, riskParams.marginRatio);

      // set to max
      txr = await dolomiteMargin.admin.setMarginRatio(riskLimits.marginRatioMax, {
        from: admin,
      });
      await expectMarginRatio(txr, riskLimits.marginRatioMax);

      // set back to original
      txr = await dolomiteMargin.admin.setMarginRatio(riskParams.marginRatio, {
        from: admin,
      });
      await expectMarginRatio(txr, riskParams.marginRatio);
    });

    it('Fails for value <= spread', async () => {
      // setup
      const error = 'AdminImpl: Ratio cannot be <= spread';
      const liquidationSpread = smallestDecimal.times(10);
      await dolomiteMargin.admin.setLiquidationSpread(liquidationSpread, { from: admin });

      // passes when above the spread
      txr = await dolomiteMargin.admin.setMarginRatio(liquidationSpread.plus(smallestDecimal), { from: admin });
      await expectMarginRatio(txr, liquidationSpread.plus(smallestDecimal));

      // revert when equal to the spread
      await expectThrow(dolomiteMargin.admin.setMarginRatio(liquidationSpread, { from: admin }), error);

      // revert when below the spread
      await expectThrow(
        dolomiteMargin.admin.setMarginRatio(liquidationSpread.minus(smallestDecimal), {
          from: admin,
        }),
        error,
      );
    });

    it('Fails for too-high value', async () => {
      await expectThrow(
        dolomiteMargin.admin.setMarginRatio(riskLimits.marginRatioMax.plus(smallestDecimal), { from: admin }),
        'AdminImpl: Ratio too high',
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(dolomiteMargin.admin.setMarginRatio(riskParams.marginRatio, { from: nonAdmin }));
    });

    async function expectMarginRatio(txResult: any, e: Integer) {
      if (txResult) {
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogSetMarginRatio');
        expect(log.args.marginRatio).to.eql(e);
      }
      const result = await dolomiteMargin.getters.getMarginRatio();
      expect(result).to.eql(e);
    }
  });

  describe('#ownerSetLiquidationSpread', () => {
    it('Succeeds', async () => {
      // setup
      await dolomiteMargin.admin.setMarginRatio(riskLimits.marginRatioMax, {
        from: admin,
      });
      await expectLiquidationSpread(null, riskParams.liquidationSpread);

      // keep same
      txr = await dolomiteMargin.admin.setLiquidationSpread(riskParams.liquidationSpread, { from: admin });
      await expectLiquidationSpread(txr, riskParams.liquidationSpread);

      // set to max
      txr = await dolomiteMargin.admin.setLiquidationSpread(riskLimits.liquidationSpreadMax, { from: admin });
      await expectLiquidationSpread(txr, riskLimits.liquidationSpreadMax);

      // set back to original
      txr = await dolomiteMargin.admin.setLiquidationSpread(riskParams.liquidationSpread, { from: admin });
      await expectLiquidationSpread(txr, riskParams.liquidationSpread);
    });

    it('Fails for value >= ratio', async () => {
      // setup
      const error = 'AdminImpl: Spread cannot be >= ratio';
      const marginRatio = new BigNumber('0.1');
      await dolomiteMargin.admin.setMarginRatio(marginRatio, { from: admin });

      // passes when below the ratio
      txr = await dolomiteMargin.admin.setLiquidationSpread(marginRatio.minus(smallestDecimal), { from: admin });
      await expectLiquidationSpread(txr, marginRatio.minus(smallestDecimal));

      // reverts when equal to the ratio
      await expectThrow(dolomiteMargin.admin.setLiquidationSpread(marginRatio, { from: admin }), error);

      // reverts when above the ratio
      await expectThrow(
        dolomiteMargin.admin.setLiquidationSpread(marginRatio.plus(smallestDecimal), {
          from: admin,
        }),
        error,
      );
    });

    it('Fails for too-high value', async () => {
      await expectThrow(
        dolomiteMargin.admin.setLiquidationSpread(riskLimits.liquidationSpreadMax.plus(smallestDecimal), {
          from: admin,
        }),
        'AdminImpl: Spread too high',
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(
        dolomiteMargin.admin.setLiquidationSpread(riskParams.liquidationSpread, {
          from: nonAdmin,
        }),
      );
    });

    async function expectLiquidationSpread(txResult: any, e: Integer) {
      if (txResult) {
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogSetLiquidationSpread');
        expect(log.args.liquidationSpread).to.eql(e);
      }
      const result = await dolomiteMargin.getters.getLiquidationSpread();
      expect(result).to.eql(e);
    }
  });

  describe('#ownerSetEarningsRate', () => {
    it('Succeeds', async () => {
      await expectEarningsRate(null, riskParams.earningsRate);

      // keep same
      txr = await dolomiteMargin.admin.setEarningsRate(riskParams.earningsRate, {
        from: admin,
      });
      await expectEarningsRate(txr, riskParams.earningsRate);

      // set to max
      txr = await dolomiteMargin.admin.setEarningsRate(riskLimits.earningsRateMax, {
        from: admin,
      });
      await expectEarningsRate(txr, riskLimits.earningsRateMax);

      // set back to original
      txr = await dolomiteMargin.admin.setEarningsRate(riskParams.earningsRate, {
        from: admin,
      });
      await expectEarningsRate(txr, riskParams.earningsRate);
    });

    it('Fails for too-high value', async () => {
      await expectThrow(
        dolomiteMargin.admin.setEarningsRate(riskLimits.earningsRateMax.plus(tenToNeg18), { from: admin }),
        'AdminImpl: Rate too high',
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(dolomiteMargin.admin.setEarningsRate(riskParams.earningsRate, { from: nonAdmin }));
    });

    const tenToNeg18 = '0.000000000000000001';

    async function expectEarningsRate(txResult: any, e: Decimal) {
      if (txResult) {
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogSetEarningsRate');
        expect(log.args.earningsRate).to.eql(e);
      }
      const result = await dolomiteMargin.getters.getEarningsRate();
      expect(result).to.eql(e);
    }
  });

  describe('#ownerSetMinBorrowedValue', () => {
    it('Succeeds', async () => {
      await expectMinBorrowedValue(null, riskParams.minBorrowedValue);

      // keep same
      txr = await dolomiteMargin.admin.setMinBorrowedValue(riskParams.minBorrowedValue, {
        from: admin,
      });
      await expectMinBorrowedValue(txr, riskParams.minBorrowedValue);

      // set to max
      txr = await dolomiteMargin.admin.setMinBorrowedValue(riskLimits.minBorrowedValueMax, { from: admin });
      await expectMinBorrowedValue(txr, riskLimits.minBorrowedValueMax);

      // set back to original
      txr = await dolomiteMargin.admin.setMinBorrowedValue(riskParams.minBorrowedValue, {
        from: admin,
      });
      await expectMinBorrowedValue(txr, riskParams.minBorrowedValue);
    });

    it('Fails for too-high value', async () => {
      await expectThrow(
        dolomiteMargin.admin.setMinBorrowedValue(riskLimits.minBorrowedValueMax.plus(1), {
          from: admin,
        }),
        'AdminImpl: Value too high',
      );
    });

    it('Fails for non-admin', async () => {
      await expectThrow(
        dolomiteMargin.admin.setMinBorrowedValue(riskParams.minBorrowedValue, {
          from: nonAdmin,
        }),
      );
    });

    async function expectMinBorrowedValue(txResult: any, e: Integer) {
      if (txResult) {
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogSetMinBorrowedValue');
        expect(log.args.minBorrowedValue).to.eql(e);
      }
      const result = await dolomiteMargin.getters.getMinBorrowedValue();
      expect(result).to.eql(e);
    }
  });

  // ============ Global Operator Functions ============

  describe('#ownerSetGlobalOperator', () => {
    it('Succeeds', async () => {
      await expectGlobalOperatorToBe(null, false);
      txr = await dolomiteMargin.admin.setGlobalOperator(operator, false, {
        from: admin,
      });
      await expectGlobalOperatorToBe(txr, false);
      txr = await dolomiteMargin.admin.setGlobalOperator(operator, true, { from: admin });
      await expectGlobalOperatorToBe(txr, true);
      txr = await dolomiteMargin.admin.setGlobalOperator(operator, true, { from: admin });
      await expectGlobalOperatorToBe(txr, true);
      txr = await dolomiteMargin.admin.setGlobalOperator(operator, false, {
        from: admin,
      });
      await expectGlobalOperatorToBe(txr, false);
    });

    it('Fails for non-admin', async () => {
      await expectThrow(dolomiteMargin.admin.setGlobalOperator(operator, true, { from: nonAdmin }));
    });

    async function expectGlobalOperatorToBe(txResult: any, b: boolean) {
      if (txResult) {
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogSetGlobalOperator');
        expect(log.args.operator).to.eql(operator);
        expect(log.args.approved).to.eql(b);
      }
      const result = await dolomiteMargin.getters.getIsGlobalOperator(operator);
      expect(result).to.eql(b);
    }
  });

  describe('#ownerSetAutoTraderSpecial', () => {
    it('Succeeds', async () => {
      await expectAutoTraderSpecialToBe(null, false);
      txr = await dolomiteMargin.admin.setAutoTraderIsSpecial(operator, false, { from: admin });
      await expectAutoTraderSpecialToBe(txr, false);
      txr = await dolomiteMargin.admin.setAutoTraderIsSpecial(operator, true, { from: admin });
      await expectAutoTraderSpecialToBe(txr, true);
      txr = await dolomiteMargin.admin.setAutoTraderIsSpecial(operator, true, { from: admin });
      await expectAutoTraderSpecialToBe(txr, true);
      txr = await dolomiteMargin.admin.setAutoTraderIsSpecial(operator, false, { from: admin });
      await expectAutoTraderSpecialToBe(txr, false);
    });

    it('Fails for non-admin', async () => {
      await expectThrow(dolomiteMargin.admin.setAutoTraderIsSpecial(operator, true, { from: nonAdmin }));
    });

    async function expectAutoTraderSpecialToBe(txResult: any, b: boolean) {
      if (txResult) {
        const logs = dolomiteMargin.logs.parseLogs(txResult);
        expect(logs.length).to.eql(1);
        const log = logs[0];
        expect(log.name).to.eql('LogSetAutoTraderIsSpecial');
        expect(log.args.autoTrader).to.eql(operator);
        expect(log.args.isSpecial).to.eql(b);
      }
      const result = await dolomiteMargin.getters.getIsAutoTraderSpecial(operator);
      expect(result).to.eql(b);
    }
  });

  // ============ Other ============

  describe('Logs', () => {
    it('Skips logs when necessary', async () => {
      txr = await dolomiteMargin.admin.setGlobalOperator(operator, false, {
        from: admin,
      });
      const logs = dolomiteMargin.logs.parseLogs(txr, { skipAdminLogs: true });
      expect(logs.length).to.eql(0);
    });
  });
});
