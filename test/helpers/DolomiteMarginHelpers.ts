import BigNumber from 'bignumber.js';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { address, ADDRESSES, INTEGERS } from '../../src';
import { mineAvgBlock } from './EVM';

export async function setGlobalOperator(
  dolomiteMargin: TestDolomiteMargin,
  accounts: address[],
  operator: string,
): Promise<void> {
  return dolomiteMargin.admin
    .setGlobalOperator(operator, true, { from: accounts[0] })
    .then(() => undefined);
}

export async function setupMarkets(
  dolomiteMargin: TestDolomiteMargin,
  accounts: address[],
  numMarkets: number = 3,
): Promise<void> {
  const priceOracle = dolomiteMargin.testing.priceOracle.address;
  const interestSetter = dolomiteMargin.testing.interestSetter.address;
  const price = new BigNumber('1e40'); // large to prevent hitting minBorrowValue check
  const marginPremium = INTEGERS.ZERO;
  const liquidationSpreadPremium = INTEGERS.ZERO;
  const maxSupplyWei = INTEGERS.ZERO;
  const maxBorrowWei = INTEGERS.ZERO;
  const earningsRateOverride = INTEGERS.ZERO;
  const isClosing = false;

  await Promise.all([
    dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenA.address, price),
    dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenB.address, price),
    dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenC.address, price),
    dolomiteMargin.testing.priceOracle.setPrice(ADDRESSES.ZERO, price),
  ]);

  const tokens = [
    dolomiteMargin.testing.tokenA.address,
    dolomiteMargin.testing.tokenB.address,
    dolomiteMargin.testing.tokenC.address,
    ADDRESSES.ZERO,
  ];

  for (let i = 0; i < numMarkets && i < tokens.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await dolomiteMargin.admin.addMarket(
      tokens[i],
      priceOracle,
      interestSetter,
      marginPremium,
      liquidationSpreadPremium,
      maxSupplyWei,
      maxBorrowWei,
      earningsRateOverride,
      isClosing,
      { from: accounts[0] },
    );
  }

  await mineAvgBlock();
}
