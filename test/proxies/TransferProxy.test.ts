import BigNumber from 'bignumber.js';
import { address, Integer, INTEGERS } from '../../src';
import { expectThrow, expectThrowUnauthorizedBase } from '../helpers/Expect';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { setupMarkets } from '../helpers/DolomiteMarginHelpers';
import { resetEVM, snapshot } from '../helpers/EVM';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';

let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
let snapshotId: string;
let admin: address;
let owner1: address;
let owner2: address;

const market1 = INTEGERS.ZERO;
const market2 = INTEGERS.ONE;
const zero = new BigNumber(0);
const par1 = new BigNumber(100);
const par2 = new BigNumber(500);
const defaultIsClosing = false;

const SECONDARY_REVERT_REASON = 'TransferProxy: invalid params length';

let token1: address;
let token2: address;

describe('TransferProxy', () => {
  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    owner1 = dolomiteMargin.getDefaultAccount();
    owner2 = accounts[3];

    await resetEVM();
    await Promise.all([
      setupMarkets(dolomiteMargin, accounts),
      dolomiteMargin.testing.priceOracle.setPrice(
        dolomiteMargin.payableToken.address,
        new BigNumber('1e40'),
      ),
      dolomiteMargin.admin.setGlobalOperator(admin, true, { from: admin }),
    ]);
    await dolomiteMargin.admin.addMarket(
      dolomiteMargin.payableToken.address,
      dolomiteMargin.testing.priceOracle.address,
      dolomiteMargin.testing.interestSetter.address,
      zero,
      zero,
      zero,
      zero,
      zero,
      defaultIsClosing,
      { from: admin },
    );
    await dolomiteMargin.testing.setAccountBalance(owner1, INTEGERS.ZERO, market1, par1);
    await dolomiteMargin.testing.setAccountBalance(owner1, INTEGERS.ZERO, market2, par2);
    token1 = await dolomiteMargin.getters.getMarketTokenAddress(market1);
    token2 = await dolomiteMargin.getters.getMarketTokenAddress(market2);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('#setIsCallerTrusted', () => {
    it('success case', async () => {
      expect(await dolomiteMargin.transferProxy.isCallerAuthorized(owner1)).to.eql(false);

      await dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, true, { from: admin });
      expect(await dolomiteMargin.transferProxy.isCallerAuthorized(owner1)).to.eql(true);

      await dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, false, { from: admin });
      expect(await dolomiteMargin.transferProxy.isCallerAuthorized(owner1)).to.eql(false);
    });

    it('failure case', async () => {
      await expectThrowUnauthorizedBase(
        dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, true, { from: owner1 }),
        owner1,
      );
      expect(await dolomiteMargin.transferProxy.isCallerAuthorized(owner1)).to.eql(false);
    });
  });

  describe('#transfer', () => {
    it('should work normally', async () => {
      await dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, true, { from: admin });

      await expectBalances(owner1, market1, par1);
      await expectBalances(owner2, market1, INTEGERS.ZERO);

      await dolomiteMargin.transferProxy.transfer(
        INTEGERS.ZERO,
        owner2,
        INTEGERS.ZERO,
        token1,
        par1,
        { from: owner1 },
      );

      await expectBalances(owner1, market1, INTEGERS.ZERO);
      await expectBalances(owner2, market1, par1);
    });

    it('should work when amount is set to transfer all', async () => {
      await dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, true, { from: admin });

      await expectBalances(owner1, market1, par1);
      await expectBalances(owner2, market1, INTEGERS.ZERO);

      await dolomiteMargin.transferProxy.transfer(
        INTEGERS.ZERO,
        owner2,
        INTEGERS.ZERO,
        token1,
        INTEGERS.MAX_UINT,
        { from: owner1 },
      );

      await expectBalances(owner1, market1, INTEGERS.ZERO);
      await expectBalances(owner2, market1, par1);
    });

    it('should fail if caller is not authorized', async () => {
      expect(await dolomiteMargin.transferProxy.isCallerAuthorized(owner1)).to.eql(false);
      await expectThrowUnauthorizedBase(
        dolomiteMargin.transferProxy.transfer(
          INTEGERS.ZERO,
          owner2,
          INTEGERS.ZERO,
          token1,
          INTEGERS.MAX_UINT,
          { from: owner1 },
        ),
        owner1,
      );
    });
  });

  describe('#transferMultiple', () => {
    it('success case with send 1', async () => {
      await dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, true, { from: admin });

      await expectBalances(owner1, market1, par1);
      await expectBalances(owner2, market1, INTEGERS.ZERO);

      await dolomiteMargin.transferProxy.transferMultiple(
        INTEGERS.ZERO,
        owner2,
        INTEGERS.ZERO,
        [token1],
        [par1],
        { from: owner1 },
      );

      await expectBalances(owner1, market1, INTEGERS.ZERO);
      await expectBalances(owner2, market1, par1);
    });

    it('success case with send multiple', async () => {
      await dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, true, { from: admin });

      await expectBalances(owner1, market1, par1);
      await expectBalances(owner1, market2, par2);
      await expectBalances(owner2, market1, INTEGERS.ZERO);
      await expectBalances(owner2, market2, INTEGERS.ZERO);

      await dolomiteMargin.transferProxy.transferMultiple(
        INTEGERS.ZERO,
        owner2,
        INTEGERS.ZERO,
        [token1, token2],
        [par1, par2],
        { from: owner1 },
      );

      await expectBalances(owner1, market1, INTEGERS.ZERO);
      await expectBalances(owner1, market2, INTEGERS.ZERO);
      await expectBalances(owner2, market1, par1);
      await expectBalances(owner2, market2, par2);
    });

    it('failure case unauthorized', async () => {
      await expectThrowUnauthorizedBase(
        dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, true, { from: owner1 }),
        owner1,
      );
      expect(await dolomiteMargin.transferProxy.isCallerAuthorized(owner1)).to.eql(false);
    });

    it('failure case malformed params', async () => {
      await dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, true, { from: admin });

      await expectBalances(owner1, market1, par1);
      await expectBalances(owner1, market2, par2);
      await expectBalances(owner2, market1, INTEGERS.ZERO);
      await expectBalances(owner2, market2, INTEGERS.ZERO);

      await expectThrow(
        dolomiteMargin.transferProxy.transferMultiple(
          INTEGERS.ZERO,
          owner2,
          INTEGERS.ZERO,
          [token1, token2],
          [par1],
          { from: owner1 },
        ),
        SECONDARY_REVERT_REASON
      );
    });
  });

  describe('#transferMultipleWithMarkets', () => {
    it('success case with send 1', async () => {
      await dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, true, { from: admin });

      await expectBalances(owner1, market1, par1);
      await expectBalances(owner2, market1, INTEGERS.ZERO);

      await dolomiteMargin.transferProxy.transferMultipleWithMarkets(
        INTEGERS.ZERO,
        owner2,
        INTEGERS.ZERO,
        [market1],
        [par1],
        { from: owner1 },
      );

      await expectBalances(owner1, market1, INTEGERS.ZERO);
      await expectBalances(owner2, market1, par1);
    });

    it('success case with send multiple', async () => {
      await dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, true, { from: admin });

      await expectBalances(owner1, market1, par1);
      await expectBalances(owner1, market2, par2);
      await expectBalances(owner2, market1, INTEGERS.ZERO);
      await expectBalances(owner2, market2, INTEGERS.ZERO);

      await dolomiteMargin.transferProxy.transferMultipleWithMarkets(
        INTEGERS.ZERO,
        owner2,
        INTEGERS.ZERO,
        [market1, market2],
        [par1, par2],
        { from: owner1 },
      );

      await expectBalances(owner1, market1, INTEGERS.ZERO);
      await expectBalances(owner1, market2, INTEGERS.ZERO);
      await expectBalances(owner2, market1, par1);
      await expectBalances(owner2, market2, par2);
    });

    it('failure case unauthorized', async () => {
      expect(await dolomiteMargin.transferProxy.isCallerAuthorized(owner1)).to.eql(false);
      await expectThrowUnauthorizedBase(
        dolomiteMargin.transferProxy.transferMultipleWithMarkets(
          INTEGERS.ZERO,
          owner2,
          INTEGERS.ZERO,
          [market1, market2],
          [par1, par2],
          { from: owner1 },
        ),
        owner1,
      );
    });

    it('failure case malformed params', async () => {
      await dolomiteMargin.transferProxy.setIsCallerAuthorized(owner1, true, { from: admin });

      await expectBalances(owner1, market1, par1);
      await expectBalances(owner1, market2, par2);
      await expectBalances(owner2, market1, INTEGERS.ZERO);
      await expectBalances(owner2, market2, INTEGERS.ZERO);

      await expectThrow(
        dolomiteMargin.transferProxy.transferMultipleWithMarkets(
          INTEGERS.ZERO,
          owner2,
          INTEGERS.ZERO,
          [market1, market2],
          [par1],
          { from: owner1 },
        ),
        SECONDARY_REVERT_REASON
      );
    });
  });
});

// =============== Helper Functions

async function expectBalances(
  owner: address,
  market: Integer,
  amount: Integer,
): Promise<void> {
  const balance = await dolomiteMargin.getters.getAccountWei(owner, INTEGERS.ZERO, market);
  expect(balance).to.eql(amount);
}
