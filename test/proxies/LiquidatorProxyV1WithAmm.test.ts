import BigNumber from 'bignumber.js';
import { AccountStatus, address, ADDRESSES, BalanceCheckFlag, Index, Integer, INTEGERS } from '../../src';
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
let liquidityProvider: address;
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
const defaultTokenPath = [];
const zero = new BigNumber(0);
const par = new BigNumber('1e18');
const negPar = par.times(-1);
const priceBase = new BigNumber('1e36');
const prices = [new BigNumber('1e20'), new BigNumber('1e18'), new BigNumber('1e18'), new BigNumber('1e21')];
const price1 = prices[0]; // $100
const price2 = prices[1]; // $1
const price3 = prices[2]; // $1
const price4 = prices[3]; // $1,000
const defaultIsClosing = false;

describe('LiquidatorProxyV1WithAmm', () => {
  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    solidOwner = dolomiteMargin.getDefaultAccount();
    liquidOwner = accounts[3];
    operator = accounts[6];
    liquidityProvider = accounts[7];

    await resetEVM();
    await setGlobalOperator(dolomiteMargin, accounts, dolomiteMargin.contracts.liquidatorProxyV1WithAmm._address);
    await setupMarkets(dolomiteMargin, accounts);
    await Promise.all([
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenA.address, prices[0]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenB.address, prices[1]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenC.address, prices[2]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.weth.address, prices[3]),
      dolomiteMargin.permissions.approveOperator(operator, { from: solidOwner }),
      dolomiteMargin.permissions.approveOperator(dolomiteMargin.contracts.liquidatorProxyV1WithAmm.options.address, {
        from: solidOwner,
      }),
    ]);
    await dolomiteMargin.admin.addMarket(
      dolomiteMargin.weth.address,
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

    // market1 is the owed market
    // market2 is the held market
    // we need to repay the owed market, so the owed market goes last
    defaultTokenPath.push(await dolomiteMargin.getters.getMarketTokenAddress(market2));
    defaultTokenPath.push(await dolomiteMargin.getters.getMarketTokenAddress(market1));

    token1 = await dolomiteMargin.getters.getMarketTokenAddress(market1);
    token2 = await dolomiteMargin.getters.getMarketTokenAddress(market2);
    token3 = await dolomiteMargin.getters.getMarketTokenAddress(market3);
    token4 = await dolomiteMargin.getters.getMarketTokenAddress(market4);

    await dolomiteMargin.dolomiteAmmFactory.createPair(token1, token2);
    await dolomiteMargin.dolomiteAmmFactory.createPair(token1, token3);
    await dolomiteMargin.dolomiteAmmFactory.createPair(token1, token4);

    expect(await dolomiteMargin.dolomiteAmmFactory.getPairInitCodeHash()).to.eql(
      await dolomiteMargin.dolomiteAmmRouterProxy.getPairInitCodeHash(),
    );

    expect(await dolomiteMargin.testing.uniswapV2Factory.getPairInitCodeHash()).to.eql(
      await dolomiteMargin.testing.uniswapV2Router.getPairInitCodeHash(),
    );

    const oneEthInWei = new BigNumber('1e18');
    const numberOfUnits = new BigNumber('1e30'); // put a large amount into the pool

    await addLiquidity(
      liquidityProvider,
      priceBase
        .dividedToIntegerBy(price1)
        .dividedBy(oneEthInWei)
        .times(numberOfUnits),
      priceBase
        .dividedToIntegerBy(price2)
        .dividedBy(oneEthInWei)
        .times(numberOfUnits),
      token1,
      token2,
    );
    await addLiquidity(
      liquidityProvider,
      priceBase
        .dividedToIntegerBy(price1)
        .dividedBy(oneEthInWei)
        .times(numberOfUnits),
      priceBase
        .dividedToIntegerBy(price3)
        .dividedBy(oneEthInWei)
        .times(numberOfUnits),
      token1,
      token3,
    );
    await addLiquidity(
      liquidityProvider,
      priceBase
        .dividedToIntegerBy(price1)
        .dividedBy(oneEthInWei)
        .times(numberOfUnits),
      priceBase
        .dividedToIntegerBy(price4)
        .dividedBy(oneEthInWei)
        .times(numberOfUnits),
      token1,
      token4,
    );

    await mineAvgBlock();

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('#liquidate', () => {
    const isOverCollateralized = false;
    describe('Success cases', () => {
      it('Succeeds for one owed, one held', async () => {
        await setUpBasicBalances(isOverCollateralized);

        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn1 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath);
        await expectBalances([par, par.times('105').minus(amountIn1)], [zero, par.times('5')]);
      });

      it('Succeeds for one owed, one held (held first)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par.times('100')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, par.times('1.1')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, negPar.times('100')),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const path = [token1, token2];
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          par.times('100'),
          path,
        );
        await liquidate(market2, market1, path);
        await expectBalances([par.times('1.05').minus(amountIn), par.times('100')], [par.times('.05'), zero]);
      });

      it('Succeeds for one owed, one held (undercollateralized)', async () => {
        const par2 = par.times('95');
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par2),
        ]);

        const path = [token2, token1];
        const price1Adj = price1.times('105').dividedToIntegerBy('100');
        const amount1ToLiquidate = DolomiteMarginMath.getPartialRoundUp(par2, price2, price1Adj);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          amount1ToLiquidate,
          path,
        );
        await liquidate(market1, market2, path);
        await expectBalances([par, par2.minus(amountIn)], [par.minus(amount1ToLiquidate).negated(), zero]);
      });

      it('Succeeds for one owed, many held', async () => {
        const par2 = par.times('70');
        const par3 = par.times('40');
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par2),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, par3),
        ]);
        const price1Adj = price1.times('105').dividedToIntegerBy('100');
        const toLiquidate1 = DolomiteMarginMath.getPartialRoundUp(par2, price2, price1Adj);
        const path1 = [token2, token1];
        const amountSoldToken2 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          toLiquidate1,
          path1,
        );
        const txResult1 = await liquidate(market1, market2, path1);

        const toLiquidate2 = par.minus(toLiquidate1);
        const solidPar3ToReceive = toLiquidate2.times('105');
        const path2 = [token3, token1];
        const amountSoldToken3 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          par.minus(toLiquidate1),
          path2,
        );
        const txResult2 = await liquidate(market1, market3, path2);

        await expectBalances(
          [par, par2.minus(amountSoldToken2), solidPar3ToReceive.minus(amountSoldToken3)],
          [zero, zero, par3.minus(solidPar3ToReceive)],
        );
        console.log(`\tLiquidatorProxyV1WithAmm liquidation gas used (1 owed, 2 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV1WithAmm liquidation gas used (1 owed, 2 held): ${txResult2.gasUsed}`);
      });

      it('Succeeds for many owed, one held', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par.times('100')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, negPar.times('50')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, par.times('165')),
        ]);
        const path1 = [token3, token1];
        const amountIn1 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(par, path1);
        const txResult1 = await liquidate(market1, market3, path1);

        const path2 = [token3, token1, token2];
        const amountIn2 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          par.times('50'),
          path2,
        );
        const txResult2 = await liquidate(market2, market3, path2);

        await expectBalances(
          [
            par,
            par.times('100'),
            par
              .times('157.5')
              .minus(amountIn1)
              .minus(amountIn2),
          ],
          [zero, zero, par.times('7.5')],
        );
        console.log(`\tLiquidatorProxyV1WithAmm liquidation gas used (2 owed, 1 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV1WithAmm liquidation gas used (2 owed, 1 held): ${txResult2.gasUsed}`);
      });

      it('Succeeds for many owed, many held', async () => {
        const solidPar2 = par.times('150');
        const solidPar4 = par;
        const liquidPar1 = par.times('0.525');
        const liquidPar2 = par.times('100');
        const liquidPar3 = par.times('170');
        const liquidPar4 = par.times('0.1');
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, solidPar2),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market4, solidPar4),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, liquidPar1), // $525,000
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, liquidPar2.negated()), // -$1,000,000
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, liquidPar3), // $1,700,000
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, liquidPar4.negated()), // -$1,000,000
        ]);
        const path1 = [token3, token1, token4];
        const amount3Sold = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          liquidPar4,
          path1,
        );
        const txResult1 = await liquidate(market4, market3, path1);
        const solidPar3RewardAfterSale_1 = par.times('105').minus(amount3Sold);
        const liquidPar3Left = liquidPar3.minus(liquidPar4.times('1050')); // 1050 is a derived priceAdj

        await expectBalances(
          [zero, solidPar2, solidPar3RewardAfterSale_1, solidPar4],
          [liquidPar1, liquidPar2.negated(), liquidPar3Left, zero],
        );

        const price2Adj = price2.times('105').dividedToIntegerBy('100');
        const amount2ToLiquidate = DolomiteMarginMath.getPartialRoundUp(liquidPar3Left, price3, price2Adj);
        const path2 = [token3, token1, token2];
        const solidPar3RewardAfterSale_2 = liquidPar3Left.minus(
          await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(amount2ToLiquidate, path2),
        );
        const txResult2 = await liquidate(market2, market3, path2);

        const liquidPar2Left = liquidPar2.minus(amount2ToLiquidate);
        // 10,000 == 100 * $100 (where 100 is the base for 105)
        const liquidPar1ToTransfer = liquidPar2Left.times('105').dividedToIntegerBy('10000');
        const path3 = [token1, token2];
        const amount1Sold = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          liquidPar2.minus(amount2ToLiquidate),
          path3,
        );
        const txResult3 = await liquidate(market2, market1, path3);

        await expectBalances(
          // [liquidPar1ToTransfer.minus(amount1Sold), solidPar2, new BigNumber('1076027'), solidPar4],
          [
            liquidPar1ToTransfer.minus(amount1Sold),
            solidPar2,
            solidPar3RewardAfterSale_1.plus(solidPar3RewardAfterSale_2),
            solidPar4,
          ],
          [liquidPar1.minus(liquidPar1ToTransfer), zero, zero, zero],
        );

        console.log(`\tLiquidatorProxyV1WithAmm liquidation gas used (2 owed, 2 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV1WithAmm liquidation gas used (2 owed, 2 held): ${txResult2.gasUsed}`);
        console.log(`\tLiquidatorProxyV1WithAmm liquidation gas used (2 owed, 2 held): ${txResult3.gasUsed}`);
      });

      it('Succeeds for liquid account collateralized but in liquid status', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('150')),
          dolomiteMargin.testing.setAccountStatus(liquidOwner, liquidNumber, AccountStatus.Liquidating),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath);
        await expectBalances([par, par.times('105').minus(amountIn)], [zero, par.times('45')]);
      });

      it('Succeeds for liquid account under collateralized because of margin premium', async () => {
        const marginPremium = new BigNumber('0.1'); // // this raises the liquidation threshold to 126.5% (115% * 1.1)
        const liquidationSpreadPremium = new BigNumber('0.4'); // this raises the spread to 107% 100% + (5% * 1.4)
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('125')),
          dolomiteMargin.admin.setMarginPremium(
            market1,
            marginPremium,
            { from: admin },
          ),
          dolomiteMargin.admin.setLiquidationSpreadPremium(
            market1,
            liquidationSpreadPremium,
            { from: admin },
          ),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath);
        await expectBalances([par, par.times('107').minus(amountIn)], [zero, par.times('18')]);
      });

      it('Succeeds when held asset is whitelisted for this contract', async () => {
        await dolomiteMargin.liquidatorAssetRegistry.addLiquidatorToAssetWhitelist(
          market2,
          dolomiteMargin.liquidatorProxyV1WithAmm.address,
          { from: admin },
        );
        await setUpBasicBalances(isOverCollateralized);

        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn1 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath);
        await expectBalances([par, par.times('105').minus(amountIn1)], [zero, par.times('5')]);
      });
    });

    describe('Success cases for various initial liquidator balances', () => {
      it('Succeeds for one owed, one held (liquidator balance is zero)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market4, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('110')),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath);
        await expectBalances([zero, par.times('105').minus(amountIn), zero, par], [zero, par.times('5')]);
      });

      it('Succeeds for one owed, one held (liquidator balance is posHeld/negOwed)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par.times('500')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('110')),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath);
        await expectBalances([negPar, par.times('605').minus(amountIn)], [zero, par.times('5')]);
      });

      it('Succeeds for one owed, one held (liquidator balance is negatives)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, negPar.div(2)),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, negPar.times('50')),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market4, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('110')),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath);
        await expectBalances([negPar.div('2'), par.times('55').minus(amountIn)], [zero, par.times('5')]);
      });

      it('Succeeds for one owed, one held (liquidator balance is positives)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par.div(2)),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par.times('50')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('110')),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath);
        await expectBalances([par.div(2), par.times('155').minus(amountIn)], [zero, par.times('5')]);
      });

      it('Succeeds for one owed, one held (liquidator balance is !posHeld>!negOwed)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par.div(2)),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, negPar.times('100')),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market4, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('110')),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        const txResult = await liquidate(market1, market2, defaultTokenPath);
        await expectBalances([par.div(2), par.times('5').minus(amountIn)], [zero, par.times('5')]);
        console.log(`\tLiquidatorProxyV1WithAmm liquidation gas used: ${txResult.gasUsed}`);
      });

      it('Succeeds for one owed, one held (liquidator balance is !posHeld<!negOwed)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, negPar.times('50')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('110')),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath);
        await expectBalances([par, par.times('55').minus(amountIn)], [zero, par.times('5')]);
      });
    });

    describe('Follows minValueLiquidated', () => {
      it('Succeeds for small value liquidatable', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('110')),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);

        await dolomiteMargin.liquidatorProxyV1WithAmm.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          market1,
          market2,
          defaultTokenPath,
          null,
          INTEGERS.ONE,
          true,
          { from: operator },
        );
        await expectBalances([par, par.times('105').minus(amountIn)], [zero, par.times('5')]);
      });
    });

    describe('Failure cases', () => {
      it('Fails for one owed, one held when liquidating a non-held asset', async () => {
        await setUpBasicBalances(isOverCollateralized);

        const tokenPath = [
          await dolomiteMargin.getters.getMarketTokenAddress(market3),
          await dolomiteMargin.getters.getMarketTokenAddress(market1),
        ];
        await expectThrow(
          liquidate(market3, market2, tokenPath),
          'LiquidatorProxyBase: Market not found',
        );
      });

      it('Fails for msg.sender is non-operator', async () => {
        await Promise.all([
          setUpBasicBalances(isOverCollateralized),
          dolomiteMargin.permissions.disapproveOperator(operator, { from: solidOwner }),
        ]);
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath),
          `LiquidatorProxyBase: Sender not operator <${operator.toLowerCase()}>`,
        );
      });

      it('Fails if proxy is non-operator', async () => {
        await Promise.all([
          setUpBasicBalances(isOverCollateralized),
          dolomiteMargin.admin.setGlobalOperator(
            dolomiteMargin.contracts.liquidatorProxyV1WithAmm.options.address,
            false,
            { from: admin },
          ),
        ]);
        await expectThrow(liquidate(market1, market2, defaultTokenPath), 'Storage: Unpermissioned global operator');
      });

      it('Fails if 0-index path is incorrect', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await expectThrow(
          liquidate(market1, market2, [token3, token1]),
          `LiquidatorProxyV1WithAmm: 0-index token path incorrect <${token3.toLowerCase()}>`,
        );
      });

      it('Fails if last-index path is incorrect', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await expectThrow(
          liquidate(market1, market2, [token2, token3]),
          `LiquidatorProxyV1WithAmm: last-index token path incorrect <${token3.toLowerCase()}>`,
        );
      });

      it('Fails if held market equals owed market', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await expectThrow(
          liquidate(market1, market1, defaultTokenPath),
          `LiquidatorProxyBase: Owed market equals held market <${market1.toFixed()}>`,
        );
      });

      it('Fails if owed market is positive', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await expectThrow(
          liquidate(market2, market1, defaultTokenPath), // swap the two markets so owed = held
          `LiquidatorProxyBase: Owed market cannot be positive <${market2.toFixed()}>`,
        );
      });

      it('Fails for liquid account & held market is negative', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, INTEGERS.ZERO);
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath),
          `LiquidatorProxyBase: Held market cannot be negative <${market2.toFixed()}>`,
        );
      });

      it('Fails for liquid account if not actually under collateralized', async () => {
        await setUpBasicBalances(true);
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath),
          `LiquidateOrVaporizeImpl: Unliquidatable account <${liquidOwner.toLowerCase()}, ${liquidNumber.toFixed()}>`,
        );
      });

      it('Fails for liquid account if not actually under collateralized (with margin premium)', async () => {
        await setUpBasicBalances(true);
        const marginPremium = new BigNumber('0.1'); // this raises the liquidation threshold to 126.5% (115% * 1.1)
        await dolomiteMargin.admin.setMarginPremium(market1, marginPremium, { from: admin });
        await dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('130'));
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath),
          `LiquidateOrVaporizeImpl: Unliquidatable account <${liquidOwner.toLowerCase()}, ${liquidNumber.toFixed()}>`,
        );
      });

      it('Fails if liquidity is removed', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await removeAlmostAllLiquidity(liquidityProvider, defaultTokenPath[0], defaultTokenPath[1]);
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath, null, INTEGERS.ZERO, true),
          'DolomiteAmmLibrary: insufficient liquidity',
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
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath, null, INTEGERS.ZERO, true),
          `LiquidatorProxyBase: Asset not whitelisted <${market2.toFixed()}>`,
        );
      });
    });

    describe('Interest cases', () => {
      it('Liquidates properly even if the indexes have changed', async () => {
        const rate = INTEGERS.ZERO;
        const index: Index = {
          borrow: new BigNumber('1.2'),
          supply: new BigNumber('1.1'),
          lastUpdate: zero,
        };

        const solidPar1 = par.div('2'); // 5,000 par --> 5,500 wei --> $550,000
        const solidPar2 = par.negated().times('30'); // -300,000 par --> -360,000 wei --> -$360,000
        const liquidPar1 = par.negated(); // -10,000 par --> -12,000 wei --> -$1,200,000
        const liquidPar2 = par.times('110'); // 1,100,000 par --> 1,210,000 wei --> $1,210,000

        const solidWei2 = solidPar2.times('12').dividedToIntegerBy('10');
        const liquidWei1 = liquidPar1.times('12').dividedToIntegerBy('10');
        const liquidWei2 = liquidPar2.times('11').dividedToIntegerBy('10');

        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, solidPar1),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, solidPar2),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, liquidPar1),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, liquidPar2),
        ]);

        await Promise.all([
          dolomiteMargin.testing.interestSetter.setInterestRate(token1, rate),
          dolomiteMargin.testing.interestSetter.setInterestRate(token2, rate),
          dolomiteMargin.testing.setMarketIndex(market1, index),
          dolomiteMargin.testing.setMarketIndex(market2, index),
        ]);
        await fastForward(1);

        const priceAdj = new BigNumber('105'); // 1.05 * $100; price of market1 is $100
        const toLiquidateWei = DolomiteMarginMath.getPartialRoundUp(liquidWei2, INTEGERS.ONE, priceAdj);
        const amountInWei = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          toLiquidateWei,
          defaultTokenPath,
        );

        // These operations cannot be consolidated, which would result in off-by-1 errors (due to rounding)
        const solidNewPar2_1 = DolomiteMarginMath.weiToPar(solidWei2.plus(liquidWei2), index);
        const solidNewWei2_1 = DolomiteMarginMath.parToWei(solidNewPar2_1, index);
        const solidNewPar2_2 = DolomiteMarginMath.weiToPar(solidNewWei2_1.minus(amountInWei), index);

        const liquidNewPar1_1 = DolomiteMarginMath.weiToPar(liquidWei1.plus(toLiquidateWei), index);

        await liquidate(market1, market2, defaultTokenPath);

        await expectBalances([solidPar1, solidNewPar2_2], [liquidNewPar1_1, zero]);
      });

      it('Liquidates properly when reward does not cover debt', async () => {
        const rate = INTEGERS.ZERO;
        const index1: Index = {
          borrow: new BigNumber('1.4'),
          supply: new BigNumber('1.1'),
          lastUpdate: zero,
        };
        const index2: Index = {
          borrow: new BigNumber('1.4'),
          supply: new BigNumber('1.2'),
          lastUpdate: zero,
        };
        await Promise.all([
          dolomiteMargin.testing.interestSetter.setInterestRate(token1, rate),
          dolomiteMargin.testing.interestSetter.setInterestRate(token2, rate),
          dolomiteMargin.testing.setMarketIndex(market1, index1),
          dolomiteMargin.testing.setMarketIndex(market2, index2),
        ]);

        const solidPar1 = par.multipliedBy('0.75'); // 7,500 par --> 8,250 wei --> $825,000
        const solidPar2 = zero; // $0
        const liquidPar1 = par.negated(); // -10,000 par --> -14,000 wei --> -$1,400,000
        const liquidPar2 = par.times('110'); // 1,100,000 par --> 1,210,000 wei --> $1,430,000

        const solidWei1 = DolomiteMarginMath.parToWei(solidPar1, index1);
        const solidWei2 = DolomiteMarginMath.parToWei(solidPar2, index2);
        const liquidWei1 = DolomiteMarginMath.parToWei(liquidPar1, index1);
        const liquidWei2 = DolomiteMarginMath.parToWei(liquidPar2, index2);

        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, solidPar1),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, solidPar2),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, liquidPar1),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, liquidPar2),
        ]);

        const priceAdj = price1.times('1.05'); // 1.05 * $100; price of market1 is $100
        const toLiquidateWei = DolomiteMarginMath.getPartialRoundUp(liquidWei2, price2, priceAdj);
        const amountOutWei = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountOutWithPath(
          solidWei2.plus(liquidWei2),
          defaultTokenPath,
        );

        // These operations cannot be consolidated, because it would result in off-by-1 errors (due to rounding)
        const solidNewPar1_1 = DolomiteMarginMath.weiToPar(solidWei1.minus(toLiquidateWei), index1);
        const solidNewWei1_1 = DolomiteMarginMath.parToWei(solidNewPar1_1, index1);
        const solidNewPar1_2 = DolomiteMarginMath.weiToPar(solidNewWei1_1.plus(amountOutWei), index1);

        const liquidNewPar1_1 = DolomiteMarginMath.weiToPar(liquidWei1.plus(toLiquidateWei), index1);

        await liquidate(market1, market2, defaultTokenPath, null, amountOutWei);

        await expectBalances([solidNewPar1_2, zero], [liquidNewPar1_1, zero]);
      });
    });
  });

  describe('#expire', () => {
    const isOverCollateralized = true;
    describe('Success cases', () => {
      it('Succeeds for one owed, one held', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const expiry = await setUpExpiration(market1);

        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn1 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath, expiry);
        await expectBalances([par, par.times('105').minus(amountIn1)], [zero, par.times('15')]);
      });

      it('Succeeds for one owed, one held (held first)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par.times('100')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, par.times('1.2')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, negPar.times('100')),
        ]);
        const expiry = await setUpExpiration(market2);
        const path = [token1, token2];
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          par.times('100'),
          path,
        );
        await liquidate(market2, market1, path, expiry);
        await expectBalances([par.times('1.05').minus(amountIn), par.times('100')], [par.times('0.15'), zero]);
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
        const price1Adj = price1.times('1.05');
        const toLiquidate1 = DolomiteMarginMath.getPartialRoundUp(par2, price2, price1Adj);
        const path1 = [token2, token1];
        const amountSoldToken2 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          toLiquidate1,
          path1,
        );
        const txResult1 = await liquidate(market1, market2, path1, expiry);

        const toLiquidate2 = par.minus(toLiquidate1);
        const solidPar3ToReceive = toLiquidate2.times('105');
        const path2 = [token3, token1];
        const amountSoldToken3 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          par.minus(toLiquidate1),
          path2,
        );
        const txResult2 = await liquidate(market1, market3, path2, expiry);

        await expectBalances(
          [par, par2.minus(amountSoldToken2), solidPar3ToReceive.minus(amountSoldToken3)],
          [zero, zero, par3.minus(solidPar3ToReceive)],
        );
        console.log(`\tLiquidatorProxyV1WithAmm expiration gas used (1 owed, 2 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV1WithAmm expiration gas used (1 owed, 2 held): ${txResult2.gasUsed}`);
      });

      it('Succeeds for many owed, one held', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par.times('100')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, negPar.times('50')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, par.times('180')),
        ]);
        const expiry1 = await setUpExpiration(market1);
        const expiry2 = await setUpExpiration(market2);

        const path1 = [token3, token1];
        const amountIn1 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(par, path1);
        const txResult1 = await liquidate(market1, market3, path1, expiry1);

        const path2 = [token3, token1, token2];
        const amountIn2 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          par.times('50'),
          path2,
        );
        const txResult2 = await liquidate(market2, market3, path2, expiry2);

        await expectBalances(
          [
            par,
            par.times('100'),
            par
              .times('157.5')
              .minus(amountIn1)
              .minus(amountIn2),
          ],
          [zero, zero, par.times('22.5')],
        );
        console.log(`\tLiquidatorProxyV1WithAmm expiration gas used (2 owed, 1 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV1WithAmm expiration gas used (2 owed, 1 held): ${txResult2.gasUsed}`);
      });

      it('Succeeds for many owed, many held', async () => {
        const solidPar2 = par.times('150');
        const solidPar4 = par;
        const liquidPar1 = par.times('0.700');
        const liquidPar2 = par.times('100');
        const liquidPar3 = par.times('170');
        const liquidPar4 = par.times('0.1');
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, solidPar2),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market4, solidPar4),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, liquidPar1), // $700,000
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, liquidPar2.negated()), // -$1,000,000
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, liquidPar3), // $1,700,000
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, liquidPar4.negated()), // -$1,000,000
        ]);
        const expiry2 = await setUpExpiration(market2);
        const expiry4 = await setUpExpiration(market4);
        const path1 = [token3, token1, token4];
        const amount3Sold = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          liquidPar4,
          path1,
        );
        const txResult1 = await liquidate(market4, market3, path1, expiry4);
        const solidPar3RewardAfterSale_1 = par.times('105').minus(amount3Sold);
        const liquidPar3Left = liquidPar3.minus(liquidPar4.times('1050')); // 1050 is a derived priceAdj

        await expectBalances(
          [zero, solidPar2, solidPar3RewardAfterSale_1, solidPar4],
          [liquidPar1, liquidPar2.negated(), liquidPar3Left, zero],
        );

        const price2Adj = price2.times('105').dividedToIntegerBy('100');
        const amount2ToLiquidate = DolomiteMarginMath.getPartialRoundUp(liquidPar3Left, price3, price2Adj);
        const path2 = [token3, token1, token2];
        const solidPar3RewardAfterSale_2 = liquidPar3Left.minus(
          await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(amount2ToLiquidate, path2),
        );
        const txResult2 = await liquidate(market2, market3, path2, expiry2);

        const liquidPar2Left = liquidPar2.minus(amount2ToLiquidate);
        // 10,000 == 100 * $100 (where 100 is the base for 105)
        const liquidPar1ToTransfer = liquidPar2Left.times('105').dividedToIntegerBy('10000');
        const path3 = [token1, token2];
        const amount1Sold = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          liquidPar2.minus(amount2ToLiquidate),
          path3,
        );
        const txResult3 = await liquidate(market2, market1, path3, expiry2);

        await expectBalances(
          // [liquidPar1ToTransfer.minus(amount1Sold), solidPar2, new BigNumber('1076027'), solidPar4],
          [
            liquidPar1ToTransfer.minus(amount1Sold),
            solidPar2,
            solidPar3RewardAfterSale_1.plus(solidPar3RewardAfterSale_2),
            solidPar4,
          ],
          [liquidPar1.minus(liquidPar1ToTransfer), zero, zero, zero],
        );

        console.log(`\tLiquidatorProxyV1WithAmm expiration gas used (2 owed, 2 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV1WithAmm expiration gas used (2 owed, 2 held): ${txResult2.gasUsed}`);
        console.log(`\tLiquidatorProxyV1WithAmm expiration gas used (2 owed, 2 held): ${txResult3.gasUsed}`);
      });

      it('Succeeds when there is a margin premium', async () => {
        const marginPremium = new BigNumber('0.1'); // // this raises the liquidation threshold to 126.5% (115% * 1.1)
        const liquidationSpreadPremium = new BigNumber('0.4'); // this raises the spread to 107% 100% + (5% * 1.4)
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('130')),
          dolomiteMargin.admin.setMarginPremium(
            market1,
            marginPremium,
            { from: admin },
          ),
          dolomiteMargin.admin.setLiquidationSpreadPremium(
            market1,
            liquidationSpreadPremium,
            { from: admin },
          ),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        const expiration = await setUpExpiration(market1);
        await liquidate(market1, market2, defaultTokenPath, expiration);
        await expectBalances([par, par.times('107').minus(amountIn)], [zero, par.times('23')]);
      });

      it('Succeeds when held asset is whitelisted for this contract', async () => {
        await dolomiteMargin.liquidatorAssetRegistry.addLiquidatorToAssetWhitelist(
          market2,
          dolomiteMargin.liquidatorProxyV1WithAmm.address,
          { from: admin },
        );
        await setUpBasicBalances(isOverCollateralized);

        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn1 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        const expiration = await setUpExpiration(market1);
        await liquidate(market1, market2, defaultTokenPath, expiration);
        await expectBalances([par, par.times('105').minus(amountIn1)], [zero, par.times('15')]);
      });
    });

    describe('Success cases for various initial liquidator balances', () => {
      it('Succeeds for one owed, one held (liquidator balance is zero)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market4, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('120')),
        ]);
        const expiry = await setUpExpiration(market1);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath, expiry);
        await expectBalances([zero, par.times('105').minus(amountIn), zero, par], [zero, par.times('15')]);
      });

      it('Succeeds for one owed, one held (liquidator balance is posHeld/negOwed)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par.times('500')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('120')),
        ]);
        const expiry = await setUpExpiration(market1);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath, expiry);
        await expectBalances([negPar, par.times('605').minus(amountIn)], [zero, par.times('15')]);
      });

      it('Succeeds for one owed, one held (liquidator balance is negatives)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, negPar.div(2)),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, negPar.times('50')),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market4, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('120')),
        ]);
        const expiry = await setUpExpiration(market1);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath, expiry);
        await expectBalances([negPar.div('2'), par.times('55').minus(amountIn)], [zero, par.times('15')]);
      });

      it('Succeeds for one owed, one held (liquidator balance is positives)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par.div(2)),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par.times('50')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('120')),
        ]);
        const expiry = await setUpExpiration(market1);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath, expiry);
        await expectBalances([par.div(2), par.times('155').minus(amountIn)], [zero, par.times('15')]);
      });

      it('Succeeds for one owed, one held (liquidator balance is !posHeld>!negOwed)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par.div(2)),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, negPar.times('100')),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market4, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('120')),
        ]);
        const expiry = await setUpExpiration(market1);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        const txResult = await liquidate(market1, market2, defaultTokenPath, expiry);
        await expectBalances([par.div(2), par.times('5').minus(amountIn)], [zero, par.times('15')]);
        console.log(`\tLiquidatorProxyV1WithAmm expiration gas used: ${txResult.gasUsed}`);
      });

      it('Succeeds for one owed, one held (liquidator balance is !posHeld<!negOwed)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, negPar.times('50')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('120')),
        ]);
        const expiry = await setUpExpiration(market1);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);
        await liquidate(market1, market2, defaultTokenPath, expiry);
        await expectBalances([par, par.times('55').minus(amountIn)], [zero, par.times('15')]);
      });
    });

    describe('Follows minValueLiquidated', () => {
      it('Succeeds for small value liquidatable', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('120')),
        ]);
        const expiry = await setUpExpiration(market1);
        // amountIn is the quantity of heldAmount needed to repay the debt
        const amountIn = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountIn(par, token2, token1);

        await dolomiteMargin.liquidatorProxyV1WithAmm.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          market1,
          market2,
          defaultTokenPath,
          expiry,
          INTEGERS.ONE,
          true,
          { from: operator },
        );
        await expectBalances([par, par.times('105').minus(amountIn)], [zero, par.times('15')]);
      });
    });

    describe('Failure cases', () => {
      it('Fails for msg.sender is non-operator', async () => {
        await Promise.all([
          setUpBasicBalances(isOverCollateralized),
          dolomiteMargin.permissions.disapproveOperator(operator, { from: solidOwner }),
        ]);
        const expiry = await setUpExpiration(market1);
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath, expiry),
          `LiquidatorProxyBase: Sender not operator <${operator.toLowerCase()}>`,
        );
      });

      it('Fails if proxy is non-operator', async () => {
        await Promise.all([
          setUpBasicBalances(isOverCollateralized),
          dolomiteMargin.admin.setGlobalOperator(
            dolomiteMargin.contracts.liquidatorProxyV1WithAmm.options.address,
            false,
            { from: admin },
          ),
        ]);
        const expiry = await setUpExpiration(market1);
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath, expiry),
          'TradeImpl: Unpermissioned trade operator',
        );
      });

      it('Fails if 0-index path is incorrect', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const expiry = await setUpExpiration(market1);
        await expectThrow(
          liquidate(market1, market2, [token3, token1], expiry),
          `LiquidatorProxyV1WithAmm: 0-index token path incorrect <${token3.toLowerCase()}>`,
        );
      });

      it('Fails if last-index path is incorrect', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const expiry = await setUpExpiration(market1);
        await expectThrow(
          liquidate(market1, market2, [token2, token3], expiry),
          `LiquidatorProxyV1WithAmm: last-index token path incorrect <${token3.toLowerCase()}>`,
        );
      });

      it('Fails if held market equals owed market', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const expiry = await setUpExpiration(market1);
        await expectThrow(
          liquidate(market1, market1, defaultTokenPath, expiry),
          `LiquidatorProxyBase: Owed market equals held market <${market1.toFixed()}>`,
        );
      });

      it('Fails if liquidity is removed', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await removeAlmostAllLiquidity(liquidityProvider, defaultTokenPath[0], defaultTokenPath[1]);
        const expiry = await setUpExpiration(market1);
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath, expiry, INTEGERS.ZERO, true),
          'DolomiteAmmLibrary: insufficient liquidity',
        );
      });

      it('Fails for input invalid expiry', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const actualExpiry = await setUpExpiration(market1);
        const inputtedExpiry = new BigNumber('123');
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath, inputtedExpiry),
          `LiquidatorProxyBase: Expiry mismatch <${actualExpiry.toFixed()}, ${inputtedExpiry.toFixed()}>`,
        );
      });

      it('Fails when borrow not expired yet', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const realExpiry = await setUpExpiration(market1, new BigNumber('864000'), false);
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath, realExpiry),
          `LiquidatorProxyBase: Borrow not yet expired <${realExpiry.toFixed()}>`,
        );
      });

      it('Fails when borrow not expiration is too far out yet', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await setUpExpiration(market1);
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath, INTEGERS.MAX_UINT_128),
          `LiquidatorProxyBase: Expiry overflows <${INTEGERS.MAX_UINT_128.toFixed()}>`,
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
        await setUpExpiration(market1);
        await expectThrow(
          liquidate(market1, market2, defaultTokenPath, INTEGERS.MAX_UINT_128),
          `LiquidatorProxyBase: Asset not whitelisted <${market2.toFixed()}>`,
        );
      });
    });

    describe('Interest cases', () => {
      it('Liquidates properly even if the indexes have changed', async () => {
        const rate = INTEGERS.ZERO;
        const index: Index = {
          borrow: new BigNumber('1.2'),
          supply: new BigNumber('1.1'),
          lastUpdate: zero,
        };
        await Promise.all([
          dolomiteMargin.testing.interestSetter.setInterestRate(token1, rate),
          dolomiteMargin.testing.interestSetter.setInterestRate(token2, rate),
          dolomiteMargin.testing.setMarketIndex(market1, index),
          dolomiteMargin.testing.setMarketIndex(market2, index),
        ]);
        await fastForward(1);

        const solidPar1 = par.div('2'); // 5,000 par --> 5,500 wei --> $550,000
        const solidPar2 = par.negated().times('30'); // -300,000 par --> -360,000 wei --> -$360,000
        const liquidPar1 = par.negated(); // -10,000 par --> -12,000 wei --> -$1,200,000
        const liquidPar2 = par.times('130'); // 1,300,000 par --> 1,430,000 wei --> $1,430,000

        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, solidPar1),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, solidPar2),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, liquidPar2),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, liquidPar1),
        ]);

        const solidWei2 = DolomiteMarginMath.parToWei(solidPar2, index);
        const liquidWei1 = DolomiteMarginMath.parToWei(liquidPar1, index).negated();
        const liquidWei2 = DolomiteMarginMath.parToWei(liquidPar2, index);
        const toLiquidateWei = DolomiteMarginMath.getPartialRoundUp(liquidWei1, new BigNumber('105'), INTEGERS.ONE);
        const amountInWei2 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          liquidWei1,
          defaultTokenPath,
        );

        const solidNewPar2_2 = DolomiteMarginMath.weiToPar(solidWei2.plus(toLiquidateWei.minus(amountInWei2)), index);

        const liquidNewPar2_2 = DolomiteMarginMath.weiToPar(liquidWei2.minus(toLiquidateWei), index);

        const expiry = await setUpExpiration(market1);

        await liquidate(market1, market2, defaultTokenPath, expiry);

        await expectBalances([solidPar1, solidNewPar2_2], [zero, liquidNewPar2_2]);
      });

      it('Does not liquidate properly when reward does not cover debt', async () => {
        const solidPar1 = par.div('2'); // 5,000 par --> 5,500 wei --> $550,000
        const solidPar2 = zero; // $0
        const liquidPar1 = par.negated(); // -10,000 par --> -14,000 wei --> -$1,400,000
        const liquidPar2 = par.times('120'); // 1,200,000 par --> 1,560,000 wei --> $1,560,000

        const expiry = await setUpExpiration(market1);
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, solidPar1),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, solidPar2),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, liquidPar1),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, liquidPar2),
        ]);

        const rate = INTEGERS.ZERO;
        const index1: Index = {
          borrow: new BigNumber('1.4'),
          supply: new BigNumber('1.1'),
          lastUpdate: zero,
        };
        const index2: Index = {
          borrow: new BigNumber('1.4'),
          supply: new BigNumber('1.3'),
          lastUpdate: zero,
        };
        await Promise.all([
          dolomiteMargin.testing.interestSetter.setInterestRate(token1, rate),
          dolomiteMargin.testing.interestSetter.setInterestRate(token2, rate),
          dolomiteMargin.testing.setMarketIndex(market1, index1),
          dolomiteMargin.testing.setMarketIndex(market2, index2),
        ]);

        const solidWei2 = DolomiteMarginMath.parToWei(solidPar2, index2);
        const liquidWei1 = DolomiteMarginMath.parToWei(liquidPar1, index1);
        const liquidWei2Converted = liquidWei1.times('105').dividedToIntegerBy(INTEGERS.ONE).negated();
        const amountOut2Wei = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountInWithPath(
          liquidWei1.negated(),
          defaultTokenPath,
        );
        const solidWei2_2 = solidWei2.plus(liquidWei2Converted);

        await expectThrow(
          liquidate(market1, market2, defaultTokenPath, expiry, amountOut2Wei, true),
          `LiquidatorProxyV1WithAmm: totalSolidHeldWei is too small <${solidWei2_2.toFixed()}, ${amountOut2Wei.toFixed()}>`,
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
      par.times(isOverCollateralized ? '120' : '110'),
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
    await fastForward(60 * 60 * 24);
  }
  return dolomiteMargin.expiry.getExpiry(liquidOwner, liquidNumber, market);
}

async function liquidate(
  owedMarket: Integer,
  heldMarket: Integer,
  tokenPath: address[],
  expiry: Integer = null,
  minOwedOutputAmount: Integer = INTEGERS.ONE,
  revertOnFailToSellCollateral: boolean = false,
) {
  const txResult = await dolomiteMargin.liquidatorProxyV1WithAmm.liquidate(
    solidOwner,
    solidNumber,
    liquidOwner,
    liquidNumber,
    owedMarket,
    heldMarket,
    tokenPath,
    expiry,
    minOwedOutputAmount,
    revertOnFailToSellCollateral,
    { from: operator },
  );
  const logs = dolomiteMargin.logs.parseLogs(txResult);
  if (expiry && expiry.gt(INTEGERS.ZERO)) {
    expect(logs.filter(log => log.name === 'LogLiquidate').length).to.eql(0);
    // the expiration is a trade, so add one back in
    expect(logs.filter(log => log.name === 'LogTrade').length).to.eql(tokenPath.length - 1 + 1);
  } else {
    expect(logs.filter(log => log.name === 'LogLiquidate').length).to.eql(1);
    expect(logs.filter(log => log.name === 'LogTrade').length).to.eql(tokenPath.length - 1);
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

async function addLiquidity(
  walletAddress: address,
  amountADesired: BigNumber,
  amountBDesired: BigNumber,
  tokenA: address,
  tokenB: address,
) {
  const marketIdA = await dolomiteMargin.getters.getMarketIdByTokenAddress(tokenA);
  const marketIdB = await dolomiteMargin.getters.getMarketIdByTokenAddress(tokenB);
  const accountNumber = INTEGERS.ZERO;
  await Promise.all([
    dolomiteMargin.testing.setAccountBalance(walletAddress, accountNumber, marketIdA, amountADesired),
    dolomiteMargin.testing.setAccountBalance(walletAddress, accountNumber, marketIdB, amountBDesired),
  ]);

  return dolomiteMargin.dolomiteAmmRouterProxy.addLiquidity(
    walletAddress,
    INTEGERS.ZERO,
    tokenA,
    tokenB,
    amountADesired,
    amountBDesired,
    INTEGERS.ONE,
    INTEGERS.ONE,
    new BigNumber('123456789123'),
    BalanceCheckFlag.Both,
    { from: walletAddress },
  );
}

async function removeAlmostAllLiquidity(walletAddress: address, tokenA: address, tokenB: address) {
  const pair = await dolomiteMargin.contracts.getDolomiteAmmPairFromTokens(tokenA, tokenB);
  const liquidityProviderBalance = await dolomiteMargin.token.getBalance(pair.options.address, walletAddress);

  await dolomiteMargin.contracts.callContractFunction(
    pair.methods.approve(dolomiteMargin.contracts.dolomiteAmmRouterProxy.options.address, INTEGERS.MAX_UINT.toString()),
    { from: walletAddress },
  );

  return dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidity(
    walletAddress,
    INTEGERS.ZERO,
    tokenA,
    tokenB,
    liquidityProviderBalance,
    INTEGERS.ONE,
    INTEGERS.ONE,
    new BigNumber('123456789123'),
    { from: walletAddress },
  );
}
