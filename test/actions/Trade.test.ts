import BigNumber from 'bignumber.js';
import {
  AccountStatus,
  address,
  AmountDenomination,
  AmountReference,
  Balance,
  Integer,
  INTEGERS,
  Trade,
} from '../../src';
import { toBytes } from '../../src/lib/BytesHelper';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { setupMarkets } from '../helpers/DolomiteMarginHelpers';
import { resetEVM, snapshot } from '../helpers/EVM';
import { expectThrow } from '../helpers/Expect';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';

let who1: address;
let who2: address;
let operator: address;
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
const accountNumber1 = new BigNumber(111);
const accountNumber2 = new BigNumber(222);
const collateralMarket = new BigNumber(0);
const inputMarket = new BigNumber(1);
const outputMarket = new BigNumber(2);
const collateralAmount = new BigNumber(1000000);
const zero = new BigNumber(0);
const par = new BigNumber(100);
const wei = new BigNumber(150);
const negPar = par.times(-1);
const negWei = wei.times(-1);
let defaultGlob: Trade;
const defaultData = {
  value: wei,
  denomination: AmountDenomination.Actual,
  reference: AmountReference.Delta,
};
const zeroGlob = {
  amount: {
    value: zero,
    denomination: AmountDenomination.Principal,
    reference: AmountReference.Delta,
  },
};

const tradeId = new BigNumber(1234);

describe('Trade', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    who1 = dolomiteMargin.getDefaultAccount();
    who2 = accounts[5];
    operator = accounts[6];
    defaultGlob = {
      primaryAccountOwner: who1,
      primaryAccountId: accountNumber1,
      otherAccountOwner: who2,
      otherAccountId: accountNumber2,
      inputMarketId: inputMarket,
      outputMarketId: outputMarket,
      autoTrader: dolomiteMargin.testing.autoTrader.address,
      data: toBytes(tradeId),
      amount: {
        value: negWei,
        denomination: AmountDenomination.Actual,
        reference: AmountReference.Delta,
      },
    };

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);
    const defaultIndex = {
      lastUpdate: INTEGERS.ZERO,
      borrow: wei.div(par),
      supply: wei.div(par),
    };
    await Promise.all([
      dolomiteMargin.testing.setMarketIndex(inputMarket, defaultIndex),
      dolomiteMargin.testing.setMarketIndex(outputMarket, defaultIndex),
      dolomiteMargin.testing.setAccountBalance(who1, accountNumber1, collateralMarket, collateralAmount),
      dolomiteMargin.testing.setAccountBalance(who2, accountNumber2, collateralMarket, collateralAmount),
    ]);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  it('Basic trade test', async () => {
    await Promise.all([approveTrader(), setTradeData()]);
    const txResult = await expectTradeOkay({});
    console.log(`\tTrade gas used: ${txResult.gasUsed}`);
    await Promise.all([expectBalances1(par, negPar), expectBalances2(negPar, par)]);
  });

  it('Succeeds for events', async () => {
    await Promise.all([
      dolomiteMargin.permissions.approveOperator(operator, { from: who1 }),
      approveTrader(),
      setTradeData(),
    ]);
    const txResult = await expectTradeOkay({}, { from: operator });

    const [inputIndex, outputIndex, collateralIndex, inputOraclePrice, outputOraclePrice, collateralOraclePrice] =
      await Promise.all([
        dolomiteMargin.getters.getMarketCachedIndex(inputMarket),
        dolomiteMargin.getters.getMarketCachedIndex(outputMarket),
        dolomiteMargin.getters.getMarketCachedIndex(collateralMarket),
        dolomiteMargin.getters.getMarketPrice(inputMarket),
        dolomiteMargin.getters.getMarketPrice(outputMarket),
        dolomiteMargin.getters.getMarketPrice(collateralMarket),
        expectBalances1(par, negPar),
        expectBalances2(negPar, par),
      ]);

    const logs = dolomiteMargin.logs.parseLogs(txResult);
    expect(logs.length).to.eql(11);

    const operationLog = logs[0];
    expect(operationLog.name).to.eql('LogOperation');
    expect(operationLog.args.sender).to.eql(operator);

    const inputIndexLog = logs[1];
    expect(inputIndexLog.name).to.eql('LogIndexUpdate');
    expect(inputIndexLog.args.market).to.eql(inputMarket);
    expect(inputIndexLog.args.index).to.eql(inputIndex);

    const outputIndexLog = logs[2];
    expect(outputIndexLog.name).to.eql('LogIndexUpdate');
    expect(outputIndexLog.args.market).to.eql(outputMarket);
    expect(outputIndexLog.args.index).to.eql(outputIndex);

    const collateralIndexLog = logs[3];
    expect(collateralIndexLog.name).to.eql('LogIndexUpdate');
    expect(collateralIndexLog.args.market).to.eql(collateralMarket);
    expect(collateralIndexLog.args.index).to.eql(collateralIndex);

    // oracle price logs are emitted in order by the `marketId`
    const collateralOraclePriceLog = logs[4];
    expect(collateralOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(collateralOraclePriceLog.args.market).to.eql(collateralMarket);
    expect(collateralOraclePriceLog.args.price).to.eql(collateralOraclePrice);

    const inputOraclePriceLog = logs[5];
    expect(inputOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(inputOraclePriceLog.args.market).to.eql(inputMarket);
    expect(inputOraclePriceLog.args.price).to.eql(inputOraclePrice);

    const outputOraclePriceLog = logs[6];
    expect(outputOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(outputOraclePriceLog.args.market).to.eql(outputMarket);
    expect(outputOraclePriceLog.args.price).to.eql(outputOraclePrice);

    const tradeLog = logs[7];
    expect(tradeLog.name).to.eql('LogTrade');
    expect(tradeLog.args.takerAccountOwner).to.eql(who1);
    expect(tradeLog.args.takerAccountNumber).to.eql(accountNumber1);
    expect(tradeLog.args.makerAccountOwner).to.eql(who2);
    expect(tradeLog.args.makerAccountNumber).to.eql(accountNumber2);
    expect(tradeLog.args.inputMarket).to.eql(inputMarket);
    expect(tradeLog.args.outputMarket).to.eql(outputMarket);
    expect(tradeLog.args.takerInputUpdate).to.eql({
      newPar: par,
      deltaWei: wei,
    });
    expect(tradeLog.args.takerOutputUpdate).to.eql({
      newPar: negPar,
      deltaWei: negWei,
    });
    expect(tradeLog.args.makerInputUpdate).to.eql({
      newPar: negPar,
      deltaWei: negWei,
    });
    expect(tradeLog.args.makerOutputUpdate).to.eql({
      newPar: par,
      deltaWei: wei,
    });
    expect(tradeLog.args.autoTrader).to.eql(dolomiteMargin.testing.autoTrader.address);

    // interest rates are sorted by marketId, asc
    const collateralMarketInterestRateLog = logs[8];
    expect(collateralMarketInterestRateLog.name).to.eql('LogInterestRate');
    expect(collateralMarketInterestRateLog.args.market).to.eql(collateralMarket);
    expect(collateralMarketInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(collateralMarket),
    );

    const inputMarketInterestRateLog = logs[9];
    expect(inputMarketInterestRateLog.name).to.eql('LogInterestRate');
    expect(inputMarketInterestRateLog.args.market).to.eql(inputMarket);
    expect(inputMarketInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(inputMarket),
    );

    const outputMarketInterestRateLog = logs[10];
    expect(outputMarketInterestRateLog.name).to.eql('LogInterestRate');
    expect(outputMarketInterestRateLog.args.market).to.eql(outputMarket);
    expect(outputMarketInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(outputMarket),
    );
  });

  it('Succeeds for positive delta par/wei', async () => {
    await approveTrader();
    const globs = [
      {
        amount: {
          value: par,
          denomination: AmountDenomination.Principal,
          reference: AmountReference.Delta,
        },
      },
      {
        amount: {
          value: wei,
          denomination: AmountDenomination.Actual,
          reference: AmountReference.Delta,
        },
      },
    ];

    // test input (output will be zero)
    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(zero, zero)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(negPar, zero), expectBalances2(par, zero)]);

      // starting positive
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(par, par)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(negPar, zero), expectBalances2(par.times(2), par)]);

      // starting negative
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(negPar, negPar)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(negPar, zero), expectBalances2(zero, negPar)]);
    }

    // test output (input will be zero)
    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(zero, zero)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, negPar), expectBalances2(zero, par)]);

      // starting positive
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(par, par)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, negPar), expectBalances2(par, par.times(2))]);

      // starting negative
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(negPar, negPar)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, negPar), expectBalances2(negPar, zero)]);
    }
  });

  it('Succeeds for negative delta par/wei', async () => {
    await approveTrader();
    const globs = [
      {
        amount: {
          value: negPar,
          denomination: AmountDenomination.Principal,
          reference: AmountReference.Delta,
        },
      },
      {
        amount: {
          value: negWei,
          denomination: AmountDenomination.Actual,
          reference: AmountReference.Delta,
        },
      },
    ];

    // test input (output will be zero)
    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(zero, zero)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(par, zero), expectBalances2(negPar, zero)]);

      // starting positive
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(par, par)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(par, zero), expectBalances2(zero, par)]);

      // starting negative
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(negPar, negPar)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(par, zero), expectBalances2(negPar.times(2), negPar)]);
    }

    // test output (input will be zero)
    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(zero, zero)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, par), expectBalances2(zero, negPar)]);

      // starting positive
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(par, par)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, par), expectBalances2(par, zero)]);

      // starting negative
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(negPar, negPar)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, par), expectBalances2(negPar, negPar.times(2))]);
    }
  });

  it('Succeeds for positive target par/wei', async () => {
    await approveTrader();
    const globs = [
      {
        amount: {
          value: par,
          denomination: AmountDenomination.Principal,
          reference: AmountReference.Target,
        },
      },
      {
        amount: {
          value: wei,
          denomination: AmountDenomination.Actual,
          reference: AmountReference.Target,
        },
      },
    ];

    // test input (output will be zero)
    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(zero, zero)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(negPar, zero), expectBalances2(par, zero)]);

      // starting positive (<target)
      await Promise.all([
        setTradeData(zeroGlob.amount),
        setBalances1(zero, zero),
        setBalances2(par.div(2), par.div(2)),
      ]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(negPar.div(2), zero), expectBalances2(par, par.div(2))]);

      // starting positive (=target)
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(par, par)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(zero, zero), expectBalances2(par, par)]);

      // starting positive (>target)
      await Promise.all([
        setTradeData(zeroGlob.amount),
        setBalances1(zero, zero),
        setBalances2(par.times(2), par.times(2)),
      ]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(par, zero), expectBalances2(par, par.times(2))]);

      // starting negative
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(negPar, negPar)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(negPar.times(2), zero), expectBalances2(par, negPar)]);
    }

    // test output (input will be zero)
    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(zero, zero)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, negPar), expectBalances2(zero, par)]);

      // starting positive (<target)
      await Promise.all([
        setTradeData(globs[i].amount),
        setBalances1(zero, zero),
        setBalances2(par.div(2), par.div(2)),
      ]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, negPar.div(2)), expectBalances2(par.div(2), par)]);

      // starting positive (=target)
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(par, par)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, zero), expectBalances2(par, par)]);

      // starting positive (>target)
      await Promise.all([
        setTradeData(globs[i].amount),
        setBalances1(zero, zero),
        setBalances2(par.times(2), par.times(2)),
      ]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, par), expectBalances2(par.times(2), par)]);

      // starting negative
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(negPar, negPar)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, negPar.times(2)), expectBalances2(negPar, par)]);
    }
  });

  it('Succeeds for negative target par/wei', async () => {
    await approveTrader();
    const globs = [
      {
        amount: {
          value: negPar,
          denomination: AmountDenomination.Principal,
          reference: AmountReference.Target,
        },
      },
      {
        amount: {
          value: negWei,
          denomination: AmountDenomination.Actual,
          reference: AmountReference.Target,
        },
      },
    ];

    // test input (output will be zero)
    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(zero, zero)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(par, zero), expectBalances2(negPar, zero)]);

      // starting negative (<target)
      await Promise.all([
        setTradeData(zeroGlob.amount),
        setBalances1(zero, zero),
        setBalances2(negPar.div(2), negPar.div(2)),
      ]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(par.div(2), zero), expectBalances2(negPar, negPar.div(2))]);

      // starting negative (=target)
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(negPar, negPar)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(zero, zero), expectBalances2(negPar, negPar)]);

      // starting negative (>target)
      await Promise.all([
        setTradeData(zeroGlob.amount),
        setBalances1(zero, zero),
        setBalances2(negPar.times(2), negPar.times(2)),
      ]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(negPar, zero), expectBalances2(negPar, negPar.times(2))]);

      // starting positive
      await Promise.all([setTradeData(zeroGlob.amount), setBalances1(zero, zero), setBalances2(par, par)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(par.times(2), zero), expectBalances2(negPar, par)]);
    }

    // test output (input will be zero)
    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(zero, zero)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, par), expectBalances2(zero, negPar)]);

      // starting negative (<target)
      await Promise.all([
        setTradeData(globs[i].amount),
        setBalances1(zero, zero),
        setBalances2(negPar.div(2), negPar.div(2)),
      ]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, par.div(2)), expectBalances2(negPar.div(2), negPar)]);

      // starting negative (=target)
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(negPar, negPar)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, zero), expectBalances2(negPar, negPar)]);

      // starting negative (>target)
      await Promise.all([
        setTradeData(globs[i].amount),
        setBalances1(zero, zero),
        setBalances2(negPar.times(2), negPar.times(2)),
      ]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, negPar), expectBalances2(negPar.times(2), negPar)]);

      // starting positive
      await Promise.all([setTradeData(globs[i].amount), setBalances1(zero, zero), setBalances2(par, par)]);
      await expectTradeOkay(zeroGlob);
      await Promise.all([expectBalances1(zero, par.times(2)), expectBalances2(par, negPar)]);
    }
  });

  it('Succeeds for zero target par/wei', async () => {
    await approveTrader();
    const globs = [
      {
        amount: {
          value: zero,
          denomination: AmountDenomination.Principal,
          reference: AmountReference.Target,
        },
      },
      {
        amount: {
          value: zero,
          denomination: AmountDenomination.Actual,
          reference: AmountReference.Target,
        },
      },
    ];

    const start1 = par.div(2);
    const start2 = negPar.div(2);

    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await Promise.all([setTradeData(globs[i].amount), setBalances1(start1, start2), setBalances2(zero, zero)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(start1, start2), expectBalances2(zero, zero)]);

      // starting positive/negative
      await Promise.all([setTradeData(globs[i].amount), setBalances1(start1, start2), setBalances2(par, negPar)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(start1.plus(par), start2.plus(negPar)), expectBalances2(zero, zero)]);

      // starting negative/positive
      await Promise.all([setTradeData(globs[i].amount), setBalances1(start1, start2), setBalances2(negPar, par)]);
      await expectTradeOkay(globs[i]);
      await Promise.all([expectBalances1(start1.plus(negPar), start2.plus(par)), expectBalances2(zero, zero)]);
    }
  });

  it('Succeeds for zero input and output', async () => {
    await Promise.all([approveTrader(), setTradeData({ value: zero })]);
    await expectTradeOkay({
      amount: {
        value: zero,
        denomination: AmountDenomination.Actual,
        reference: AmountReference.Delta,
      },
    });
    await Promise.all([expectBalances1(zero, zero), expectBalances2(zero, zero)]);
  });

  it('Succeeds for zero input amount (positive output)', async () => {
    await Promise.all([approveTrader(), setTradeData({ value: wei })]);
    await expectTradeOkay({
      amount: {
        value: zero,
        denomination: AmountDenomination.Actual,
        reference: AmountReference.Delta,
      },
    });
    await Promise.all([expectBalances1(zero, negPar), expectBalances2(zero, par)]);
  });

  it('Succeeds for zero input amount (negative output)', async () => {
    await Promise.all([approveTrader(), setTradeData({ value: negWei })]);
    await expectTradeOkay({
      amount: {
        value: zero,
        denomination: AmountDenomination.Actual,
        reference: AmountReference.Delta,
      },
    });
    await Promise.all([expectBalances1(zero, par), expectBalances2(zero, negPar)]);
  });

  it('Succeeds for zero output amount (positive input)', async () => {
    await Promise.all([approveTrader(), setTradeData({ value: zero })]);
    await expectTradeOkay({
      amount: {
        value: wei,
        denomination: AmountDenomination.Actual,
        reference: AmountReference.Delta,
      },
    });
    await Promise.all([expectBalances1(negPar, zero), expectBalances2(par, zero)]);
  });

  it('Succeeds for zero output amount (negative input)', async () => {
    await Promise.all([approveTrader(), setTradeData({ value: zero })]);
    await expectTradeOkay({
      amount: {
        value: negWei,
        denomination: AmountDenomination.Actual,
        reference: AmountReference.Delta,
      },
    });
    await Promise.all([expectBalances1(par, zero), expectBalances2(negPar, zero)]);
  });

  it('Succeeds and sets status to Normal', async () => {
    await Promise.all([
      dolomiteMargin.testing.setAccountStatus(who1, accountNumber1, AccountStatus.Liquidating),
      dolomiteMargin.testing.setAccountStatus(who2, accountNumber2, AccountStatus.Liquidating),
      approveTrader(),
      setTradeData(),
    ]);
    await expectTradeOkay({});
    const [status1, status2] = await Promise.all([
      dolomiteMargin.getters.getAccountStatus(who1, accountNumber1),
      dolomiteMargin.getters.getAccountStatus(who2, accountNumber2),
    ]);
    expect(status1).to.eql(AccountStatus.Normal);
    expect(status2).to.eql(AccountStatus.Normal);
  });

  it('Succeeds for local operator sender', async () => {
    await Promise.all([approveTrader(), approveOperator(), setTradeData()]);
    await expectTradeOkay({}, { from: operator });
    await Promise.all([expectBalances1(par, negPar), expectBalances2(negPar, par)]);
  });

  it('Succeeds for global operator sender', async () => {
    await Promise.all([
      approveTrader(),
      dolomiteMargin.admin.setGlobalOperator(operator, true, { from: accounts[0] }),
      setTradeData(),
    ]);
    await expectTradeOkay({}, { from: operator });
    await Promise.all([expectBalances1(par, negPar), expectBalances2(negPar, par)]);
  });

  it('Verifies input market', async () => {
    await Promise.all([
      approveTrader(),
      setTradeData(),
      dolomiteMargin.testing.autoTrader.setRequireInputMarketId(outputMarket),
    ]);
    await expectTradeRevert({}, 'TestAutoTrader: input market mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireInputMarketId(inputMarket);
    await expectTradeOkay({});
  });

  it('Verifies output market', async () => {
    await Promise.all([
      approveTrader(),
      setTradeData(),
      dolomiteMargin.testing.autoTrader.setRequireOutputMarketId(inputMarket),
    ]);
    await expectTradeRevert({}, 'TestAutoTrader: output market mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireOutputMarketId(outputMarket);
    await expectTradeOkay({});
  });

  it('Verifies maker account', async () => {
    await Promise.all([
      approveTrader(),
      setTradeData(),
      dolomiteMargin.testing.autoTrader.setRequireMakerAccount(who1, accountNumber2),
    ]);
    await expectTradeRevert({}, 'TestAutoTrader: maker account owner mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireMakerAccount(who2, accountNumber1);
    await expectTradeRevert({}, 'TestAutoTrader: maker account number mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireMakerAccount(who2, accountNumber2);
    await expectTradeOkay({});
  });

  it('Verifies taker account', async () => {
    await Promise.all([
      approveTrader(),
      setTradeData(),
      dolomiteMargin.testing.autoTrader.setRequireTakerAccount(who2, accountNumber1),
    ]);
    await expectTradeRevert({}, 'TestAutoTrader: taker account owner mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireTakerAccount(who1, accountNumber2);
    await expectTradeRevert({}, 'TestAutoTrader: taker account number mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireTakerAccount(who1, accountNumber1);
    await expectTradeOkay({});
  });

  it('Verifies old input par', async () => {
    await Promise.all([
      approveTrader(),
      setTradeData(),
      setBalances2(par, zero),
      dolomiteMargin.testing.autoTrader.setRequireOldInputPar(par.times(-1)),
    ]);
    await expectTradeRevert({}, 'TestAutoTrader: oldInputPar sign mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireOldInputPar(par.times(2));
    await expectTradeRevert({}, 'TestAutoTrader: oldInputPar value mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireOldInputPar(par);
    await expectTradeOkay({});
  });

  it('Verifies new input par', async () => {
    await Promise.all([
      approveTrader(),
      setTradeData(),
      dolomiteMargin.testing.autoTrader.setRequireNewInputPar(negPar.times(-1)),
    ]);
    await expectTradeRevert({}, 'TestAutoTrader: newInputPar sign mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireNewInputPar(negPar.times(2));
    await expectTradeRevert({}, 'TestAutoTrader: newInputPar value mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireNewInputPar(negPar);
    await expectTradeOkay({});
  });

  it('Verifies input wei', async () => {
    await Promise.all([
      approveTrader(),
      setTradeData(),
      dolomiteMargin.testing.autoTrader.setRequireInputWei(negWei.times(-1)),
    ]);
    await expectTradeRevert({}, 'TestAutoTrader: inputWei sign mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireInputWei(negWei.times(2));
    await expectTradeRevert({}, 'TestAutoTrader: inputWei value mismatch');
    await dolomiteMargin.testing.autoTrader.setRequireInputWei(negWei);
    await expectTradeOkay({});
  });

  it('Fails for non-operator sender', async () => {
    await Promise.all([approveTrader(), setTradeData()]);
    await expectTradeRevert({}, 'Storage: Unpermissioned operator', {
      from: operator,
    });
  });

  it('Fails for non-operator autoTrader', async () => {
    await Promise.all([approveOperator(), setTradeData()]);
    await expectTradeRevert({}, 'Storage: Unpermissioned operator');
  });

  it('Fails for wrong-contract autoTrader', async () => {
    const otherContract = dolomiteMargin.testing.exchangeWrapper.address;
    await dolomiteMargin.permissions.approveOperator(otherContract, { from: who1 });
    await expectTradeRevert({ autoTrader: otherContract });
  });

  it('Fails for one-sided trades', async () => {
    await Promise.all([approveTrader(), setTradeData({ value: negWei })]);
    await expectTradeRevert({}, 'TradeImpl: Trades cannot be one-sided');
  });

  it('Fails to trade to same account', async () => {
    await expectTradeRevert(
      {
        otherAccountOwner: who1,
        otherAccountId: accountNumber1,
      },
      'OperationImpl: Duplicate accounts in action',
    );
  });
});

// ============ Helper Functions ============

async function setBalances1(inputPar: Integer, outputPar: Integer) {
  return Promise.all([
    dolomiteMargin.testing.setAccountBalance(who1, accountNumber1, inputMarket, inputPar),
    dolomiteMargin.testing.setAccountBalance(who1, accountNumber1, outputMarket, outputPar),
  ]);
}

async function setBalances2(inputPar: Integer, outputPar: Integer) {
  return Promise.all([
    dolomiteMargin.testing.setAccountBalance(who2, accountNumber2, inputMarket, inputPar),
    dolomiteMargin.testing.setAccountBalance(who2, accountNumber2, outputMarket, outputPar),
  ]);
}

async function setTradeData(data?: object) {
  const combinedData = { ...defaultData, ...data };
  return dolomiteMargin.testing.autoTrader.setData(tradeId, combinedData);
}

async function expectBalances1(expectedInputPar: Integer, expectedOutputPar: Integer) {
  const balances = await dolomiteMargin.getters.getAccountBalances(who1, accountNumber1);
  expectBalances(balances, expectedInputPar, expectedOutputPar);
}

async function expectBalances2(expectedInputPar: Integer, expectedOutputPar: Integer) {
  const balances = await dolomiteMargin.getters.getAccountBalances(who2, accountNumber2);
  expectBalances(balances, expectedInputPar, expectedOutputPar);
}

function expectBalances(balances: Balance[], expectedInputPar: Integer, expectedOutputPar: Integer) {
  balances.forEach(balance => {
    if (balance.marketId.eq(inputMarket)) {
      expect(balance.par).to.eql(expectedInputPar);
    } else if (balance.marketId.eq(outputMarket)) {
      expect(balance.par).to.eql(expectedOutputPar);
    } else if (balance.marketId.eq(collateralMarket)) {
      expect(balance.par).to.eql(collateralAmount);
    } else {
      expect(balance.par).to.eql(zero);
    }
  });
}

async function approveTrader() {
  return dolomiteMargin.permissions.approveOperator(dolomiteMargin.testing.autoTrader.address, { from: who2 });
}

async function approveOperator() {
  return dolomiteMargin.permissions.approveOperator(operator, { from: who1 });
}

async function expectTradeOkay(glob: Object, options?: Object) {
  const combinedGlob = { ...defaultGlob, ...glob };
  return dolomiteMargin.operation.initiate().trade(combinedGlob).commit(options);
}

async function expectTradeRevert(glob: Object, reason?: string, options?: Object) {
  await expectThrow(expectTradeOkay(glob, options), reason);
}
