import BigNumber from 'bignumber.js';
import { AccountStatus, address, ADDRESSES, Decimal, Index, Integer, INTEGERS, TotalPar } from '../src';
import { getDolomiteMargin } from './helpers/DolomiteMargin';
import { setupMarkets } from './helpers/DolomiteMarginHelpers';
import { fastForward, mineAvgBlock, resetEVM, snapshot } from './helpers/EVM';
import { expectThrow } from './helpers/Expect';
import { TestDolomiteMargin } from './modules/TestDolomiteMargin';
import { OracleSentinel } from '../src/modules/OracleSentinel';

let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
let admin: address;
let rando: address;
let operator: address;
let owner1: address;
let owner2: address;
let dolomiteMarginAddress: address;
let oracleAddress: address;
let setterAddress: address;
const prices = [new BigNumber(123), new BigNumber(456), new BigNumber(789)];
const rates = [
  new BigNumber(101).div(INTEGERS.INTEREST_RATE_BASE),
  new BigNumber(202).div(INTEGERS.INTEREST_RATE_BASE),
  new BigNumber(303).div(INTEGERS.INTEREST_RATE_BASE),
];
const defaultPremium = new BigNumber(0);
const defaultSupplyMaxWei = new BigNumber(0);
const defaultBorrowMaxWei = new BigNumber(0);
const defaultEarningsRateOverride = new BigNumber(0);
const defaultIsClosing = false;
const highPremium = new BigNumber('.2');
const market1 = new BigNumber(0);
const market2 = new BigNumber(1);
const market3 = new BigNumber(2);
const invalidMarket = new BigNumber(101);
const account1 = new BigNumber(111);
const account2 = new BigNumber(222);
const par = new BigNumber(100000000);
const wei = new BigNumber(150000000);
const defaultIndex = {
  lastUpdate: INTEGERS.ZERO,
  borrow: wei.div(par),
  supply: wei.div(par),
};
const zero = INTEGERS.ZERO;
let tokens: address[];
let markets: Integer[];
const INVALID_MARKET_ERROR = 'GettersImpl: Invalid market';

describe('Getters', () => {
  let defaultParams: {
    earningsRate: Decimal;
    marginRatio: Decimal;
    liquidationSpread: Decimal;
    minBorrowedValue: Integer;
    accountMaxNumberOfMarketsWithBalances: Integer;
    oracleSentinel: OracleSentinel;
  };
  let defaultLimits: {
    marginRatioMax: Decimal;
    liquidationSpreadMax: Decimal;
    earningsRateMax: Decimal;
    marginPremiumMax: Decimal;
    liquidationSpreadPremiumMax: Decimal;
    minBorrowedValueMax: Integer;
  };
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);

    tokens = [
      dolomiteMargin.testing.tokenA.address,
      dolomiteMargin.testing.tokenB.address,
      dolomiteMargin.testing.tokenC.address,
    ];
    markets = [
      await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenA.address),
      await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenB.address),
      await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenC.address),
    ];

    dolomiteMarginAddress = dolomiteMargin.address;
    oracleAddress = dolomiteMargin.testing.priceOracle.address;
    setterAddress = dolomiteMargin.testing.interestSetter.address;

    await Promise.all([
      dolomiteMargin.testing.priceOracle.setPrice(tokens[0], prices[0]),
      dolomiteMargin.testing.priceOracle.setPrice(tokens[1], prices[1]),
      dolomiteMargin.testing.priceOracle.setPrice(tokens[2], prices[2]),
      dolomiteMargin.testing.interestSetter.setInterestRate(tokens[0], rates[0]),
      dolomiteMargin.testing.interestSetter.setInterestRate(tokens[1], rates[1]),
      dolomiteMargin.testing.interestSetter.setInterestRate(tokens[2], rates[2]),
      dolomiteMargin.testing.setMarketIndex(market1, defaultIndex),
      dolomiteMargin.testing.setMarketIndex(market2, defaultIndex),
      dolomiteMargin.testing.setMarketIndex(market3, defaultIndex),
    ]);

    admin = accounts[0];
    rando = accounts[5];
    operator = accounts[6];
    owner1 = accounts[7];
    owner2 = accounts[8];

    defaultParams = {
      earningsRate: new BigNumber('0.9'),
      marginRatio: new BigNumber('0.15'),
      liquidationSpread: new BigNumber('0.05'),
      minBorrowedValue: new BigNumber('5e16'),
      accountMaxNumberOfMarketsWithBalances: new BigNumber(32),
      oracleSentinel: await dolomiteMargin.getters.getOracleSentinel(),
    };
    defaultLimits = {
      marginRatioMax: new BigNumber('2.0'),
      liquidationSpreadMax: new BigNumber('0.5'),
      earningsRateMax: new BigNumber('1.0'),
      marginPremiumMax: new BigNumber('2.0'),
      liquidationSpreadPremiumMax: new BigNumber('5.0'),
      minBorrowedValueMax: new BigNumber('100e18'),
    };

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  // ============ Getters for Risk ============

  describe('Risk', () => {
    describe('#getMarginRatio', () => {
      it('Succeeds', async () => {
        const value1 = await dolomiteMargin.getters.getMarginRatio();
        expect(value1).to.eql(defaultParams.marginRatio);

        await dolomiteMargin.admin.setMarginRatio(defaultLimits.marginRatioMax, {
          from: admin,
        });
        const value2 = await dolomiteMargin.getters.getMarginRatio();
        expect(value2).to.eql(defaultLimits.marginRatioMax);
      });
    });

    describe('#getLiquidationSpread', () => {
      it('Succeeds', async () => {
        const value1 = await dolomiteMargin.getters.getLiquidationSpread();
        expect(value1).to.eql(defaultParams.liquidationSpread);
        const doubledSpread = value1.times(2);
        await dolomiteMargin.admin.setLiquidationSpread(doubledSpread, { from: admin });
        const value2 = await dolomiteMargin.getters.getLiquidationSpread();
        expect(value2).to.eql(doubledSpread);
      });
    });

    describe('#getEarningsRate', () => {
      it('Succeeds', async () => {
        const value1 = await dolomiteMargin.getters.getEarningsRate();
        expect(value1).to.eql(defaultParams.earningsRate);

        await dolomiteMargin.admin.setEarningsRate(defaultLimits.earningsRateMax, {
          from: admin,
        });
        const value2 = await dolomiteMargin.getters.getEarningsRate();
        expect(value2).to.eql(defaultLimits.earningsRateMax);
      });
    });

    describe('#getMinBorrowedValue', () => {
      it('Succeeds', async () => {
        const value1 = await dolomiteMargin.getters.getMinBorrowedValue();
        expect(value1).to.eql(defaultParams.minBorrowedValue);

        await dolomiteMargin.admin.setMinBorrowedValue(defaultLimits.minBorrowedValueMax, { from: admin });
        const value2 = await dolomiteMargin.getters.getMinBorrowedValue();
        expect(value2).to.eql(defaultLimits.minBorrowedValueMax);
      });
    });

    describe('#getAccountMaxNumberOfMarketsWithBalances', () => {
      it('Succeeds', async () => {
        const value1 = await dolomiteMargin.getters.getAccountMaxNumberOfMarketsWithBalances();
        expect(value1).to.eql(defaultParams.accountMaxNumberOfMarketsWithBalances);

        await dolomiteMargin.admin.setAccountMaxNumberOfMarketsWithBalances(64, { from: admin });
        expect(await dolomiteMargin.getters.getAccountMaxNumberOfMarketsWithBalances()).to.eql(new BigNumber(64));
      });
    });

    describe('#getOracleSentinel', () => {
      it('Succeeds', async () => {
        expect((await dolomiteMargin.getters.getOracleSentinel()).address).to.eql(defaultParams.oracleSentinel.address);
      });
    });

    describe('#getIsBorrowAllowed()', () => {
      it('Succeeds', async () => {
        expect(await dolomiteMargin.getters.getIsBorrowAllowed()).to.eql(true);

        await dolomiteMargin.contracts.callContractFunction(
          dolomiteMargin.contracts.testChainlinkFlags.methods.setShouldReturnOffline(true)
        );
        expect(await dolomiteMargin.getters.getIsBorrowAllowed()).to.eql(false);
      });
    });

    describe('#getIsLiquidationAllowed', () => {
      it('Succeeds', async () => {
        expect(await dolomiteMargin.getters.getIsLiquidationAllowed()).to.eql(true);

        await dolomiteMargin.contracts.callContractFunction(
          dolomiteMargin.contracts.testChainlinkFlags.methods.setShouldReturnOffline(true)
        );
        expect(await dolomiteMargin.getters.getIsLiquidationAllowed()).to.eql(false);
      });
    });

    describe('#getRiskParams', () => {
      it('Succeeds', async () => {
        const params = await dolomiteMargin.getters.getRiskParams();
        expect(params.earningsRate).to.eql(defaultParams.earningsRate);
        expect(params.marginRatio).to.eql(defaultParams.marginRatio);
        expect(params.liquidationSpread).to.eql(defaultParams.liquidationSpread);
        expect(params.minBorrowedValue).to.eql(defaultParams.minBorrowedValue);
      });
    });

    describe('#getRiskLimits', () => {
      it('Succeeds', async () => {
        const limits = await dolomiteMargin.getters.getRiskLimits();
        expect(limits.marginRatioMax).to.eql(defaultLimits.marginRatioMax);
        expect(limits.liquidationSpreadMax).to.eql(defaultLimits.liquidationSpreadMax);
        expect(limits.earningsRateMax).to.eql(defaultLimits.earningsRateMax);
        expect(limits.marginPremiumMax).to.eql(defaultLimits.marginPremiumMax);
        expect(limits.liquidationSpreadPremiumMax).to.eql(defaultLimits.liquidationSpreadPremiumMax);
        expect(limits.minBorrowedValueMax).to.eql(defaultLimits.minBorrowedValueMax);
      });
    });
  });

  // ============ Getters for Markets ============

  describe('Markets', () => {
    describe('#getNumMarkets', () => {
      it('Succeeds', async () => {
        const nm1 = await dolomiteMargin.getters.getNumMarkets();
        expect(nm1).to.eql(new BigNumber(3));

        const token = ADDRESSES.TEST[0];
        await dolomiteMargin.testing.priceOracle.setPrice(token, prices[0]);
        await dolomiteMargin.admin.addMarket(
          token,
          oracleAddress,
          setterAddress,
          defaultPremium,
          defaultPremium,
          defaultSupplyMaxWei,
          defaultBorrowMaxWei,
          defaultEarningsRateOverride,
          defaultIsClosing,
          { from: admin },
        );
        const nm2 = await dolomiteMargin.getters.getNumMarkets();
        expect(nm2).to.eql(nm1.plus(1));
      });
    });

    describe('#getMarketTokenAddress', () => {
      it('Succeeds', async () => {
        const actualTokens = await Promise.all([
          dolomiteMargin.getters.getMarketTokenAddress(market1),
          dolomiteMargin.getters.getMarketTokenAddress(market2),
          dolomiteMargin.getters.getMarketTokenAddress(market3),
        ]);
        expect(actualTokens[0]).to.eql(tokens[0]);
        expect(actualTokens[1]).to.eql(tokens[1]);
        expect(actualTokens[2]).to.eql(tokens[2]);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getMarketTokenAddress(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getMarketIdByTokenAddress', () => {
      it('Succeeds', async () => {
        const actualTokens = await Promise.all([
          dolomiteMargin.getters.getMarketTokenAddress(market1),
          dolomiteMargin.getters.getMarketTokenAddress(market2),
          dolomiteMargin.getters.getMarketTokenAddress(market3),
        ]);
        expect(market1).to.eql(await dolomiteMargin.getters.getMarketIdByTokenAddress(actualTokens[0]));
        expect(market2).to.eql(await dolomiteMargin.getters.getMarketIdByTokenAddress(actualTokens[1]));
        expect(market3).to.eql(await dolomiteMargin.getters.getMarketIdByTokenAddress(actualTokens[2]));
      });

      it('Fails for Invalid token', async () => {
        await expectThrow(
          dolomiteMargin.getters.getMarketIdByTokenAddress(ADDRESSES.ZERO),
          'GettersImpl: Invalid token',
        );
        await expectThrow(
          dolomiteMargin.getters.getMarketIdByTokenAddress('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),
          'GettersImpl: Invalid token',
        );
      });
    });

    describe('#getMarketTotalPar', () => {
      it('Succeeds', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market3, par.times(-1)),
        ]);
        const totals = await Promise.all([
          dolomiteMargin.getters.getMarketTotalPar(market1),
          dolomiteMargin.getters.getMarketTotalPar(market2),
          dolomiteMargin.getters.getMarketTotalPar(market3),
        ]);
        expect(totals[0].supply).to.eql(zero);
        expect(totals[0].borrow).to.eql(zero);
        expect(totals[1].supply).to.eql(par);
        expect(totals[1].borrow).to.eql(zero);
        expect(totals[2].supply).to.eql(zero);
        expect(totals[2].borrow).to.eql(par);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getMarketTotalPar(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getMarketCachedIndex', () => {
      it('Succeeds', async () => {
        const block1 = await dolomiteMargin.web3.eth.getBlock('latest');
        const timestamp = new BigNumber(block1.timestamp);
        const index = {
          lastUpdate: new BigNumber(timestamp),
          borrow: new BigNumber('1.456'),
          supply: new BigNumber('1.123'),
        };
        await dolomiteMargin.testing.setMarketIndex(market2, index);
        await mineAvgBlock();
        const block2 = await dolomiteMargin.web3.eth.getBlock('latest');
        expect(block2.timestamp).to.be.greaterThan(block1.timestamp);
        const result = await dolomiteMargin.getters.getMarketCachedIndex(market2);
        expect(result).to.eql(index);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getMarketCachedIndex(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getMarketCurrentIndex', () => {
      it('Succeeds', async () => {
        const block1 = await dolomiteMargin.web3.eth.getBlock('latest');
        const timestamp = new BigNumber(block1.timestamp);
        const index = {
          lastUpdate: timestamp,
          borrow: new BigNumber('1.456'),
          supply: new BigNumber('1.123'),
        };
        await Promise.all([
          dolomiteMargin.testing.setMarketIndex(market2, index),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.times(2)),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market2, par.times(-1)),
        ]);
        await mineAvgBlock();
        const result = await dolomiteMargin.getters.getMarketCurrentIndex(market2);
        const block2 = await dolomiteMargin.web3.eth.getBlock('latest');
        expect(block2.timestamp).to.be.greaterThan(block1.timestamp);
        expect(result.lastUpdate.toNumber()).to.eql(block2.timestamp);

        const [totalPar, interestRate, earningsRate] = await Promise.all([
          dolomiteMargin.getters.getMarketTotalPar(market2),
          dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(market2),
          dolomiteMargin.getters.getEarningsRate(),
        ]);

        const expectedIndex = getExpectedCurrentIndex(index, result.lastUpdate, totalPar, interestRate, earningsRate);
        expect(result).to.eql(expectedIndex);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getMarketCurrentIndex(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getMarketPriceOracle', () => {
      it('Succeeds', async () => {
        const actualOracles = await Promise.all([
          dolomiteMargin.getters.getMarketPriceOracle(market1),
          dolomiteMargin.getters.getMarketPriceOracle(market2),
          dolomiteMargin.getters.getMarketPriceOracle(market3),
        ]);
        expect(actualOracles[0]).to.eql(oracleAddress);
        expect(actualOracles[1]).to.eql(oracleAddress);
        expect(actualOracles[2]).to.eql(oracleAddress);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getMarketPriceOracle(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getMarketInterestSetter', () => {
      it('Succeeds', async () => {
        const actualSetters = await Promise.all([
          dolomiteMargin.getters.getMarketInterestSetter(market1),
          dolomiteMargin.getters.getMarketInterestSetter(market2),
          dolomiteMargin.getters.getMarketInterestSetter(market3),
        ]);
        expect(actualSetters[0]).to.eql(setterAddress);
        expect(actualSetters[1]).to.eql(setterAddress);
        expect(actualSetters[2]).to.eql(setterAddress);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getMarketInterestSetter(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getMarketMarginPremium', () => {
      it('Succeeds', async () => {
        await dolomiteMargin.admin.setMarginPremium(market2, highPremium, {
          from: admin,
        });
        const result = await Promise.all([
          dolomiteMargin.getters.getMarketMarginPremium(market1),
          dolomiteMargin.getters.getMarketMarginPremium(market2),
          dolomiteMargin.getters.getMarketMarginPremium(market3),
        ]);
        expect(result[0]).to.eql(defaultPremium);
        expect(result[1]).to.eql(highPremium);
        expect(result[2]).to.eql(defaultPremium);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getMarketMarginPremium(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getMarketSpreadPremium', () => {
      it('Succeeds', async () => {
        await dolomiteMargin.admin.setLiquidationSpreadPremium(market2, highPremium, {
          from: admin,
        });
        const result = await Promise.all([
          dolomiteMargin.getters.getMarketLiquidationSpreadPremium(market1),
          dolomiteMargin.getters.getMarketLiquidationSpreadPremium(market2),
          dolomiteMargin.getters.getMarketLiquidationSpreadPremium(market3),
        ]);
        expect(result[0]).to.eql(defaultPremium);
        expect(result[1]).to.eql(highPremium);
        expect(result[2]).to.eql(defaultPremium);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(
          dolomiteMargin.getters.getMarketLiquidationSpreadPremium(invalidMarket),
          INVALID_MARKET_ERROR,
        );
      });
    });

    describe('#getMarketIsClosing', () => {
      it('Succeeds', async () => {
        await dolomiteMargin.admin.setIsClosing(market2, true, { from: admin });
        const actualClosing = await Promise.all([
          dolomiteMargin.getters.getMarketIsClosing(market1),
          dolomiteMargin.getters.getMarketIsClosing(market2),
          dolomiteMargin.getters.getMarketIsClosing(market3),
        ]);
        expect(actualClosing[0]).to.eql(false);
        expect(actualClosing[1]).to.eql(true);
        expect(actualClosing[2]).to.eql(false);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getMarketIsClosing(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getMarketPrice', () => {
      it('Succeeds', async () => {
        const actualPrices = await Promise.all([
          dolomiteMargin.getters.getMarketPrice(market1),
          dolomiteMargin.getters.getMarketPrice(market2),
          dolomiteMargin.getters.getMarketPrice(market3),
        ]);
        expect(actualPrices[0]).to.eql(prices[0]);
        expect(actualPrices[1]).to.eql(prices[1]);
        expect(actualPrices[2]).to.eql(prices[2]);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getMarketPrice(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getMarketInterestRate', () => {
      it('Succeeds', async () => {
        const actualRates = await Promise.all([
          dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(market1),
          dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(market2),
          dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(market3),
        ]);
        expect(actualRates[0]).to.eql(rates[0]);
        expect(actualRates[1]).to.eql(rates[1]);
        expect(actualRates[2]).to.eql(rates[2]);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(
          dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(invalidMarket),
          INVALID_MARKET_ERROR,
        );
      });
    });

    describe('#getMarket', () => {
      it('Succeeds', async () => {
        // setup
        const block = await dolomiteMargin.web3.eth.getBlock('latest');
        const index = {
          lastUpdate: new BigNumber(block.timestamp),
          borrow: new BigNumber('1.456'),
          supply: new BigNumber('1.123'),
        };
        await Promise.all([
          dolomiteMargin.admin.setIsClosing(market2, true, { from: admin }),
          dolomiteMargin.admin.setMarginPremium(market2, highPremium, { from: admin }),
          dolomiteMargin.admin.setLiquidationSpreadPremium(market2, highPremium.div(2), {
            from: admin,
          }),
          dolomiteMargin.testing.setMarketIndex(market2, index),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.times(2)),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market2, par.times(-1)),
        ]);

        // verify
        const market = await dolomiteMargin.getters.getMarket(market2);
        expect(market.index).to.eql(index);
        expect(market.interestSetter).to.eql(setterAddress);
        expect(market.marginPremium).to.eql(highPremium);
        expect(market.liquidationSpreadPremium).to.eql(highPremium.div(2));
        expect(market.isClosing).to.eql(true);
        expect(market.priceOracle).to.eql(oracleAddress);
        expect(market.token).to.eql(tokens[1]);
        const expectedPar = {
          borrow: par,
          supply: par.times(2),
        };
        expect(market.totalPar).to.eql(expectedPar);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getMarket(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getMarketWithInfo', () => {
      it('Succeeds', async () => {
        // setup
        const block = await dolomiteMargin.web3.eth.getBlock('latest');
        const index = {
          lastUpdate: new BigNumber(block.timestamp),
          borrow: new BigNumber('1.456'),
          supply: new BigNumber('1.123'),
        };
        await Promise.all([
          dolomiteMargin.admin.setIsClosing(market2, true, { from: admin }),
          dolomiteMargin.admin.setMarginPremium(market2, highPremium, { from: admin }),
          dolomiteMargin.admin.setLiquidationSpreadPremium(market2, highPremium.div(2), {
            from: admin,
          }),
          dolomiteMargin.testing.setMarketIndex(market2, index),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.times(2)),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market2, par.times(-1)),
        ]);

        // verify
        const [earningsRate, market, marketwi] = await Promise.all([
          dolomiteMargin.getters.getEarningsRate(),
          dolomiteMargin.getters.getMarket(market2),
          dolomiteMargin.getters.getMarketWithInfo(market2),
        ]);
        expect(marketwi.market).to.eql(market);
        const expectedCurrentIndex = getExpectedCurrentIndex(
          index,
          marketwi.currentIndex.lastUpdate,
          marketwi.market.totalPar,
          marketwi.currentInterestRate,
          earningsRate,
        );
        expect(marketwi.currentIndex).to.eql(expectedCurrentIndex);
        expect(marketwi.currentPrice).to.eql(prices[1]);
        expect(marketwi.currentInterestRate).to.eql(rates[1]);
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getMarketWithInfo(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getNumExcessTokens', () => {
      it('Succeeds for all zeroes', async () => {
        await dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par);
        const result = await dolomiteMargin.getters.getNumExcessTokens(market1);
        expect(result).to.eql(zero);
      });

      it('Succeeds for zero (zero balance)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par.times(2)),
          dolomiteMargin.testing.setAccountBalance(owner2, account1, market1, par.times(-1)),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market1, par.times(-1)),
        ]);
        const result = await dolomiteMargin.getters.getNumExcessTokens(market1);
        expect(result).to.eql(zero);
      });

      it('Succeeds for zero (non-zero balance)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par.times(2)),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market1, par.times(-1)),
          dolomiteMargin.testing.tokenA.issueTo(wei, dolomiteMarginAddress),
        ]);
        const result = await dolomiteMargin.getters.getNumExcessTokens(market1);
        expect(result).to.eql(zero);
      });

      it('Succeeds for positive (zero balance)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par.times(1)),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market1, par.times(-2)),
        ]);
        const result = await dolomiteMargin.getters.getNumExcessTokens(market1);
        expect(result).to.eql(wei);
      });

      it('Succeeds for positive > balance', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par.times(1)),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market1, par.times(-2)),
          dolomiteMargin.testing.tokenA.issueTo(wei, dolomiteMarginAddress),
        ]);
        const result = await dolomiteMargin.getters.getNumExcessTokens(market1);
        expect(result).to.eql(wei.times(2));
      });

      it('Succeeds for positive < balance', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par.times(3)),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market1, par.times(-2)),
          dolomiteMargin.testing.tokenA.issueTo(wei.times(2), dolomiteMarginAddress),
        ]);
        const result = await dolomiteMargin.getters.getNumExcessTokens(market1);
        expect(result).to.eql(wei);
      });

      it('Succeeds for negative (zero balance)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par.times(2)),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market1, par.times(-1)),
        ]);
        const result = await dolomiteMargin.getters.getNumExcessTokens(market1);
        expect(result).to.eql(wei.times(-1));
      });

      it('Succeeds for negative (non-zero balance)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par.times(3)),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market1, par.times(-1)),
          dolomiteMargin.testing.tokenA.issueTo(wei, dolomiteMarginAddress),
        ]);
        const result = await dolomiteMargin.getters.getNumExcessTokens(market1);
        expect(result).to.eql(wei.times(-1));
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getNumExcessTokens(invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    function getExpectedCurrentIndex(
      oldIndex: Index,
      newTimestamp: Integer,
      totalPar: TotalPar,
      interestRate: Decimal,
      earningsRate: Decimal,
    ): Index {
      const timeDiff = newTimestamp.minus(oldIndex.lastUpdate);
      expect(timeDiff.isPositive()).to.eql(true);
      const borrowInterest = interestRate.times(timeDiff);
      expect(borrowInterest.isZero()).to.eql(false);
      const borrowWei = totalPar.borrow.times(oldIndex.borrow).integerValue(BigNumber.ROUND_UP);
      const supplyWei = totalPar.supply.times(oldIndex.supply).integerValue(BigNumber.ROUND_DOWN);
      let supplyInterest = crop(borrowInterest.times(earningsRate));
      if (borrowWei.lt(supplyWei)) {
        supplyInterest = crop(crop(supplyInterest.times(borrowWei)).div(supplyWei));
      }
      expect(supplyInterest.lte(borrowInterest)).to.eql(true);
      return {
        supply: crop(oldIndex.supply.times(supplyInterest.plus(1))),
        borrow: crop(oldIndex.borrow.times(borrowInterest.plus(1))),
        lastUpdate: newTimestamp,
      };
    }

    function crop(b: BigNumber) {
      return b.times('1e18').integerValue(BigNumber.ROUND_DOWN).div('1e18');
    }
  });

  // ============ Getters for Accounts ============

  describe('Accounts', () => {
    describe('#getAccountPar', () => {
      it('Succeeds', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.div(-2)),
        ]);
        const [par1, par2] = await Promise.all([
          dolomiteMargin.getters.getAccountPar(owner1, account1, market1),
          dolomiteMargin.getters.getAccountPar(owner1, account1, market2),
        ]);
        expect(par1).to.eql(par);
        expect(par2).to.eql(par.div(-2));
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getAccountPar(owner1, account1, invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getAccountWei', () => {
      it('Succeeds for zero interest', async () => {
        await Promise.all([
          dolomiteMargin.testing.interestSetter.setInterestRate(tokens[0], zero),
          dolomiteMargin.testing.interestSetter.setInterestRate(tokens[1], zero),
          dolomiteMargin.testing.interestSetter.setInterestRate(tokens[2], zero),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.div(-2)),
        ]);
        const [wei1, wei2] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(owner1, account1, market1),
          dolomiteMargin.getters.getAccountWei(owner1, account1, market2),
        ]);
        expect(wei1).to.eql(wei);
        expect(wei2).to.eql(wei.div(-2));
      });

      it('Succeeds for some interest', async () => {
        const interest = new BigNumber(2); // more than max interest
        await Promise.all([
          dolomiteMargin.testing.interestSetter.setInterestRate(tokens[0], interest),
          dolomiteMargin.testing.interestSetter.setInterestRate(tokens[1], interest),
          dolomiteMargin.testing.interestSetter.setInterestRate(tokens[2], interest),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market1, par.div(-2)),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.div(-2)),
          dolomiteMargin.testing.setAccountBalance(owner2, account2, market2, par.div(4)),
        ]);
        await mineAvgBlock();
        const [weiA1, weiB1] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(owner1, account1, market1),
          dolomiteMargin.getters.getAccountWei(owner1, account1, market2),
        ]);
        expect(weiA1.gte(wei)).to.eql(true);
        expect(weiB1.lt(wei.div(-2))).to.eql(true); // lt is gt in the negative direction

        await fastForward(86400); // one day

        const [weiA2, weiB2] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(owner1, account1, market1),
          dolomiteMargin.getters.getAccountWei(owner1, account1, market2),
        ]);
        expect(weiA2.gt(weiA1)).to.eql(true);
        expect(weiB2.lt(weiB1)).to.eql(true); // lt is gt in the negative direction
      });

      it('Fails for Invalid market', async () => {
        await expectThrow(dolomiteMargin.getters.getAccountWei(owner1, account1, invalidMarket), INVALID_MARKET_ERROR);
      });
    });

    describe('#getAccountStatus', () => {
      it('Succeeds', async () => {
        let status: AccountStatus;
        status = await dolomiteMargin.getters.getAccountStatus(owner1, account1);
        expect(status).to.eql(AccountStatus.Normal);

        await dolomiteMargin.testing.setAccountStatus(owner1, account1, AccountStatus.Liquidating);
        status = await dolomiteMargin.getters.getAccountStatus(owner1, account1);
        expect(status).to.eql(AccountStatus.Liquidating);

        await dolomiteMargin.testing.setAccountStatus(owner1, account1, AccountStatus.Vaporizing);
        status = await dolomiteMargin.getters.getAccountStatus(owner1, account1);
        expect(status).to.eql(AccountStatus.Vaporizing);

        await dolomiteMargin.testing.setAccountStatus(owner1, account1, AccountStatus.Normal);
        status = await dolomiteMargin.getters.getAccountStatus(owner1, account1);
        expect(status).to.eql(AccountStatus.Normal);
      });
    });

    describe('#getAccountValues', () => {
      it('Succeeds', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.div(-2)),
        ]);
        const [values1, values2] = await Promise.all([
          dolomiteMargin.getters.getAccountValues(owner1, account1),
          dolomiteMargin.getters.getAccountValues(owner2, account2),
        ]);
        expect(values1.borrow).to.eql(prices[1].times(wei.div(2)));
        expect(values1.supply).to.eql(prices[0].times(wei));
        expect(values2.borrow).to.eql(zero);
        expect(values2.supply).to.eql(zero);
      });
    });

    describe('#getAccountMarketsWithBalances', () => {
      it('Succeeds', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.div(-2)),
        ]);
        const [
          owner1Balances,
          owner1BalancesLength,
          owner1BalancesAt0,
          owner1BalancesAt1,
          owner2Balances,
          owner2BalancesLength,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountMarketsWithBalances(owner1, account1),
          dolomiteMargin.getters.getAccountNumberOfMarketsWithBalances(owner1, account1),
          dolomiteMargin.getters.getAccountMarketWithBalanceAtIndex(owner1, account1, INTEGERS.ZERO),
          dolomiteMargin.getters.getAccountMarketWithBalanceAtIndex(owner1, account1, INTEGERS.ONE),
          dolomiteMargin.getters.getAccountMarketsWithBalances(owner2, account2),
          dolomiteMargin.getters.getAccountNumberOfMarketsWithBalances(owner2, account2),
        ]);
        expect(owner1Balances.length).to.eql(2);
        expect(owner1BalancesLength.toNumber()).to.eql(2);
        expect(owner1BalancesAt0).to.eql(owner1Balances[0]); // the 0th market ID
        expect(owner1BalancesAt1).to.eql(owner1Balances[1]); // the 1st market ID
        expect(owner2Balances.length).to.eql(zero.toNumber());
        expect(owner2BalancesLength).to.eql(zero);
      });
    });

    describe('#getAdjustedAccountValues', () => {
      it('Succeeds', async () => {
        const rating1 = new BigNumber('1.2');
        const rating2 = new BigNumber('1.5');
        await Promise.all([
          dolomiteMargin.admin.setMarginPremium(market1, rating1.minus(1), {
            from: admin,
          }),
          dolomiteMargin.admin.setMarginPremium(market2, rating2.minus(1), {
            from: admin,
          }),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.div(-2)),
        ]);
        const [values1, values2] = await Promise.all([
          dolomiteMargin.getters.getAdjustedAccountValues(owner1, account1),
          dolomiteMargin.getters.getAdjustedAccountValues(owner2, account2),
        ]);
        expect(values1.borrow).to.eql(prices[1].times(wei.div(2)).times(rating2));
        expect(values1.supply).to.eql(prices[0].times(wei).div(rating1));
        expect(values2.borrow).to.eql(zero);
        expect(values2.supply).to.eql(zero);
      });
    });

    describe('#getAccountBalances', () => {
      it('Succeeds', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.div(-2)),
        ]);
        const [balances1, balances2] = await Promise.all([
          dolomiteMargin.getters.getAccountBalances(owner1, account1),
          dolomiteMargin.getters.getAccountBalances(owner2, account2),
        ]);
        balances1.forEach(balance => {
          if (balance.marketId.eq(market1)) {
            expect(balance.par).to.eql(par);
            expect(balance.wei).to.eql(wei);
          } else if (balance.marketId.eq(market2)) {
            expect(balance.par).to.eql(par.div(-2));
            expect(balance.wei.lte(wei.div(-2))).to.eql(true);
          } else {
            expect(balance.par).to.eql(zero);
            expect(balance.wei).to.eql(zero);
          }
          expect(balance.tokenAddress).to.eql(tokens[markets.findIndex(market => market.eq(balance.marketId))]);
        });
        balances2.forEach((balance, i) => {
          expect(balance.par).to.eql(zero);
          expect(balance.wei).to.eql(zero);
          expect(balance.tokenAddress).to.eql(tokens[i]);
        });
      });
    });

    describe('#isAccountLiquidatable', () => {
      it('True for undercollateralized account', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.times(-1)),
        ]);
        const liquidatable = await dolomiteMargin.getters.isAccountLiquidatable(owner1, account1);
        expect(liquidatable).to.eql(true);
      });

      it('True for partially liquidated account', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par.times(-1)),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.times(2)),
          dolomiteMargin.testing.setAccountStatus(owner1, account1, AccountStatus.Liquidating),
        ]);
        const liquidatable = await dolomiteMargin.getters.isAccountLiquidatable(owner1, account1);
        expect(liquidatable).to.eql(true);
      });

      it('False for collateralized account', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par.times(-1)),
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market2, par.times(2)),
        ]);
        const liquidatable = await dolomiteMargin.getters.isAccountLiquidatable(owner1, account1);
        expect(liquidatable).to.eql(false);
      });

      it('False for vaporizable account', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(owner1, account1, market1, par.times(-1)),
          dolomiteMargin.testing.setAccountStatus(owner1, account1, AccountStatus.Liquidating),
        ]);
        const liquidatable = await dolomiteMargin.getters.isAccountLiquidatable(owner1, account1);
        expect(liquidatable).to.eql(false);
      });
    });
  });

  // ============ Getters for Permissions ============

  describe('Permissions', () => {
    describe('#getIsLocalOperator', () => {
      it('Succeeds', async () => {
        let b1: boolean;
        let b2: boolean;
        let b3: boolean;
        let b4: boolean;

        [b1, b2, b3, b4] = await Promise.all([
          dolomiteMargin.getters.getIsLocalOperator(owner1, operator),
          dolomiteMargin.getters.getIsLocalOperator(owner2, operator),
          dolomiteMargin.getters.getIsLocalOperator(owner1, rando),
          dolomiteMargin.getters.getIsLocalOperator(owner2, rando),
        ]);
        expect(b1).to.eql(false);
        expect(b2).to.eql(false);
        expect(b3).to.eql(false);
        expect(b4).to.eql(false);

        await Promise.all([
          dolomiteMargin.permissions.approveOperator(operator, { from: owner1 }),
          dolomiteMargin.permissions.disapproveOperator(operator, { from: owner2 }),
        ]);

        [b1, b2, b3, b4] = await Promise.all([
          dolomiteMargin.getters.getIsLocalOperator(owner1, operator),
          dolomiteMargin.getters.getIsLocalOperator(owner2, operator),
          dolomiteMargin.getters.getIsLocalOperator(owner1, rando),
          dolomiteMargin.getters.getIsLocalOperator(owner2, rando),
        ]);
        expect(b1).to.eql(true);
        expect(b2).to.eql(false);
        expect(b3).to.eql(false);
        expect(b4).to.eql(false);

        await Promise.all([
          dolomiteMargin.permissions.disapproveOperator(operator, { from: owner1 }),
          dolomiteMargin.permissions.approveOperator(operator, { from: owner2 }),
          dolomiteMargin.permissions.approveOperator(rando, { from: owner1 }),
        ]);

        [b1, b2, b3, b4] = await Promise.all([
          dolomiteMargin.getters.getIsLocalOperator(owner1, operator),
          dolomiteMargin.getters.getIsLocalOperator(owner2, operator),
          dolomiteMargin.getters.getIsLocalOperator(owner1, rando),
          dolomiteMargin.getters.getIsLocalOperator(owner2, rando),
        ]);
        expect(b1).to.eql(false);
        expect(b2).to.eql(true);
        expect(b3).to.eql(true);
        expect(b4).to.eql(false);
      });
    });

    describe('#getIsGlobalOperator', () => {
      it('Succeeds', async () => {
        const randomAccount = accounts[5];
        const randomOperator = accounts[6];

        let b1: boolean;
        let b2: boolean;

        [b1, b2] = await Promise.all([
          dolomiteMargin.getters.getIsGlobalOperator(randomOperator),
          dolomiteMargin.getters.getIsGlobalOperator(randomAccount),
        ]);
        expect(b1).to.eql(false);
        expect(b2).to.eql(false);

        await dolomiteMargin.admin.setGlobalOperator(randomOperator, true, { from: admin });

        [b1, b2] = await Promise.all([
          dolomiteMargin.getters.getIsGlobalOperator(randomOperator),
          dolomiteMargin.getters.getIsGlobalOperator(randomAccount),
        ]);
        expect(b1).to.eql(true);
        expect(b2).to.eql(false);

        await dolomiteMargin.admin.setGlobalOperator(randomAccount, true, { from: admin });

        [b1, b2] = await Promise.all([
          dolomiteMargin.getters.getIsGlobalOperator(randomOperator),
          dolomiteMargin.getters.getIsGlobalOperator(randomAccount),
        ]);
        expect(b1).to.eql(true);
        expect(b2).to.eql(true);

        await dolomiteMargin.admin.setGlobalOperator(randomOperator, false, { from: admin });

        [b1, b2] = await Promise.all([
          dolomiteMargin.getters.getIsGlobalOperator(randomOperator),
          dolomiteMargin.getters.getIsGlobalOperator(randomAccount),
        ]);
        expect(b1).to.eql(false);
        expect(b2).to.eql(true);
      });
    });
  });
});
