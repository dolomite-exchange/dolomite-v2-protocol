import BigNumber from 'bignumber.js';
import { AccountStatus, address, AmountDenomination, AmountReference, Integer, Sell, INTEGERS } from '../../src';
import { expectThrow } from '../helpers/Expect';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { setupMarkets } from '../helpers/DolomiteMarginHelpers';
import { resetEVM, snapshot } from '../helpers/EVM';
import { TestExchangeWrapperOrder, TestOrder, TestOrderType } from '../helpers/types';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { TestToken } from '../modules/TestToken';

let who: address;
let operator: address;
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
const accountNumber = INTEGERS.ZERO;
const makerMarket = INTEGERS.ZERO;
const takerMarket = INTEGERS.ONE;
const collateralMarket = new BigNumber(2);
const collateralAmount = new BigNumber(1000000);
const zero = new BigNumber(0);
const makerPar = new BigNumber(100);
const makerWei = new BigNumber(150);
const takerPar = new BigNumber(200);
const takerWei = new BigNumber(300);
let makerToken: TestToken;
let takerToken: TestToken;
let defaultGlob: Sell;
let testOrder: TestOrder;
let EXCHANGE_ADDRESS: string;

describe('Sell', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    EXCHANGE_ADDRESS = dolomiteMargin.testing.exchangeWrapper.exchangeAddress;
    accounts = r.accounts;
    who = dolomiteMargin.getDefaultAccount();
    operator = accounts[6];
    makerToken = dolomiteMargin.testing.tokenA;
    takerToken = dolomiteMargin.testing.tokenB;
    testOrder = {
      type: TestOrderType.Test,
      exchangeWrapperAddress: dolomiteMargin.testing.exchangeWrapper.address,
      originator: who,
      makerToken: makerToken.address,
      takerToken: takerToken.address,
      makerAmount: makerWei,
      takerAmount: takerWei,
      allegedTakerAmount: takerWei,
      desiredMakerAmount: makerWei,
    } as TestExchangeWrapperOrder;
    defaultGlob = {
      primaryAccountOwner: who,
      primaryAccountId: accountNumber,
      takerMarketId: takerMarket,
      makerMarketId: makerMarket,
      order: testOrder,
      amount: {
        value: takerWei.times(-1),
        denomination: AmountDenomination.Actual,
        reference: AmountReference.Delta,
      },
    };

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);
    const defaultIndex = {
      lastUpdate: INTEGERS.ZERO,
      borrow: takerWei.div(takerPar),
      supply: takerWei.div(takerPar),
    };
    await Promise.all([
      dolomiteMargin.testing.setMarketIndex(makerMarket, defaultIndex),
      dolomiteMargin.testing.setMarketIndex(takerMarket, defaultIndex),
      dolomiteMargin.testing.setAccountBalance(
        who,
        accountNumber,
        collateralMarket,
        collateralAmount,
      ),
      dolomiteMargin.testing.tokenA.setMaximumDolomiteMarginAllowance(who),
    ]);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  it('Basic sell test', async () => {
    await Promise.all([
      issueMakerTokenToWrapper(makerWei),
      issueTakerTokenToDolomiteMargin(takerWei),
      setTakerBalance(takerPar),
    ]);
    const txResult = await expectSellOkay({});
    console.log(`\tSell gas used: ${txResult.gasUsed}`);
    await Promise.all([
      await expectPars(makerPar, zero),
      await expectDolomiteMarginBalances(makerWei, zero),
      await expectWrapperBalances(zero, zero),
      await expectExchangeBalances(zero, takerWei),
    ]);
  });

  it('Succeeds for events', async () => {
    await Promise.all([
      dolomiteMargin.permissions.approveOperator(operator, { from: who }),
      issueMakerTokenToWrapper(makerWei),
      issueTakerTokenToDolomiteMargin(takerWei),
      setTakerBalance(takerPar),
    ]);
    const txResult = await expectSellOkay({}, { from: operator });
    const [makerIndex, takerIndex, collateralIndex, makerOraclePrice, takerOraclePrice, collateralOraclePrice] = await Promise.all([
      dolomiteMargin.getters.getMarketCachedIndex(makerMarket),
      dolomiteMargin.getters.getMarketCachedIndex(takerMarket),
      dolomiteMargin.getters.getMarketCachedIndex(collateralMarket),
      dolomiteMargin.getters.getMarketPrice(makerMarket),
      dolomiteMargin.getters.getMarketPrice(takerMarket),
      dolomiteMargin.getters.getMarketPrice(collateralMarket),
      expectPars(makerPar, zero),
      expectDolomiteMarginBalances(makerWei, zero),
      expectWrapperBalances(zero, zero),
      expectExchangeBalances(zero, takerWei),
    ]);

    const logs = dolomiteMargin.logs.parseLogs(txResult);
    expect(logs.length).to.eql(11);

    const operationLog = logs[0];
    expect(operationLog.name).to.eql('LogOperation');
    expect(operationLog.args.sender).to.eql(operator);

    const takerIndexLog = logs[1];
    expect(takerIndexLog.name).to.eql('LogIndexUpdate');
    expect(takerIndexLog.args.market).to.eql(takerMarket);
    expect(takerIndexLog.args.index).to.eql(takerIndex);

    const makerIndexLog = logs[2];
    expect(makerIndexLog.name).to.eql('LogIndexUpdate');
    expect(makerIndexLog.args.market).to.eql(makerMarket);
    expect(makerIndexLog.args.index).to.eql(makerIndex);

    const collateralIndexLog = logs[3];
    expect(collateralIndexLog.name).to.eql('LogIndexUpdate');
    expect(collateralIndexLog.args.market).to.eql(collateralMarket);
    expect(collateralIndexLog.args.index).to.eql(collateralIndex);

    // oracle price updates are emitted in order by `marketId`
    const makerOraclePriceLog = logs[4];
    expect(makerOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(makerOraclePriceLog.args.market).to.eql(makerMarket);
    expect(makerOraclePriceLog.args.price).to.eql(makerOraclePrice);

    const takerOraclePriceLog = logs[5];
    expect(takerOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(takerOraclePriceLog.args.market).to.eql(takerMarket);
    expect(takerOraclePriceLog.args.price).to.eql(takerOraclePrice);

    const collateralOraclePriceLog = logs[6];
    expect(collateralOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(collateralOraclePriceLog.args.market).to.eql(collateralMarket);
    expect(collateralOraclePriceLog.args.price).to.eql(collateralOraclePrice);

    const sellLog = logs[7];
    expect(sellLog.name).to.eql('LogSell');
    expect(sellLog.args.accountOwner).to.eql(who);
    expect(sellLog.args.accountNumber).to.eql(accountNumber);
    expect(sellLog.args.takerMarket).to.eql(takerMarket);
    expect(sellLog.args.makerMarket).to.eql(makerMarket);
    expect(sellLog.args.takerUpdate).to.eql({
      newPar: zero,
      deltaWei: takerWei.times(-1),
    });
    expect(sellLog.args.makerUpdate).to.eql({
      newPar: makerPar,
      deltaWei: makerWei,
    });
    expect(sellLog.args.exchangeWrapper).to.eql(dolomiteMargin.testing.exchangeWrapper.address);

    // interest rates are sorted by marketId, asc
    const makerMarketInterestRateLog = logs[8];
    expect(makerMarketInterestRateLog.name).to.eql('LogInterestRate');
    expect(makerMarketInterestRateLog.args.market).to.eql(makerMarket);
    expect(makerMarketInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(makerMarket),
    );

    const takerMarketInterestRateLog = logs[9];
    expect(takerMarketInterestRateLog.name).to.eql('LogInterestRate');
    expect(takerMarketInterestRateLog.args.market).to.eql(takerMarket);
    expect(takerMarketInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(takerMarket),
    );

    const collateralMarketInterestRateLog = logs[10];
    expect(collateralMarketInterestRateLog.name).to.eql('LogInterestRate');
    expect(collateralMarketInterestRateLog.args.market).to.eql(collateralMarket);
    expect(collateralMarketInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(collateralMarket),
    );
  });

  it('Succeeds for zero makerAmount', async () => {
    await Promise.all([
      issueTakerTokenToDolomiteMargin(takerWei),
      setTakerBalance(takerPar),
    ]);
    await expectSellOkay({
      order: {
        ...testOrder,
        makerAmount: zero,
      },
    });

    await Promise.all([
      await expectPars(zero, zero),
      await expectDolomiteMarginBalances(zero, zero),
      await expectWrapperBalances(zero, zero),
      await expectExchangeBalances(zero, takerWei),
    ]);
  });

  it('Succeeds for zero takerAmount', async () => {
    await Promise.all([
      issueMakerTokenToWrapper(makerWei),
      setTakerBalance(takerPar),
    ]);
    await expectSellOkay({
      order: {
        ...testOrder,
        takerAmount: zero,
      },
      amount: {
        value: zero,
        denomination: AmountDenomination.Actual,
        reference: AmountReference.Delta,
      },
    });

    await Promise.all([
      await expectPars(makerPar, takerPar),
      await expectDolomiteMarginBalances(makerWei, zero),
      await expectWrapperBalances(zero, zero),
      await expectExchangeBalances(zero, zero),
    ]);
  });

  it('Succeeds and sets status to Normal', async () => {
    await Promise.all([
      issueMakerTokenToWrapper(makerWei),
      issueTakerTokenToDolomiteMargin(takerWei),
      setTakerBalance(takerPar),
      dolomiteMargin.testing.setAccountStatus(
        who,
        accountNumber,
        AccountStatus.Liquidating,
      ),
    ]);
    await expectSellOkay({});
    const status = await dolomiteMargin.getters.getAccountStatus(who, accountNumber);
    expect(status).to.eql(AccountStatus.Normal);
  });

  it('Succeeds for local operator', async () => {
    await Promise.all([
      issueMakerTokenToWrapper(makerWei),
      issueTakerTokenToDolomiteMargin(takerWei),
      setTakerBalance(takerPar),
      dolomiteMargin.permissions.approveOperator(operator, { from: who }),
    ]);
    await expectSellOkay({}, { from: operator });

    await Promise.all([
      await expectPars(makerPar, zero),
      await expectDolomiteMarginBalances(makerWei, zero),
      await expectWrapperBalances(zero, zero),
      await expectExchangeBalances(zero, takerWei),
    ]);
  });

  it('Succeeds for global operator', async () => {
    await Promise.all([
      issueMakerTokenToWrapper(makerWei),
      issueTakerTokenToDolomiteMargin(takerWei),
      setTakerBalance(takerPar),
      dolomiteMargin.admin.setGlobalOperator(operator, true, { from: accounts[0] }),
    ]);
    await expectSellOkay({}, { from: operator });

    await Promise.all([
      await expectPars(makerPar, zero),
      await expectDolomiteMarginBalances(makerWei, zero),
      await expectWrapperBalances(zero, zero),
      await expectExchangeBalances(zero, takerWei),
    ]);
  });

  it('Fails for non-operator', async () => {
    await expectSellRevert({}, 'Storage: Unpermissioned operator', {
      from: operator,
    });
  });

  it('Fails for positive takerAmount', async () => {
    await expectSellRevert(
      {
        amount: {
          value: takerWei,
          denomination: AmountDenomination.Actual,
          reference: AmountReference.Delta,
        },
      },
      'Exchange: Cannot exchange positive',
    );
  });

  it('Fails for takerToken equals makerToken', async () => {
    await expectSellRevert(
      {
        takerMarketId: makerMarket,
        order: {
          ...testOrder,
          takerToken: makerToken.address,
        },
      },
      'OperationImpl: Duplicate markets in action',
    );
  });

  it('Fails for DolomiteMargin without enough tokens', async () => {
    await Promise.all([
      issueMakerTokenToWrapper(makerWei),
      issueTakerTokenToDolomiteMargin(takerWei.div(2)),
      setTakerBalance(takerPar),
    ]);
    await expectSellRevert({}, 'Token: transfer failed');
  });

  it('Fails for exchangeWrapper without enough tokens', async () => {
    await Promise.all([
      issueMakerTokenToWrapper(makerWei.div(2)),
      issueTakerTokenToDolomiteMargin(takerWei),
      setTakerBalance(takerPar),
    ]);
    await expectSellRevert({}, 'Token: transferFrom failed');
  });
});

// ============ Helper Functions ============

async function expectPars(
  expectedMakerPar: Integer,
  expectedTakerPar: Integer,
) {
  const [makerBalance, balances] = await Promise.all([
    makerToken.getBalance(dolomiteMargin.address),
    dolomiteMargin.getters.getAccountBalances(who, accountNumber),
  ]);
  expect(makerBalance)
    .to.eql(expectedMakerPar.times(makerWei)
      .div(makerPar));
  balances.forEach((balance) => {
    if (balance.marketId.eq(makerMarket)) {
      expect(balance.par)
        .to.eql(expectedMakerPar);
    } else if (balance.marketId.eq(takerMarket)) {
      expect(balance.par)
        .to.eql(expectedTakerPar);
    } else if (balance.marketId.eq(collateralMarket)) {
      expect(balance.par)
        .to.eql(collateralAmount);
    } else {
      expect(balance.par)
        .to.eql(zero);
    }
  });
}

async function expectWrapperBalances(
  expectedMakerWei: Integer,
  expectedTakerWei: Integer,
) {
  const [makerWei, takerWei] = await Promise.all([
    makerToken.getBalance(dolomiteMargin.testing.exchangeWrapper.address),
    takerToken.getBalance(dolomiteMargin.testing.exchangeWrapper.address),
  ]);
  expect(makerWei)
    .to.eql(expectedMakerWei);
  expect(takerWei)
    .to.eql(expectedTakerWei);
}

async function expectExchangeBalances(
  expectedMakerWei: Integer,
  expectedTakerWei: Integer,
) {
  const [makerWei, takerWei] = await Promise.all([
    makerToken.getBalance(EXCHANGE_ADDRESS),
    takerToken.getBalance(EXCHANGE_ADDRESS),
  ]);
  expect(makerWei)
    .to.eql(expectedMakerWei);
  expect(takerWei)
    .to.eql(expectedTakerWei);
}

async function expectDolomiteMarginBalances(
  expectedMakerWei: Integer,
  expectedTakerWei: Integer,
) {
  const [makerWei, takerWei] = await Promise.all([
    makerToken.getBalance(dolomiteMargin.address),
    takerToken.getBalance(dolomiteMargin.address),
  ]);
  expect(makerWei)
    .to.eql(expectedMakerWei);
  expect(takerWei)
    .to.eql(expectedTakerWei);
}

async function issueMakerTokenToWrapper(amount: Integer) {
  return makerToken.issueTo(amount, dolomiteMargin.testing.exchangeWrapper.address);
}

async function issueTakerTokenToDolomiteMargin(amount: Integer) {
  return takerToken.issueTo(amount, dolomiteMargin.address);
}

async function setTakerBalance(par: Integer) {
  return dolomiteMargin.testing.setAccountBalance(who, accountNumber, takerMarket, par);
}

async function expectSellOkay(glob: Object, options?: Object) {
  const combinedGlob = { ...defaultGlob, ...glob };
  return dolomiteMargin.operation
    .initiate()
    .sell(combinedGlob)
    .commit(options);
}

async function expectSellRevert(
  glob: Object,
  reason?: string,
  options?: Object,
) {
  await expectThrow(expectSellOkay(glob, options), reason);
}
