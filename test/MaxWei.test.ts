import BigNumber from 'bignumber.js';
import { getDolomiteMargin } from './helpers/DolomiteMargin';
import { TestDolomiteMargin } from './modules/TestDolomiteMargin';
import { resetEVM, snapshot } from './helpers/EVM';
import { setupMarkets } from './helpers/DolomiteMarginHelpers';
import { expectThrow } from './helpers/Expect';
import { address, AmountDenomination, AmountReference, INTEGERS } from '../src';

let owner: address;
let admin: address;
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
const accountOne = new BigNumber(111);
const accountTwo = new BigNumber(222);
const market = INTEGERS.ZERO;
const collateralMarket = new BigNumber(1);
const amount = new BigNumber(100);

describe('MaxWei', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    owner = dolomiteMargin.getDefaultAccount();

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);
    await Promise.all([
      dolomiteMargin.testing.setAccountBalance(
        owner,
        accountOne,
        market,
        amount.times(2),
      ),
      dolomiteMargin.testing.setAccountBalance(
        owner,
        accountTwo,
        market,
        amount.times(2),
      ),
      dolomiteMargin.testing.setAccountBalance(
        owner,
        accountOne,
        collateralMarket,
        amount.times(10),
      ),
      dolomiteMargin.testing.setAccountBalance(
        owner,
        accountTwo,
        collateralMarket,
        amount.times(10),
      ),
      dolomiteMargin.testing.tokenA.issueTo(
        amount.times('10'),
        dolomiteMargin.address,
      ),
      dolomiteMargin.testing.tokenA.issueTo(
        amount.times('10'),
        owner,
      ),
      dolomiteMargin.testing.tokenA.setMaximumDolomiteMarginAllowance(owner),
    ]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('MaxSupplyWei', () => {
    it('Succeeds for withdraw when under max supply wei', async () => {
      await dolomiteMargin.admin.setMaxSupplyWei(market, amount.times('4'), { from: admin });

      await dolomiteMargin.operation
        .initiate()
        .withdraw({
          primaryAccountOwner: owner,
          primaryAccountId: accountOne,
          marketId: market,
          to: owner,
          amount: {
            value: amount.times(-1),
            denomination: AmountDenomination.Actual,
            reference: AmountReference.Delta,
          },
        })
        .commit();
    });

    it('Succeeds for withdraw when over max supply wei', async () => {
      await dolomiteMargin.admin.setMaxSupplyWei(market, amount.times('0.01'), { from: admin });

      await dolomiteMargin.operation
        .initiate()
        .withdraw({
          primaryAccountOwner: owner,
          primaryAccountId: accountOne,
          marketId: market,
          to: owner,
          amount: {
            value: amount.times(-1),
            denomination: AmountDenomination.Actual,
            reference: AmountReference.Delta,
          },
        })
        .commit();
    });

    it('Succeeds for deposit when under max supply wei', async () => {
      await dolomiteMargin.admin.setMaxSupplyWei(market, amount.times('5'), { from: admin });

      await dolomiteMargin.operation
        .initiate()
        .deposit({
          primaryAccountOwner: owner,
          primaryAccountId: accountOne,
          marketId: market,
          from: owner,
          amount: {
            value: amount.times(1),
            denomination: AmountDenomination.Actual,
            reference: AmountReference.Delta,
          },
        })
        .commit();
    });

    it('Fails for deposit when currently over max supply wei', async () => {
      await dolomiteMargin.admin.setMaxSupplyWei(market, amount.times('2'), { from: admin });

      await expectThrow(
        dolomiteMargin.operation
          .initiate()
          .deposit({
            primaryAccountOwner: owner,
            primaryAccountId: accountTwo,
            marketId: market,
            from: owner,
            amount: {
              value: amount.times(1),
              denomination: AmountDenomination.Actual,
              reference: AmountReference.Delta,
            },
          })
          .commit(),
        `OperationImpl: Total supply exceeds max supply <${market.toFixed(0)}>`,
      );
    });

    it('Fails for deposit that pushes over max supply wei', async () => {
      await dolomiteMargin.admin.setMaxSupplyWei(market, amount.times('5'), { from: admin });

      await expectThrow(
        dolomiteMargin.operation
          .initiate()
          .deposit({
            primaryAccountOwner: owner,
            primaryAccountId: accountTwo,
            marketId: market,
            from: owner,
            amount: {
              value: amount.times(2),
              denomination: AmountDenomination.Actual,
              reference: AmountReference.Delta,
            },
          })
          .commit(),
        `OperationImpl: Total supply exceeds max supply <${market.toFixed(0)}>`,
      );
    });
  });

  describe('MaxBorrowWei', () => {
    it('Succeeds for withdraw when under max borrow wei', async () => {
      await dolomiteMargin.admin.setMaxBorrowWei(market, amount.times('4'), { from: admin });

      await dolomiteMargin.operation
        .initiate()
        .withdraw({
          primaryAccountOwner: owner,
          primaryAccountId: accountOne,
          marketId: market,
          to: owner,
          amount: {
            value: amount.times(-3),
            denomination: AmountDenomination.Actual,
            reference: AmountReference.Delta,
          },
        })
        .commit();

      expect(await dolomiteMargin.getters.getAccountWei(owner, accountOne, market)).to.eql(amount.times(-1));
    });

    it('Succeeds for deposit into negative account when over max borrow wei', async () => {
      await dolomiteMargin.operation
        .initiate()
        .withdraw({
          primaryAccountOwner: owner,
          primaryAccountId: accountOne,
          marketId: market,
          to: owner,
          amount: {
            value: amount.times(-3),
            denomination: AmountDenomination.Actual,
            reference: AmountReference.Delta,
          },
        })
        .commit();

      await dolomiteMargin.admin.setMaxBorrowWei(market, amount.times('0.01'), { from: admin });

      await dolomiteMargin.operation
        .initiate()
        .deposit({
          primaryAccountOwner: owner,
          primaryAccountId: accountOne,
          marketId: market,
          from: owner,
          amount: {
            value: amount.times('0.1'),
            denomination: AmountDenomination.Actual,
            reference: AmountReference.Delta,
          },
        })
        .commit();

      const totalWei = await dolomiteMargin.getters.getMarketTotalWei(market);
      expect(totalWei.borrow).to.eql(amount.minus(amount.times('0.1')));
    });

    it('Succeeds for deposit when under max borrow wei', async () => {
      await dolomiteMargin.operation
        .initiate()
        .withdraw({
          primaryAccountOwner: owner,
          primaryAccountId: accountOne,
          marketId: market,
          to: owner,
          amount: {
            value: amount.times('-3'),
            denomination: AmountDenomination.Actual,
            reference: AmountReference.Delta,
          },
        })
        .commit();

      await dolomiteMargin.admin.setMaxBorrowWei(market, amount.times('5'), { from: admin });

      await dolomiteMargin.operation
        .initiate()
        .deposit({
          primaryAccountOwner: owner,
          primaryAccountId: accountOne,
          marketId: market,
          from: owner,
          amount: {
            value: amount.times('0.1'),
            denomination: AmountDenomination.Actual,
            reference: AmountReference.Delta,
          },
        })
        .commit();

      const balanceWei = await dolomiteMargin.getters.getAccountWei(owner, accountOne, market);
      expect(balanceWei).to.eql(amount.times(-1).plus(amount.times('0.1')));
    });

    it('Fails for withdraw when currently over max borrow wei', async () => {
      await dolomiteMargin.operation
        .initiate()
        .withdraw({
          primaryAccountOwner: owner,
          primaryAccountId: accountTwo,
          marketId: market,
          to: owner,
          amount: {
            value: amount.times(-3),
            denomination: AmountDenomination.Actual,
            reference: AmountReference.Delta,
          },
        })
        .commit();

      await dolomiteMargin.admin.setMaxBorrowWei(market, amount.times(1), { from: admin });
      expect((await dolomiteMargin.getters.getMarketTotalWei(market)).borrow).to.eql(amount);

      await expectThrow(
        dolomiteMargin.operation
          .initiate()
          .withdraw({
            primaryAccountOwner: owner,
            primaryAccountId: accountTwo,
            marketId: market,
            to: owner,
            amount: {
              value: amount.times(-0.1),
              denomination: AmountDenomination.Actual,
              reference: AmountReference.Delta,
            },
          })
          .commit(),
        `OperationImpl: Total borrow exceeds max borrow <${market.toFixed(0)}>`,
      );
    });

    it('Fails with market is closing if closed and max borrow wei is exceeded', async () => {
      await dolomiteMargin.admin.setIsClosing(market, true, { from: admin });
      await dolomiteMargin.admin.setMaxBorrowWei(market, amount.times('0.1'), { from: admin });

      await expectThrow(
        dolomiteMargin.operation
          .initiate()
          .withdraw({
            primaryAccountOwner: owner,
            primaryAccountId: accountTwo,
            marketId: market,
            to: owner,
            amount: {
              value: amount.times(-3),
              denomination: AmountDenomination.Actual,
              reference: AmountReference.Delta,
            },
          })
          .commit(),
        `OperationImpl: Market is closing <${market.toFixed(0)}>`,
      );
    });
  });
});
