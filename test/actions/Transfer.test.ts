import BigNumber from 'bignumber.js';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { resetEVM, snapshot } from '../helpers/EVM';
import { setupMarkets } from '../helpers/DolomiteMarginHelpers';
import { expectThrow } from '../helpers/Expect';
import { AccountStatus, address, AmountDenomination, AmountReference, Integer, INTEGERS, Transfer } from '../../src';

let owner1: address;
let owner2: address;
let admin: address;
let operator: address;
const accountNumber1 = new BigNumber(133);
const accountNumber2 = new BigNumber(244);
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
const market = INTEGERS.ZERO;
const collateralMarket = new BigNumber(2);
const collateralAmount = new BigNumber(1000000);
const zero = new BigNumber(0);
const par = new BigNumber(100);
const wei = new BigNumber(150);
const negPar = par.times(-1);
const negWei = wei.times(-1);
let defaultGlob: Transfer;

describe('Transfer', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    owner1 = accounts[5];
    owner2 = accounts[6];
    operator = dolomiteMargin.getDefaultAccount();
    defaultGlob = {
      primaryAccountOwner: owner1,
      primaryAccountId: accountNumber1,
      toAccountOwner: owner2,
      toAccountId: accountNumber2,
      marketId: market,
      amount: {
        value: zero,
        denomination: AmountDenomination.Principal,
        reference: AmountReference.Target,
      },
    };

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);
    await Promise.all([
      dolomiteMargin.testing.setMarketIndex(market, {
        lastUpdate: INTEGERS.ZERO,
        borrow: new BigNumber(1.5),
        supply: new BigNumber(1.5),
      }),
      dolomiteMargin.permissions.approveOperator(operator, { from: owner1 }),
      dolomiteMargin.permissions.approveOperator(operator, { from: owner2 }),
      dolomiteMargin.testing.setAccountBalance(owner1, accountNumber1, collateralMarket, collateralAmount),
      dolomiteMargin.testing.setAccountBalance(owner2, accountNumber2, collateralMarket, collateralAmount),
    ]);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  it('Basic transfer test', async () => {
    const fullAmount = new BigNumber(100);
    const halfAmount = new BigNumber(50);

    await Promise.all([
      dolomiteMargin.testing.setMarketIndex(market, {
        lastUpdate: INTEGERS.ZERO,
        borrow: INTEGERS.ONE,
        supply: INTEGERS.ONE,
      }),
      dolomiteMargin.testing.setAccountBalance(owner1, accountNumber1, market, fullAmount),
      dolomiteMargin.testing.setAccountBalance(owner2, accountNumber2, market, fullAmount),
    ]);

    const txResult = await expectTransferOkay({
      amount: {
        value: halfAmount,
        denomination: AmountDenomination.Actual,
        reference: AmountReference.Delta,
      },
    });

    await expectBalances(
      fullAmount.plus(halfAmount),
      fullAmount.plus(halfAmount),
      fullAmount.minus(halfAmount),
      fullAmount.minus(halfAmount),
    );

    console.log(`\tTransfer gas used: ${txResult.gasUsed}`);
  });

  it('Succeeds for events', async () => {
    await dolomiteMargin.admin.setGlobalOperator(operator, true, { from: admin });

    const txResult = await expectTransferOkay(
      {
        amount: {
          value: wei,
          denomination: AmountDenomination.Actual,
          reference: AmountReference.Delta,
        },
      },
      { from: operator },
    );

    const [marketIndex, collateralIndex, marketOraclePrice, collateralOraclePrice] = await Promise.all([
      dolomiteMargin.getters.getMarketCachedIndex(market),
      dolomiteMargin.getters.getMarketCachedIndex(collateralMarket),
      dolomiteMargin.getters.getMarketPrice(market),
      dolomiteMargin.getters.getMarketPrice(collateralMarket),
      expectBalances(par, wei, negPar, negWei),
    ]);

    const logs = dolomiteMargin.logs.parseLogs(txResult);
    expect(logs.length).to.eql(8);

    const operationLog = logs[0];
    expect(operationLog.name).to.eql('LogOperation');
    expect(operationLog.args.sender).to.eql(operator);

    const marketIndexLog = logs[1];
    expect(marketIndexLog.name).to.eql('LogIndexUpdate');
    expect(marketIndexLog.args.market).to.eql(market);
    expect(marketIndexLog.args.index).to.eql(marketIndex);

    const collateralIndexLog = logs[2];
    expect(collateralIndexLog.name).to.eql('LogIndexUpdate');
    expect(collateralIndexLog.args.market).to.eql(collateralMarket);
    expect(collateralIndexLog.args.index).to.eql(collateralIndex);

    const marketOraclePriceLog = logs[3];
    expect(marketOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(marketOraclePriceLog.args.market).to.eql(market);
    expect(marketOraclePriceLog.args.price).to.eql(marketOraclePrice);

    const collateralOraclePriceLog = logs[4];
    expect(collateralOraclePriceLog.name).to.eql('LogOraclePrice');
    expect(collateralOraclePriceLog.args.market).to.eql(collateralMarket);
    expect(collateralOraclePriceLog.args.price).to.eql(collateralOraclePrice);

    const transferLog = logs[5];
    expect(transferLog.name).to.eql('LogTransfer');
    expect(transferLog.args.accountOneOwner).to.eql(owner1);
    expect(transferLog.args.accountOneNumber).to.eql(accountNumber1);
    expect(transferLog.args.accountTwoOwner).to.eql(owner2);
    expect(transferLog.args.accountTwoNumber).to.eql(accountNumber2);
    expect(transferLog.args.market).to.eql(market);
    expect(transferLog.args.updateOne).to.eql({ newPar: par, deltaWei: wei });
    expect(transferLog.args.updateTwo).to.eql({ newPar: negPar, deltaWei: negWei });

    // interest rates are sorted by marketId, asc
    const interestRateLog = logs[6];
    expect(interestRateLog.name).to.eql('LogInterestRate');
    expect(interestRateLog.args.market).to.eql(market);
    expect(interestRateLog.args.rate).to.eql(await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(market));

    const collateralInterestRateLog = logs[7];
    expect(collateralInterestRateLog.name).to.eql('LogInterestRate');
    expect(collateralInterestRateLog.args.market).to.eql(collateralMarket);
    expect(collateralInterestRateLog.args.rate).to.eql(
      await dolomiteMargin.getters.getMarketBorrowInterestRatePerSecond(collateralMarket),
    );
  });

  it('Succeeds for positive delta par/wei', async () => {
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

    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await setAccountBalances(zero, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(par, wei, negPar, negWei);

      // starting negative (>par)
      await setAccountBalances(negPar.times(2), zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(negPar, negWei, negPar, negWei);

      // starting negative (=par)
      await setAccountBalances(negPar, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(zero, zero, negPar, negWei);

      // starting negative (<par)
      await setAccountBalances(negPar.div(2), zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(par.div(2), wei.div(2), negPar, negWei);

      // starting positive
      await setAccountBalances(par, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(par.times(2), wei.times(2), negPar, negWei);
    }
  });

  it('Succeeds for zero delta par/wei', async () => {
    const globs = [
      {
        amount: {
          value: zero,
          denomination: AmountDenomination.Principal,
          reference: AmountReference.Delta,
        },
      },
      {
        amount: {
          value: zero,
          denomination: AmountDenomination.Actual,
          reference: AmountReference.Delta,
        },
      },
    ];

    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await setAccountBalances(zero, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(zero, zero, zero, zero);

      // starting positive
      await setAccountBalances(par, negPar);
      await expectTransferOkay(globs[i]);
      await expectBalances(par, wei, negPar, negWei);

      // starting negative
      await setAccountBalances(negPar, par);
      await expectTransferOkay(globs[i]);
      await expectBalances(negPar, negWei, par, wei);
    }
  });

  it('Succeeds for negative delta par/wei', async () => {
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

    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await setAccountBalances(zero, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(negPar, negWei, par, wei);

      // starting positive (>par)
      await setAccountBalances(par.times(2), zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(par, wei, par, wei);

      // starting positive (=par)
      await setAccountBalances(par, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(zero, zero, par, wei);

      // starting positive (<par)
      await setAccountBalances(par.div(2), zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(negPar.div(2), negWei.div(2), par, wei);

      // starting negative
      await setAccountBalances(negPar, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(negPar.times(2), negWei.times(2), par, wei);
    }
  });

  it('Succeeds for positive target par/wei', async () => {
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

    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await setAccountBalances(zero, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(par, wei, negPar, negWei);

      // starting positive (>par)
      await setAccountBalances(par.times(2), zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(par, wei, par, wei);

      // starting positive (=par)
      await setAccountBalances(par, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(par, wei, zero, zero);

      // starting positive (<par)
      await setAccountBalances(par.div(2), zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(par, wei, negPar.div(2), negWei.div(2));

      // starting negative
      await setAccountBalances(negPar, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(par, wei, negPar.times(2), negWei.times(2));
    }
  });

  it('Succeeds for zero target par/wei', async () => {
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

    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await setAccountBalances(zero, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(zero, zero, zero, zero);

      // starting negative
      await setAccountBalances(negPar, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(zero, zero, negPar, negWei);

      // starting positive
      await setAccountBalances(par, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(zero, zero, par, wei);
    }
  });

  it('Succeeds for negative target par/wei', async () => {
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

    for (let i = 0; i < globs.length; i += 1) {
      // starting from zero
      await setAccountBalances(zero, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(negPar, negWei, par, wei);

      // starting negative (>par)
      await setAccountBalances(negPar.times(2), zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(negPar, negWei, negPar, negWei);

      // starting negative (=par)
      await setAccountBalances(negPar, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(negPar, negWei, zero, zero);

      // starting negative (<par)
      await setAccountBalances(negPar.div(2), zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(negPar, negWei, par.div(2), wei.div(2));

      // starting positive
      await setAccountBalances(par, zero);
      await expectTransferOkay(globs[i]);
      await expectBalances(negPar, negWei, par.times(2), wei.times(2));
    }
  });

  it('Succeeds and sets status to Normal', async () => {
    await Promise.all([
      dolomiteMargin.testing.setAccountStatus(owner1, accountNumber1, AccountStatus.Liquidating),
      dolomiteMargin.testing.setAccountStatus(owner2, accountNumber2, AccountStatus.Liquidating),
    ]);
    await expectTransferOkay({});
    const [status1, status2] = await Promise.all([
      dolomiteMargin.getters.getAccountStatus(owner1, accountNumber1),
      dolomiteMargin.getters.getAccountStatus(owner2, accountNumber2),
    ]);
    expect(status1).to.eql(AccountStatus.Normal);
    expect(status2).to.eql(AccountStatus.Normal);
  });

  it('Succeeds for global operator', async () => {
    await Promise.all([
      dolomiteMargin.permissions.disapproveOperator(operator, { from: owner1 }),
      dolomiteMargin.permissions.disapproveOperator(operator, { from: owner2 }),
      dolomiteMargin.admin.setGlobalOperator(operator, true, { from: admin }),
    ]);
    await expectTransferOkay({});
  });

  it('Succeeds for owner of both accounts', async () => {
    await expectTransferOkay({
      toAccountOwner: owner1,
    });
  });

  it('Succeeds with callback', async () => {
    const shouldRevert = false;
    const shouldRevertWithMessage = false;
    const shouldConsumeTonsOfGas = false;
    const shouldReturnBomb = false;
    const contractWithCallback = await dolomiteMargin.contracts.deployTestCallbackContract(
      accounts[0],
      shouldRevert,
      shouldRevertWithMessage,
      shouldConsumeTonsOfGas,
      shouldReturnBomb,
    );

    await dolomiteMargin.contracts.callContractFunction(contractWithCallback.methods.setLocalOperator(), {
      from: dolomiteMargin.getDefaultAccount(),
    });
    const txResult = await expectTransferOkay(
      {
        toAccountOwner: contractWithCallback.options.address,
        amount: {
          value: negWei,
          denomination: AmountDenomination.Wei,
          reference: AmountReference.Delta,
        }
      },
    );

    const logs = dolomiteMargin.logs.parseLogs(txResult).filter(log => log.name === 'LogExternalCallbackSuccess');
    expect(logs.length).to.eql(1);
    let log = logs[0];
    expect(log.args.primaryAccountOwner).to.eql(contractWithCallback.options.address);
    expect(log.args.primaryAccountNumber).to.eql(accountNumber2);

    const eventLogs = await contractWithCallback.getPastEvents('LogOnInternalBalanceChangeInputs', {
      fromBlock: txResult.blockNumber ?? 'latest',
    });
    expect(eventLogs.length === 1);
    log = dolomiteMargin.logs.parseEventLogWithContract(contractWithCallback, eventLogs[0]);
    expect(log.args.primaryAccountNumber).to.eql(accountNumber2);
    expect(log.args.secondaryAccount).to.eql({ owner: owner1, number: accountNumber1 });
    expect(log.args.primaryMarketId).to.eql(market);
    expect(log.args.primaryDeltaWei).to.eql(wei);
    expect(log.args.secondaryMarketId).to.eql(INTEGERS.ZERO);
    expect(log.args.secondaryDeltaWei).to.eql(INTEGERS.ZERO);
  });

  it('Fails for non-operator on first account', async () => {
    await dolomiteMargin.permissions.disapproveOperator(operator, { from: owner1 });
    await expectTransferRevert(
      {
        amount: {
          value: par,
          denomination: AmountDenomination.Principal,
          reference: AmountReference.Delta,
        },
      },
      'Storage: Unpermissioned operator',
    );
  });

  it('Fails for non-operator on second account', async () => {
    await dolomiteMargin.permissions.disapproveOperator(operator, { from: owner2 });
    await expectTransferRevert(
      {
        amount: {
          value: par,
          denomination: AmountDenomination.Principal,
          reference: AmountReference.Delta,
        },
      },
      'Storage: Unpermissioned operator',
    );
  });

  it('Fails to transfer to same account', async () => {
    await expectTransferRevert(
      {
        toAccountOwner: owner1,
        toAccountId: accountNumber1,
      },
      'OperationImpl: Duplicate accounts in action',
    );
  });
});

// ============ Helper Functions ============

async function setAccountBalances(amount1: BigNumber, amount2: BigNumber) {
  await Promise.all([
    dolomiteMargin.testing.setAccountBalance(owner1, accountNumber1, market, amount1),
    dolomiteMargin.testing.setAccountBalance(owner2, accountNumber2, market, amount2),
  ]);
}

async function expectBalances(par1: Integer, wei1: Integer, par2: Integer, wei2: Integer) {
  const [accountBalances1, accountBalances2] = await Promise.all([
    dolomiteMargin.getters.getAccountBalances(owner1, accountNumber1),
    dolomiteMargin.getters.getAccountBalances(owner2, accountNumber2),
  ]);
  accountBalances1.forEach(balance => {
    let expected = { par: zero, wei: zero };
    if (balance.marketId.eq(market)) {
      expected = { par: par1, wei: wei1 };
    } else if (balance.marketId.eq(collateralMarket)) {
      expected = { par: collateralAmount, wei: collateralAmount };
    }
    expect(balance.par).to.eql(expected.par);
    expect(balance.wei).to.eql(expected.wei);
  });
  accountBalances2.forEach(balance => {
    let expected = { par: zero, wei: zero };
    if (balance.marketId.eq(market)) {
      expected = { par: par2, wei: wei2 };
    } else if (balance.marketId.eq(collateralMarket)) {
      expected = { par: collateralAmount, wei: collateralAmount };
    }
    expect(balance.par).to.eql(expected.par);
    expect(balance.wei).to.eql(expected.wei);
  });
}

async function expectTransferOkay(glob: Object, options?: Object) {
  const combinedGlob = { ...defaultGlob, ...glob };
  return dolomiteMargin.operation.initiate().transfer(combinedGlob).commit(options);
}

async function expectTransferRevert(glob: Object, reason?: string, options?: Object) {
  await expectThrow(expectTransferOkay(glob, options), reason);
}
