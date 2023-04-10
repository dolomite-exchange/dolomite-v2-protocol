import BigNumber from 'bignumber.js';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { resetEVM, snapshot } from '../helpers/EVM';
import { address, ADDRESSES, INTEGERS } from '../../src';
import {
  getInterestPerSecondForAAVECopyCat, stringToDecimal,
} from '../../src/lib/Helpers';

let dolomiteMargin: TestDolomiteMargin;
let owner: address;
let admin: address;
const accountNumber1 = new BigNumber(111);
const accountNumber2 = new BigNumber(222);
const zero = new BigNumber(0);
const par = new BigNumber(10000);
const negPar = par.times(-1);
const defaultPrice = new BigNumber(10000);
const maximumRate = stringToDecimal('31709791983');
const defaultIsClosing = false;
const defaultIsRecyclable = false;
const isStableCoin = false;

describe('AAVECopyCatAltCoinInterestSetter', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    owner = dolomiteMargin.getDefaultAccount();
    admin = r.accounts[0];
    await resetEVM();
    await dolomiteMargin.testing.priceOracle.setPrice(
      dolomiteMargin.testing.tokenA.address,
      defaultPrice,
    );
    await dolomiteMargin.admin.addMarket(
      dolomiteMargin.testing.tokenA.address,
      dolomiteMargin.testing.priceOracle.address,
      dolomiteMargin.contracts.aaveCopyCatAltCoinInterestSetter.options.address,
      zero,
      zero,
      zero,
      defaultIsClosing,
      defaultIsRecyclable,
      { from: admin },
    );
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  it('Succeeds for 0/0', async () => {
    const rate = await dolomiteMargin.getters.getMarketBorrowInterestRate(zero);
    expect(rate).to.eql(zero);
  });

  it('Succeeds for 0/100', async () => {
    await dolomiteMargin.testing.setAccountBalance(owner, accountNumber1, zero, par);
    const rate = await dolomiteMargin.getters.getMarketBorrowInterestRate(zero);
    expect(rate).to.eql(zero);
  });

  it('Succeeds for 100/0', async () => {
    await dolomiteMargin.testing.setAccountBalance(owner, accountNumber1, zero, negPar);
    const rate = await dolomiteMargin.getters.getMarketBorrowInterestRate(zero);
    expect(rate).to.eql(maximumRate);
  });

  it('Succeeds for 100/100', async () => {
    await Promise.all([
      dolomiteMargin.testing.setAccountBalance(owner, accountNumber1, zero, par),
      dolomiteMargin.testing.setAccountBalance(owner, accountNumber2, zero, negPar),
    ]);
    const rate = await dolomiteMargin.getters.getMarketBorrowInterestRate(zero);
    expect(rate).to.eql(maximumRate);
  });

  it('Succeeds for 200/100', async () => {
    await Promise.all([
      dolomiteMargin.testing.setAccountBalance(owner, accountNumber1, zero, par),
      dolomiteMargin.testing.setAccountBalance(
        owner,
        accountNumber2,
        zero,
        negPar.times(2),
      ),
    ]);
    const rate = await dolomiteMargin.getters.getMarketBorrowInterestRate(zero);
    expect(rate).to.eql(maximumRate);
  });

  it('Succeeds for 50/100', async () => {
    await Promise.all([
      dolomiteMargin.testing.setAccountBalance(owner, accountNumber1, zero, par),
      dolomiteMargin.testing.setAccountBalance(
        owner,
        accountNumber2,
        zero,
        negPar.div(2),
      ),
    ]);
    const rate = await dolomiteMargin.getters.getMarketBorrowInterestRate(zero);
    expect(rate).to.eql(
      getInterestPerSecondForAAVECopyCat(
        isStableCoin,
        { totalBorrowed: par.div(2), totalSupply: par },
      ),
    );
  });

  it('Succeeds for 100% (javscript)', async () => {
    const res1 = getInterestPerSecondForAAVECopyCat(
      isStableCoin,
      { totalBorrowed: par, totalSupply: par },
    );
    const res2 = getInterestPerSecondForAAVECopyCat(
      isStableCoin,
      { totalBorrowed: par.times(2), totalSupply: par },
    );
    expect(maximumRate).to.eql(res1);
    expect(maximumRate).to.eql(res2);
  });

  it('Succeeds for 0-90% (javscript)', async () => {
    const res1 = getInterestPerSecondForAAVECopyCat(
      isStableCoin,
      { totalBorrowed: INTEGERS.ZERO, totalSupply: par },
    );
    const res2 = getInterestPerSecondForAAVECopyCat(
      isStableCoin,
      { totalBorrowed: par.times(0.45), totalSupply: par },
    );
    const res3 = getInterestPerSecondForAAVECopyCat(
      isStableCoin,
      { totalBorrowed: par.times(0.9), totalSupply: par },
    );
    expect(INTEGERS.ZERO).to.eql(res1);
    expect(stringToDecimal('1109842719')).to.eql(res2); // 3.5% divided by 1-year
    expect(stringToDecimal('2219685438')).to.eql(res3); // 7% divided by 1-year
  });

  it('Succeeds for 91-100% (javscript)', async () => {
    const res1 = getInterestPerSecondForAAVECopyCat(
      isStableCoin,
      { totalBorrowed: par.times(0.91), totalSupply: par },
    );
    const res2 = getInterestPerSecondForAAVECopyCat(
      isStableCoin,
      { totalBorrowed: par.times(0.99), totalSupply: par },
    );
    expect(stringToDecimal('5168696093')).to.eql(res1); // 16.3% divided by 1-year
    expect(stringToDecimal('28760781329')).to.eql(res2); // 90.7% divided by 1-year
  });

  it('Succeeds for gas', async () => {
    const baseGasCost = 21000;
    const getRateFunction = dolomiteMargin.contracts.aaveCopyCatAltCoinInterestSetter.methods.getInterestRate;
    const totalCosts = await Promise.all([
      await getRateFunction(ADDRESSES.ZERO, '0', '0').estimateGas(),
      await getRateFunction(ADDRESSES.ZERO, '1', '1').estimateGas(),
      await getRateFunction(ADDRESSES.ZERO, '1', '2').estimateGas(),
    ]);
    const costs = totalCosts.map(x => x - baseGasCost);
    console.log(
      `\tInterest calculation gas used: ${costs[0]}, ${costs[1]}, ${costs[2]}`,
    );
  });

  it('Succeeds for bunch of utilization numbers', async () => {
    for (let i = 0; i <= 100; i += 5) {
      const utilization = new BigNumber(i).div(100);
      await Promise.all([
        dolomiteMargin.testing.setAccountBalance(owner, accountNumber1, zero, par),
        dolomiteMargin.testing.setAccountBalance(
          owner,
          accountNumber2,
          zero,
          negPar.times(utilization),
        ),
      ]);
      const rate = await dolomiteMargin.getters.getMarketBorrowInterestRate(zero);
      expect(rate).to.eql(
        getInterestPerSecondForAAVECopyCat(
          isStableCoin,
          {
            totalBorrowed: par.times(utilization),
            totalSupply: par,
          },
        ),
      );
    }
  });
});
