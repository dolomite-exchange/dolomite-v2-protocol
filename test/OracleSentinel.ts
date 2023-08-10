import BigNumber from 'bignumber.js';
import { address, BalanceCheckFlag, INTEGERS } from '../src';
import { getDolomiteMargin } from './helpers/DolomiteMargin';
import { setupMarkets } from './helpers/DolomiteMarginHelpers';
import { resetEVM, snapshot } from './helpers/EVM';
import { expectThrow } from './helpers/Expect';
import { TestDolomiteMargin } from './modules/TestDolomiteMargin';
import { OracleSentinel } from '../src/modules/OracleSentinel';

let owner: address;
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
const accountNumber1 = new BigNumber(111);
const accountNumber2 = new BigNumber(222);
const market = INTEGERS.ZERO;
const collateralMarket = new BigNumber(1);
const amount = new BigNumber(100);

describe('OracleSentinel', () => {
  let snapshotId: string;
  let oracleSentinel: OracleSentinel;
  let alwaysOnlineOracleSentinel: OracleSentinel;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    owner = dolomiteMargin.getDefaultAccount();

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);
    await Promise.all([
      dolomiteMargin.testing.setAccountBalance(owner, accountNumber1, market, amount.times(2)),
      dolomiteMargin.testing.setAccountBalance(owner, accountNumber2, market, amount.times(2)),
      dolomiteMargin.testing.setAccountBalance(owner, accountNumber1, collateralMarket, amount.times(10)),
      dolomiteMargin.testing.setAccountBalance(owner, accountNumber2, collateralMarket, amount.times(10)),
      dolomiteMargin.testing.tokenA.issueTo(amount.times('10'), dolomiteMargin.address),
      dolomiteMargin.testing.tokenA.issueTo(amount.times('10'), owner),
      dolomiteMargin.testing.tokenA.setMaximumDolomiteMarginAllowance(owner),
    ]);

    oracleSentinel = await dolomiteMargin.getters.getOracleSentinel();
    expect(oracleSentinel.address).to.eql(dolomiteMargin.contracts.chainlinkOracleSentinel.options.address);

    alwaysOnlineOracleSentinel = new OracleSentinel(dolomiteMargin.contracts, dolomiteMargin.contracts.alwaysOnlineOracleSentinel.options.address);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('#isBorrowAllowed', () => {
    it('Should return true when the sequencer is online', async () => {
      await dolomiteMargin.testing.chainlinkFlags.setShouldReturnOffline(false);

      expect(await dolomiteMargin.getters.getIsBorrowAllowed()).to.eql(true);
      expect(await alwaysOnlineOracleSentinel.isBorrowAllowed()).to.eql(true);
      expect(await oracleSentinel.isBorrowAllowed()).to.eql(true);
    });

    it('Should return false when the sequencer is online', async () => {
      await dolomiteMargin.testing.chainlinkFlags.setShouldReturnOffline(true);

      expect(await dolomiteMargin.getters.getIsBorrowAllowed()).to.eql(false);
      expect(await alwaysOnlineOracleSentinel.isBorrowAllowed()).to.eql(true);
      expect(await oracleSentinel.isBorrowAllowed()).to.eql(false);
    });
  });

  describe('#isLiquidationAllowed', () => {
    it('Should return true when the sequencer is online', async () => {
      await dolomiteMargin.testing.chainlinkFlags.setShouldReturnOffline(false);

      expect(await dolomiteMargin.getters.getIsLiquidationAllowed()).to.eql(true);
      expect(await alwaysOnlineOracleSentinel.isLiquidationAllowed()).to.eql(true);
      expect(await oracleSentinel.isLiquidationAllowed()).to.eql(true);
    });

    it('Should return false when the sequencer is online', async () => {
      await dolomiteMargin.testing.chainlinkFlags.setShouldReturnOffline(true);

      expect(await dolomiteMargin.getters.getIsLiquidationAllowed()).to.eql(false);
      expect(await alwaysOnlineOracleSentinel.isLiquidationAllowed()).to.eql(true);
      expect(await oracleSentinel.isLiquidationAllowed()).to.eql(false);
    });
  });

  describe('#gracePeriodDuration', () => {
    it('Should return true when the sequencer is online', async () => {
      await dolomiteMargin.testing.chainlinkFlags.setShouldReturnOffline(false);

      expect(await dolomiteMargin.getters.getIsLiquidationAllowed()).to.eql(true);
      expect(await alwaysOnlineOracleSentinel.isLiquidationAllowed()).to.eql(true);
      expect(await oracleSentinel.isLiquidationAllowed()).to.eql(true);
    });

    it('Should return false when the sequencer is online', async () => {
      await dolomiteMargin.testing.chainlinkFlags.setShouldReturnOffline(true);

      expect(await dolomiteMargin.getters.getIsLiquidationAllowed()).to.eql(false);
      expect(await alwaysOnlineOracleSentinel.isLiquidationAllowed()).to.eql(true);
      expect(await oracleSentinel.isLiquidationAllowed()).to.eql(false);
    });
  });

  describe('#borrows', () => {
    it('should succeed when borrowing is disabled but borrow is not touched', async () => {
      await dolomiteMargin.testing.chainlinkFlags.setShouldReturnOffline(true);
      await dolomiteMargin.testing.setAccountBalance(accounts[1], accountNumber2, collateralMarket, amount);
      await dolomiteMargin.testing.setAccountBalance(accounts[1], accountNumber2, market, amount.times('-0.01'));

      expect(await dolomiteMargin.getters.getIsBorrowAllowed()).to.eql(false);
      await dolomiteMargin.testing.tokenB.issueTo(amount, dolomiteMargin.address);
      await dolomiteMargin.depositWithdrawalProxy.withdrawWei(
        accountNumber2,
        collateralMarket,
        amount.div('2'),
        BalanceCheckFlag.None,
        { from: accounts[1] },
      );

      const accountWei = await dolomiteMargin.getters.getAccountWei(accounts[1], accountNumber2, collateralMarket);
      expect(accountWei).to.eql(amount.div('2'));
      expect(await dolomiteMargin.getters.getAccountWei(accounts[1], accountNumber2, market)).to.eql(
        amount.times('-0.01'),
      );
    });

    it('should succeed when borrowing is disabled but borrow is repaid', async () => {
      await dolomiteMargin.testing.chainlinkFlags.setShouldReturnOffline(true);
      await dolomiteMargin.testing.setAccountBalance(accounts[1], accountNumber2, collateralMarket, amount);
      await dolomiteMargin.testing.setAccountBalance(accounts[1], accountNumber2, market, amount.times('-0.01'));

      expect(await dolomiteMargin.getters.getIsBorrowAllowed()).to.eql(false);
      await dolomiteMargin.testing.tokenB.issueTo(amount, accounts[1]);
      await dolomiteMargin.testing.tokenB.approve(dolomiteMargin.address, amount, { from: accounts[1] });
      await dolomiteMargin.depositWithdrawalProxy.depositWei(accountNumber2, market, amount.div('2'), {
        from: accounts[1],
      });

      expect(await dolomiteMargin.getters.getAccountWei(accounts[1], accountNumber2, collateralMarket)).to.eql(amount);
      const accountWei = await dolomiteMargin.getters.getAccountWei(accounts[1], accountNumber2, market);
      expect(accountWei).to.eql(amount.div('2').minus(amount.times('0.01')));
    });

    it('should fail when borrowing is disabled', async () => {
      await dolomiteMargin.testing.chainlinkFlags.setShouldReturnOffline(true);
      expect(await dolomiteMargin.getters.getIsBorrowAllowed()).to.eql(false);
      await dolomiteMargin.testing.setAccountBalance(accounts[1], accountNumber2, collateralMarket, amount);
      await dolomiteMargin.testing.setAccountBalance(accounts[1], accountNumber2, market, INTEGERS.ZERO);

      await expectThrow(
        dolomiteMargin.depositWithdrawalProxy.withdrawWei(
          accountNumber2,
          market,
          amount.times('0.5'),
          BalanceCheckFlag.None,
          { from: accounts[1] },
        ),
        'OperationImpl: Borrowing is currently disabled',
      );
    });

    it('should fail when borrowing is disabled and borrow size increased', async () => {
      await dolomiteMargin.testing.chainlinkFlags.setShouldReturnOffline(true);
      expect(await dolomiteMargin.getters.getIsBorrowAllowed()).to.eql(false);
      await dolomiteMargin.testing.setAccountBalance(accounts[1], accountNumber2, collateralMarket, amount);
      await dolomiteMargin.testing.setAccountBalance(accounts[1], accountNumber2, market, new BigNumber('-1'));

      await expectThrow(
        dolomiteMargin.depositWithdrawalProxy.withdrawWei(
          accountNumber2,
          market,
          amount.times('0.5'),
          BalanceCheckFlag.None,
          { from: accounts[1] },
        ),
        'OperationImpl: Borrowing is currently disabled',
      );
    });
  });

  describe('#liquidation', () => {
    it('should fail when liquidations are disabled', async () => {
      await dolomiteMargin.testing.chainlinkFlags.setShouldReturnOffline(true);
      expect(await dolomiteMargin.getters.getIsLiquidationAllowed()).to.eql(false);
      await dolomiteMargin.testing.setAccountBalance(accounts[0], accountNumber1, collateralMarket, amount.times(2));
      await dolomiteMargin.testing.setAccountBalance(accounts[0], accountNumber1, market, amount.times(2));
      await dolomiteMargin.testing.setAccountBalance(accounts[1], accountNumber2, collateralMarket, amount);
      await dolomiteMargin.testing.setAccountBalance(accounts[1], accountNumber2, market, amount.div('-1.1'));

      expect(await dolomiteMargin.getters.isAccountLiquidatable(accounts[1], accountNumber2)).to.eql(true);
      await expectThrow(
        dolomiteMargin.liquidatorProxyV1.liquidate(
          accounts[0],
          accountNumber1,
          accounts[1],
          accountNumber2,
          new BigNumber('0.15'),
          INTEGERS.ZERO,
          [market],
          [collateralMarket],
          { from: accounts[0] },
        ),
        'LiquidateOrVaporizeImpl: Liquidations are disabled',
      );
    });
  });
});
