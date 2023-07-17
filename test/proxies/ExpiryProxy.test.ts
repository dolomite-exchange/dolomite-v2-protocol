import BigNumber from 'bignumber.js';
import { address, ADDRESSES, Integer, INTEGERS, TxResult } from '../../src';
import { expectThrow } from '../helpers/Expect';
import DolomiteMarginMath from '../../src/modules/DolomiteMarginMath';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { setGlobalOperator, setupMarkets } from '../helpers/DolomiteMarginHelpers';
import { fastForward, mineAvgBlock, resetEVM, snapshot } from '../helpers/EVM';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';

let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
let snapshotId: string;
let admin: address;
let solidOwner: address;
let liquidOwner: address;
let operator: address;
let token1: address;
let token2: address;
let token3: address;
let token4: address;

const solidNumber = new BigNumber(111);
const liquidNumber = new BigNumber(222);
const market1 = INTEGERS.ZERO;
const market2 = INTEGERS.ONE;
const market3 = new BigNumber(2);
const market4 = new BigNumber(3);
const zero = new BigNumber(0);
const par = new BigNumber('1e18');
const par2 = par.times('100');
const negPar = par.times(-1);
const prices = [new BigNumber('1e20'), new BigNumber('1e18'), new BigNumber('1e18'), new BigNumber('1e21')];
const price1 = prices[0]; // $100
const price2 = prices[1]; // $1
const price3 = prices[2]; // $1
const defaultIsClosing = false;
const defaultIsRecyclable = false;
const marketIdToTokenMap = {};

describe('ExpiryProxy', () => {
  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    solidOwner = dolomiteMargin.getDefaultAccount();
    liquidOwner = accounts[3];
    operator = accounts[6];

    await resetEVM();
    await setGlobalOperator(dolomiteMargin, accounts, dolomiteMargin.expiryProxy.address);
    await setupMarkets(dolomiteMargin, accounts);
    await Promise.all([
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenA.address, prices[0]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenB.address, prices[1]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenC.address, prices[2]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.weth.address, prices[3]),
      dolomiteMargin.permissions.approveOperator(operator, { from: solidOwner }),
      dolomiteMargin.permissions.approveOperator(dolomiteMargin.expiryProxy.address, {
        from: solidOwner,
      }),
      dolomiteMargin.testing.tokenA.issueTo(par.times('1000'), dolomiteMargin.address),
      dolomiteMargin.testing.tokenB.issueTo(par.times('1000'), dolomiteMargin.address),
      dolomiteMargin.testing.tokenC.issueTo(par.times('1000'), dolomiteMargin.address),
      dolomiteMargin.testing.tokenD.issueTo(par.times('1000'), dolomiteMargin.address),
    ]);
    await dolomiteMargin.admin.addMarket(
      dolomiteMargin.weth.address,
      dolomiteMargin.testing.priceOracle.address,
      dolomiteMargin.testing.interestSetter.address,
      zero,
      zero,
      zero,
      defaultIsClosing,
      defaultIsRecyclable,
      { from: admin },
    );

    token1 = await dolomiteMargin.getters.getMarketTokenAddress(market1);
    token2 = await dolomiteMargin.getters.getMarketTokenAddress(market2);
    token3 = await dolomiteMargin.getters.getMarketTokenAddress(market3);
    token4 = await dolomiteMargin.getters.getMarketTokenAddress(market4);

    marketIdToTokenMap[market1.toFixed()] = token1;
    marketIdToTokenMap[market2.toFixed()] = token2;
    marketIdToTokenMap[market3.toFixed()] = token3;
    marketIdToTokenMap[market4.toFixed()] = token4;

    await mineAvgBlock();

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('#expire', () => {
    const isOverCollateralized = true;
    describe('Success cases', () => {
      it('Succeeds for one owed, one held', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const expiry = await setUpExpiration(market1);

        await expire(market1, market2, expiry);
        await expectBalances([zero, par2.plus(par2.times('0.05'))], [zero, par.times('15')]);
      });

      it('Succeeds for one owed, one held (held first)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par.times('100')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, par.times('1.2')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, negPar.times('100')),
        ]);
        const expiry = await setUpExpiration(market2);
        await expire(market2, market1, expiry);

        await expectBalances(
          [par.plus(par.times('0.05')), zero],
          [par.times('0.15'), zero],
        );
      });

      it('Succeeds for one owed, many held', async () => {
        const par2 = par.times('70');
        const par3 = par.times('60');
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par2),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, par3),
        ]);
        const expiry = await setUpExpiration(market1);

        const txResult1 = await expire(market1, market2, expiry);
        const price1Adj = price1.times('1.05');
        const toLiquidate1 = DolomiteMarginMath.getPartialRoundUp(par2, price2, price1Adj);
        await expectBalances(
          [par.minus(toLiquidate1), par2, zero],
          [negPar.plus(toLiquidate1), zero, par3],
        );

        const toLiquidate2 = par.minus(toLiquidate1);
        const solidPar3ToReceive = toLiquidate2.times(price1Adj).dividedToIntegerBy(price3);
        const txResult2 = await expire(market1, market3, expiry);

        await expectBalances(
          [zero, par2, solidPar3ToReceive],
          [zero, zero, par3.minus(solidPar3ToReceive)],
        );
        console.log(`\tExpiryProxy expiration gas used (1 owed, 2 held): ${txResult1.gasUsed}`);
        console.log(`\tExpiryProxy expiration gas used (1 owed, 2 held): ${txResult2.gasUsed}`);
      });

      it('Succeeds for many owed, one held', async () => {
        const par3 = par.times('180');
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, negPar.times('50')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, par3),
        ]);
        const expiry1 = await setUpExpiration(market1);
        const expiry2 = await setUpExpiration(market2);

        const txResult1 = await expire(market1, market3, expiry1);
        await expectBalances(
          [
            zero,
            zero,
            par.times('100').times('1.05'),
          ],
          [
            zero,
            negPar.times('50'),
            par3.minus(par.times('105')),
          ],
        );

        const txResult2 = await expire(market2, market3, expiry2);
        await expectBalances(
          [
            zero,
            negPar.times('50'),
            par.times('150').times('1.05'),
          ],
          [
            zero,
            zero,
            par3.minus(par.times('157.5')),
          ],
        );
        console.log(`\tExpiryProxy expiration gas used (2 owed, 1 held): ${txResult1.gasUsed}`);
        console.log(`\tExpiryProxy expiration gas used (2 owed, 1 held): ${txResult2.gasUsed}`);
      });

      it('Succeeds when there is a margin premium', async () => {
        const marginPremium = new BigNumber('0.1'); // // this raises the liquidation threshold to 126.5% (115% * 1.1)
        const spreadPremium = new BigNumber('0.4'); // this raises the spread to 107% 100% + (5% * 1.4)
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('130')),
          dolomiteMargin.admin.setMarginPremium(
            market1,
            marginPremium,
            { from: admin },
          ),
          dolomiteMargin.admin.setSpreadPremium(
            market1,
            spreadPremium,
            { from: admin },
          ),
        ]);
        const expiration = await setUpExpiration(market1);
        await expire(market1, market2, expiration);
        await expectBalances([zero, par2.plus(par2.times('0.07'))], [zero, par.times('23')]);
      });

      it('Succeeds when held asset is whitelisted for this contract', async () => {
        await dolomiteMargin.liquidatorAssetRegistry.addLiquidatorToAssetWhitelist(
          market2,
          dolomiteMargin.expiryProxy.address,
          { from: admin },
        );
        await setUpBasicBalances(isOverCollateralized);
        const expiry = await setUpExpiration(market1);

        await expire(market1, market2, expiry);
        await expectBalances([zero, par.times('105')], [zero, par.times('15')]);
      });
    });

    describe('Failure cases', () => {
      it('Fails for msg.sender is non-operator', async () => {
        await Promise.all([
          setUpBasicBalances(isOverCollateralized),
          dolomiteMargin.permissions.disapproveOperator(operator, { from: solidOwner }),
        ]);
        const expiry = await setUpExpiration(market1, INTEGERS.ONE, true);
        await expectThrow(
          expire(market1, market2, expiry),
          `ExpiryProxy: Sender not operator <${operator.toLowerCase()}>`,
        );
      });

      it('Fails if proxy is non-operator', async () => {
        await Promise.all([
          setUpBasicBalances(isOverCollateralized),
          dolomiteMargin.admin.setGlobalOperator(
            dolomiteMargin.expiryProxy.address,
            false,
            { from: admin },
          ),
        ]);
        const expiry = await setUpExpiration(market1, INTEGERS.ONE, true);
        await expectThrow(
          expire(market1, market2, expiry),
          'TradeImpl: Unpermissioned trade operator',
        );
      });

      it('Fails for input invalid expiry', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const inputtedExpiry = new BigNumber('123');
        await expectThrow(
          expire(market1, market2, inputtedExpiry),
          'ExpiryProxy: Invalid expiration timestamp',
        );
      });

      it('Fails when borrow not expired yet', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const realExpiry = await setUpExpiration(market1, new BigNumber('864000'), false);
        await expectThrow(
          expire(market1, market2, realExpiry),
          `Expiry: Borrow not yet expired <${realExpiry.toFixed()}>`,
        );
      });

      it('Fails if asset is blacklisted by registry for this proxy contract', async () => {
        // Market2 (if held) cannot be liquidated by any contract
        await dolomiteMargin.liquidatorAssetRegistry.addLiquidatorToAssetWhitelist(
          market2,
          ADDRESSES.ONE,
          { from: admin },
        );
        await setUpBasicBalances(isOverCollateralized);
        const expiry = await setUpExpiration(market1, INTEGERS.ONE, true);
        await expectThrow(
          expire(market1, market2, expiry),
          `HasLiquidatorRegistry: Asset not whitelisted <${market2.toFixed()}>`,
        );
      });
    });
  });
});

// ============ Helper Functions ============

async function setUpBasicBalances(isOverCollateralized: boolean) {
  await Promise.all([
    dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),

    dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
    dolomiteMargin.testing.setAccountBalance(
      liquidOwner,
      liquidNumber,
      market2,
      par2.times(isOverCollateralized ? '1.2' : '1.1'),
    ),
  ]);
}

async function setUpExpiration(
  market: Integer,
  timeDelta: Integer = INTEGERS.ONE,
  shouldFastForward: boolean = true,
): Promise<Integer> {
  await dolomiteMargin.operation
    .initiate()
    .setExpiry({
      primaryAccountOwner: liquidOwner,
      primaryAccountId: liquidNumber,
      expiryArgs: [
        {
          timeDelta,
          accountOwner: liquidOwner,
          accountId: liquidNumber,
          marketId: market,
          forceUpdate: true,
        },
      ],
    })
    .commit({ from: liquidOwner });

  if (shouldFastForward) {
    await fastForward(timeDelta.toNumber() + (60 * 60 * 24));
  }

  return dolomiteMargin.expiry.getExpiry(liquidOwner, liquidNumber, market);
}

async function expire(
  owedMarket: Integer,
  heldMarket: Integer,
  expiry: Integer,
): Promise<TxResult> {
  const txResult = await dolomiteMargin.expiryProxy.expire(
    solidOwner,
    solidNumber,
    liquidOwner,
    liquidNumber,
    owedMarket,
    heldMarket,
    expiry,
    { from: operator },
  );
  const logs = dolomiteMargin.logs.parseLogs(txResult);
  if (expiry && expiry.gt(INTEGERS.ZERO)) {
    expect(logs.filter(log => log.name === 'LogLiquidate').length).to.eql(0);
    const tradeLogs = logs.filter(log => log.name === 'LogTrade');
    expect(tradeLogs.length).to.eql(1);
    expect(tradeLogs[0].args.autoTrader).to.eql(dolomiteMargin.expiry.address);
  }
  return txResult;
}

async function expectBalances(solidBalances: (number | BigNumber)[], liquidBalances: (number | BigNumber)[]) {
  const bal1 = await Promise.all([
    dolomiteMargin.getters.getAccountPar(solidOwner, solidNumber, market1),
    dolomiteMargin.getters.getAccountPar(solidOwner, solidNumber, market2),
    dolomiteMargin.getters.getAccountPar(solidOwner, solidNumber, market3),
    dolomiteMargin.getters.getAccountPar(solidOwner, solidNumber, market4),
  ]);
  const bal2 = await Promise.all([
    dolomiteMargin.getters.getAccountPar(liquidOwner, liquidNumber, market1),
    dolomiteMargin.getters.getAccountPar(liquidOwner, liquidNumber, market2),
    dolomiteMargin.getters.getAccountPar(liquidOwner, liquidNumber, market3),
    dolomiteMargin.getters.getAccountPar(liquidOwner, liquidNumber, market4),
  ]);

  for (let i = 0; i < solidBalances.length; i += 1) {
    expect(bal1[i]).to.eql(solidBalances[i]);
  }
  for (let i = 0; i < liquidBalances.length; i += 1) {
    expect(bal2[i]).to.eql(liquidBalances[i]);
  }
}
