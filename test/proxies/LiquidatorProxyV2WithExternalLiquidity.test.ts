import BigNumber from 'bignumber.js';
import { AccountStatus, address, ADDRESSES, Integer, INTEGERS, TxResult } from '../../src';
import { expectThrow } from '../helpers/Expect';
import DolomiteMarginMath from '../../src/modules/DolomiteMarginMath';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { setGlobalOperator, setupMarkets } from '../helpers/DolomiteMarginHelpers';
import { fastForward, mineAvgBlock, resetEVM, snapshot } from '../helpers/EVM';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';

enum FailureType {
  None,
  Silently,
  WithMessage,
  TooLittleOutput,
}

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
const negPar2 = par2.times('-1');
const prices = [new BigNumber('1e20'), new BigNumber('1e18'), new BigNumber('1e18'), new BigNumber('1e21')];
const price1 = prices[0]; // $100
const price2 = prices[1]; // $1
const price3 = prices[2]; // $1
const price4 = prices[3]; // $1000
const defaultIsClosing = false;
const marketIdToTokenMap = {};

describe('LiquidatorProxyV2WithExternalLiquidity', () => {
  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    solidOwner = dolomiteMargin.getDefaultAccount();
    liquidOwner = accounts[3];
    operator = accounts[6];

    await resetEVM();
    await setGlobalOperator(dolomiteMargin, accounts, dolomiteMargin.liquidatorProxyV2WithExternalLiquidity.address);
    await setupMarkets(dolomiteMargin, accounts);
    await Promise.all([
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenA.address, prices[0]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenB.address, prices[1]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenC.address, prices[2]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.weth.address, prices[3]),
      dolomiteMargin.permissions.approveOperator(operator, { from: solidOwner }),
      dolomiteMargin.permissions.approveOperator(dolomiteMargin.liquidatorProxyV2WithExternalLiquidity.address, {
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
      zero,
      zero,
      defaultIsClosing,
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

  describe('#liquidate', () => {
    const isOverCollateralized = false;
    describe('Success cases', () => {
      it('Succeeds for one owed, one held', async () => {
        await setUpBasicBalances(isOverCollateralized);

        // amountIn is the quantity of heldAmount needed to repay the debt
        await liquidate(market1, market2);
        await expectBalances([par.plus(par.times('0.05')), zero], [zero, par2.times('0.05')]);
      });

      it('Succeeds for one owed, one held (held first)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par2),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, par.times('1.1')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, negPar2),
        ]);
        await liquidate(market2, market1);
        await expectBalances(
          [zero, par2.plus(par2.times('0.05'))],
          [par.times('0.05'), zero],
        );
      });

      it('Succeeds for one owed, one held (undercollateralized)', async () => {
        const par2 = par.times('94.5');
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par2),
        ]);

        await liquidate(market1, market2);
        const heldPrice = new BigNumber('100');
        const heldPriceAdj = new BigNumber('105');
        await expectBalances(
          [par.plus(par2.div(heldPrice).minus(par2.div(heldPriceAdj))), zero],
          [negPar.plus(par2.div(heldPriceAdj)), zero],
        );
      });

      it('Succeeds for one owed, many held', async () => {
        const par2 = par.times('60');
        const par3 = par.times('50');
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par2),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, par3),
        ]);

        const { txResult: txResult1 } = await liquidate(market1, market2);
        const price = new BigNumber('100');
        const priceAdj = price.times('1.05');
        const liquidPar1_afterLiq1 = negPar.plus(DolomiteMarginMath.getPartialRoundUp(par2, new BigNumber('1'), priceAdj));
        await expectBalances(
          [
            par.plus(par2.dividedToIntegerBy(price).minus(DolomiteMarginMath.getPartialRoundUp(par2, new BigNumber('1'), priceAdj))),
            zero,
            zero,
          ],
          [
            liquidPar1_afterLiq1,
            zero,
            par3,
          ],
        );

        const { txResult: txResult2 } = await liquidate(market1, market3);
        // subtract an extra 1 wei to account for rounding error from performing multiple liquidations using market1
        const liquidPar3Sold_afterLiq2 = liquidPar1_afterLiq1.times('105');
        await expectBalances(
          [par.plus(par.times('0.05')), zero, zero],
          [zero, zero, par3.minus(liquidPar3Sold_afterLiq2.abs())],
        );
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity liquidation gas used (1 owed, 2 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity liquidation gas used (1 owed, 2 held): ${txResult2.gasUsed}`);
      });

      it('Succeeds for many owed, one held', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par.times('100')),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, negPar.times('50')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, par.times('165')),
        ]);

        const { txResult: txResult1 } = await liquidate(market1, market3);
        const { txResult: txResult2 } = await liquidate(market2, market3);

        await expectBalances(
          [
            par.plus(par.times('0.05')),
            par.times('100').plus(par.times('50').times('0.05')),
            zero,
          ],
          [zero, zero, par.times('7.5')],
        );
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity liquidation gas used (2 owed, 1 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity liquidation gas used (2 owed, 1 held): ${txResult2.gasUsed}`);
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
        const { txResult: txResult1 } = await liquidate(market4, market3);
        const solidPar4AfterSale_1 = solidPar4.plus(liquidPar4.times('0.05'));
        const liquidPar3Left = liquidPar3.minus(liquidPar4.times('1050')); // 1050 is a derived priceAdj
        await expectBalances(
          [zero, solidPar2, zero, solidPar4AfterSale_1],
          [liquidPar1, liquidPar2.negated(), liquidPar3Left, zero],
        );

        const { txResult: txResult2 } = await liquidate(market2, market3);
        const price = new BigNumber('100');
        const priceAdj = new BigNumber('105');
        const solidPar2AfterSale_2 = liquidPar3Left.minus(DolomiteMarginMath.getPartialRoundHalfUp(liquidPar3Left, price, priceAdj));
        const liquidPar2AfterSale_2 = DolomiteMarginMath.getPartialRoundHalfUp(liquidPar3Left, price3, price2.times('1.05'));
        await expectBalances(
          [
            zero,
            solidPar2.plus(solidPar2AfterSale_2),
            zero,
            solidPar4AfterSale_1,
          ],
          [
            liquidPar1,
            liquidPar2.negated().plus(liquidPar2AfterSale_2),
            zero,
            zero
          ],
        );

        const { txResult: txResult3 } = await liquidate(market2, market1);
        await expectBalances(
          [
            zero,
            solidPar2.plus(liquidPar2.times('0.05')),
            zero,
            solidPar4.plus(liquidPar4.times('0.05')),
          ],
          [
            liquidPar1.minus(liquidPar1.times('0.400').dividedToIntegerBy('0.525')).plus(INTEGERS.ONE),
            zero,
            zero,
            zero,
          ],
        );

        console.log(`\tLiquidatorProxyV2WithExternalLiquidity liquidation gas used (2 owed, 2 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity liquidation gas used (2 owed, 2 held): ${txResult2.gasUsed}`);
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity liquidation gas used (2 owed, 2 held): ${txResult3.gasUsed}`);
      });

      it('Succeeds for liquid account collateralized but in liquid status', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('150')),
          dolomiteMargin.testing.setAccountStatus(liquidOwner, liquidNumber, AccountStatus.Liquidating),
        ]);
        // amountIn is the quantity of heldAmount needed to repay the debt
        await liquidate(market1, market2);
        await expectBalances([par.plus(par.times('0.05')), zero], [zero, par.times('45')]);
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
        await liquidate(market1, market2);
        await expectBalances([par.plus(par.times('0.07')), zero], [zero, par.times('18')]);
      });

      it('Succeeds when held asset is whitelisted for this contract', async () => {
        await dolomiteMargin.liquidatorAssetRegistry.addLiquidatorToAssetWhitelist(
          market2,
          dolomiteMargin.liquidatorProxyV2WithExternalLiquidity.address,
          { from: admin },
        );
        await setUpBasicBalances(isOverCollateralized);

        // amountIn is the quantity of heldAmount needed to repay the debt
        await liquidate(market1, market2);
        await expectBalances([par.plus(par.times('0.05')), zero], [zero, par2.times('0.05')]);
      });
    });

    describe('Failure cases', () => {
      it('Fails for one owed, one held when liquidating a non-held asset', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await expectThrow(
          liquidate(market3, market2),
          'LiquidatorProxyBase: Market not found',
        );
      });

      it('Fails for msg.sender is non-operator', async () => {
        await Promise.all([
          setUpBasicBalances(isOverCollateralized),
          dolomiteMargin.permissions.disapproveOperator(operator, { from: solidOwner }),
        ]);
        await expectThrow(
          liquidate(market1, market2),
          `LiquidatorProxyBase: Sender not operator <${operator.toLowerCase()}>`,
        );
      });

      it('Fails if proxy is non-operator', async () => {
        await Promise.all([
          setUpBasicBalances(isOverCollateralized),
          dolomiteMargin.admin.setGlobalOperator(
            dolomiteMargin.liquidatorProxyV2WithExternalLiquidity.address,
            false,
            { from: admin },
          ),
        ]);
        await expectThrow(liquidate(market1, market2), 'Storage: Unpermissioned global operator');
      });

      it('Fails if held market equals owed market', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await expectThrow(
          liquidate(market1, market1),
          `LiquidatorProxyBase: Owed market equals held market <${market1.toFixed()}>`,
        );
      });

      it('Fails if owed market is positive', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await expectThrow(
          liquidate(market2, market1), // swap the two markets so owed = held
          `LiquidatorProxyBase: Owed market cannot be positive <${market2.toFixed()}>`,
        );
      });

      it('Fails for liquid account & held market is negative', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, new BigNumber(-1));
        await expectThrow(
          liquidate(market1, market2),
          `LiquidatorProxyBase: Held market cannot be negative <${market2.toFixed()}>`,
        );
      });

      it('Fails for liquid account if not actually under collateralized', async () => {
        await setUpBasicBalances(true);
        await expectThrow(
          liquidate(market1, market2),
          `LiquidateOrVaporizeImpl: Unliquidatable account <${liquidOwner.toLowerCase()}, ${liquidNumber.toFixed()}>`,
        );
      });

      it('Fails for liquid account if not actually under collateralized (with margin premium)', async () => {
        await setUpBasicBalances(true);
        const marginPremium = new BigNumber('0.1'); // this raises the liquidation threshold to 126.5% (115% * 1.1)
        await dolomiteMargin.admin.setMarginPremium(market1, marginPremium, { from: admin });
        await dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par.times('130'));
        await expectThrow(
          liquidate(market1, market2),
          `LiquidateOrVaporizeImpl: Unliquidatable account <${liquidOwner.toLowerCase()}, ${liquidNumber.toFixed()}>`,
        );
      });

      it('Fails when Paraswap call fails with message', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await expectThrow(
          liquidate(market1, market2, null, FailureType.WithMessage),
          'ParaswapTrader: TestParaswapTransferProxy: insufficient balance',
        );
      });

      it('Fails when Paraswap call fails with no message', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await expectThrow(
          liquidate(market1, market2, null, FailureType.Silently),
          'ParaswapTrader: revert',
        );
      });

      it('Fails when Paraswap outputs too little', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const owedMarket = market1;
        const heldMarket = market2;
        const owedAmount = (await dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, owedMarket)).abs();

        await expectThrow(
          liquidate(owedMarket, heldMarket, null, FailureType.TooLittleOutput),
          `ParaswapTrader: insufficient output amount <1, ${owedAmount.toFixed()}>`,
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
          liquidate(market1, market2, null),
          `LiquidatorProxyBase: Asset not whitelisted <${market2.toFixed()}>`,
        );
      });
    });
  });

  describe('#expire', () => {
    const isOverCollateralized = true;
    describe('Success cases', () => {
      it('Succeeds for one owed, one held', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const expiry = await setUpExpiration(market1);

        await liquidate(market1, market2, expiry);
        await expectBalances([par.plus(par.times('0.05')), zero], [zero, par.times('15')]);
      });

      it('Succeeds for one owed, one held (held first)', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par.times('100')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, par.times('1.2')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, negPar.times('100')),
        ]);
        const expiry = await setUpExpiration(market2);
        await liquidate(market2, market1, expiry);

        await expectBalances(
          [zero, par.times('100').plus(par.times('5'))],
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

        const { txResult: txResult1 } = await liquidate(market1, market2, expiry);
        const price1Adj = price1.times('1.05');
        const toLiquidate1 = DolomiteMarginMath.getPartialRoundUp(par2, price2, price1Adj);
        await expectBalances(
          [par.plus(toLiquidate1.times('105').dividedToIntegerBy('100').minus(toLiquidate1)), zero, zero],
          [negPar.plus(toLiquidate1), zero, par3],
        );

        const toLiquidate2 = par.minus(toLiquidate1);
        const solidPar3ToReceive = toLiquidate2.times(price1Adj).dividedToIntegerBy(price3);
        const { txResult: txResult2 } = await liquidate(market1, market3, expiry);

        await expectBalances(
          [par.plus(par.times('0.05')), zero, zero],
          [zero, zero, par3.minus(solidPar3ToReceive)],
        );
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity expiration gas used (1 owed, 2 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity expiration gas used (1 owed, 2 held): ${txResult2.gasUsed}`);
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

        const { txResult: txResult1 } = await liquidate(market1, market3, expiry1);
        await expectBalances(
          [
            par.plus(par.times('0.05')),
            zero,
            zero,
          ],
          [
            zero,
            negPar.times('50'),
            par3.minus(par.times('105')),
          ],
        );

        const { txResult: txResult2 } = await liquidate(market2, market3, expiry2);
        await expectBalances(
          [
            par.plus(par.times('0.05')),
            par.times('50').times('0.05'),
            zero,
          ],
          [
            zero,
            zero,
            par3.minus(par.times('157.5')),
          ],
        );
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity expiration gas used (2 owed, 1 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity expiration gas used (2 owed, 1 held): ${txResult2.gasUsed}`);
      });

      it('Succeeds for many owed, many held', async () => {
        const solidPar1 = par;
        const liquidPar1 = par.times('0.7');
        const liquidPar2 = par.times('100');
        const liquidPar3 = par.times('170');
        const liquidPar4 = par.times('0.1');
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, solidPar1),

          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, liquidPar1), // $700,000
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, liquidPar2.negated()), // -$1,000,000
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, liquidPar3), // $1,700,000
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, liquidPar4.negated()), // -$1,000,000
        ]);
        const expiry2 = await setUpExpiration(market2);
        const expiry4 = await setUpExpiration(market4);

        const { txResult: txResult1 } = await liquidate(market4, market3, expiry4);
        const price4Adj = price4.times('105').dividedToIntegerBy('100');
        const liquidPar3Left = liquidPar3.minus(liquidPar4.times(price4Adj).dividedToIntegerBy(price3));
        await expectBalances(
          [solidPar1, zero, zero, liquidPar4.times('0.05')],
          [liquidPar1, liquidPar2.negated(), liquidPar3Left, zero],
        );

        const { txResult: txResult2 } = await liquidate(market2, market3, expiry2);
        const price2Adj = price2.times('105').dividedToIntegerBy('100');
        const amount2ToLiquidate = DolomiteMarginMath.getPartialRoundUp(liquidPar3Left, price3, price2Adj);
        await expectBalances(
          [solidPar1, amount2ToLiquidate.times('0.05').dividedToIntegerBy(1), zero, liquidPar4.times('0.05')],
          [liquidPar1, liquidPar2.minus(amount2ToLiquidate).negated(), zero, zero],
        );

        const { txResult: txResult3 } = await liquidate(market2, market1, expiry2);
        await expectBalances(
          [solidPar1, liquidPar2.times('0.05'), zero, liquidPar4.times('0.05')],
          [
            liquidPar1.minus(liquidPar1.times('4').dividedToIntegerBy('7')).plus(INTEGERS.ONE),
            zero,
            zero,
            zero,
          ],
        );

        console.log(`\tLiquidatorProxyV2WithExternalLiquidity expiration gas used (2 owed, 2 held): ${txResult1.gasUsed}`);
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity expiration gas used (2 owed, 2 held): ${txResult2.gasUsed}`);
        console.log(`\tLiquidatorProxyV2WithExternalLiquidity expiration gas used (2 owed, 2 held): ${txResult3.gasUsed}`);
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
        const expiration = await setUpExpiration(market1);
        await liquidate(market1, market2, expiration);
        await expectBalances([par.plus(par.times('0.07')), zero], [zero, par.times('23')]);
      });

      it('Succeeds when held asset is whitelisted for this contract', async () => {
        await dolomiteMargin.liquidatorAssetRegistry.addLiquidatorToAssetWhitelist(
          market2,
          dolomiteMargin.liquidatorProxyV2WithExternalLiquidity.address,
          { from: admin },
        );
        await setUpBasicBalances(isOverCollateralized);
        const expiry = await setUpExpiration(market1);

        await liquidate(market1, market2, expiry);
        await expectBalances([par.plus(par.times('0.05')), zero], [zero, par.times('15')]);
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
          liquidate(market1, market2, expiry),
          `LiquidatorProxyBase: Sender not operator <${operator.toLowerCase()}>`,
        );
      });

      it('Fails if proxy is non-operator', async () => {
        await Promise.all([
          setUpBasicBalances(isOverCollateralized),
          dolomiteMargin.admin.setGlobalOperator(
            dolomiteMargin.liquidatorProxyV2WithExternalLiquidity.address,
            false,
            { from: admin },
          ),
        ]);
        const expiry = await setUpExpiration(market1, INTEGERS.ONE, true);
        await expectThrow(
          liquidate(market1, market2, expiry),
          'TradeImpl: Unpermissioned trade operator',
        );
      });

      it('Fails if held market equals owed market', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const expiry = await setUpExpiration(market1, INTEGERS.ONE, true);
        await expectThrow(
          liquidate(market1, market1, expiry),
          `LiquidatorProxyBase: Owed market equals held market <${market1.toFixed()}>`,
        );
      });

      it('Fails for input invalid expiry', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const actualExpiry = await setUpExpiration(market1, INTEGERS.ONE, true);
        const inputtedExpiry = new BigNumber('123');
        await expectThrow(
          liquidate(market1, market2, inputtedExpiry),
          `LiquidatorProxyBase: Expiry mismatch <${actualExpiry.toFixed()}, ${inputtedExpiry.toFixed()}>`,
        );
      });

      it('Fails when borrow not expired yet', async () => {
        await setUpBasicBalances(isOverCollateralized);
        const realExpiry = await setUpExpiration(market1, new BigNumber('864000'), false);
        await expectThrow(
          liquidate(market1, market2, realExpiry),
          `LiquidatorProxyBase: Borrow not yet expired <${realExpiry.toFixed()}>`,
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
          liquidate(market1, market2, expiry),
          `LiquidatorProxyBase: Asset not whitelisted <${market2.toFixed()}>`,
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

async function liquidate(
  owedMarket: Integer,
  heldMarket: Integer,
  expiry: Integer = null,
  failureType: FailureType = FailureType.None,
): Promise<{ txResult: TxResult, owedAmount: Integer, heldAmount: Integer }> {
  const owedToken = marketIdToTokenMap[owedMarket.toFixed()];
  const heldToken = marketIdToTokenMap[heldMarket.toFixed()];
  const heldPrice = await dolomiteMargin.getters.getMarketPrice(heldMarket);
  const rawOwedAmount = (await dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, owedMarket)).abs();
  const rawHeldAmount = (await dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, heldMarket)).abs();
  const owedPrice = await dolomiteMargin.getters.getMarketPrice(owedMarket);
  const liquidationRewardAdditive = INTEGERS.ONE.plus(
    await dolomiteMargin.getters.getLiquidationSpreadForAccountAndPair(liquidOwner, heldMarket, owedMarket)
  );

  let owedAmount: BigNumber;
  let heldAmount: BigNumber;
  if (rawOwedAmount.times(owedPrice.times(liquidationRewardAdditive)).gte(rawHeldAmount.times(heldPrice))) {
    // owed value is greater than held value. Bound the owed amount by the held value.
    heldAmount = rawHeldAmount;
    owedAmount = heldAmount.times(heldPrice).dividedToIntegerBy(owedPrice);
  } else {
    owedAmount = rawOwedAmount.times(liquidationRewardAdditive);
    heldAmount = owedAmount.times(owedPrice).dividedToIntegerBy(heldPrice);
  }

  if (failureType === FailureType.WithMessage) {
    heldAmount = INTEGERS.MAX_UINT_128;
  } else if (failureType === FailureType.Silently) {
    heldAmount = new BigNumber('420'); // 420 is hardcoded in the test contract
  } else if (failureType === FailureType.TooLittleOutput) {
    owedAmount = INTEGERS.ONE;
  }

  // In the real world, the liquidator would sell all the held amount, plus the reward, for as much owed amount as
  // possible. This liquidation case doesn't work this way because we're testing the flow. The integration test in the
  // other repository will cover this flow better.
  // Add 10 bps to account for interest accrual
  const paraswapCallData = dolomiteMargin.contracts.testParaswapAugustusRouter.methods.call(
    heldToken,
    heldAmount.toFixed(0),
    owedToken,
    owedAmount.toFixed(0),
  ).encodeABI();
  const txResult = await dolomiteMargin.liquidatorProxyV2WithExternalLiquidity.liquidate(
    solidOwner,
    solidNumber,
    liquidOwner,
    liquidNumber,
    owedMarket,
    heldMarket,
    expiry,
    paraswapCallData,
    { from: operator },
  );
  const logs = dolomiteMargin.logs.parseLogs(txResult);
  if (expiry && expiry.gt(INTEGERS.ZERO)) {
    expect(logs.filter(log => log.name === 'LogLiquidate').length).to.eql(0);
    const tradeLogs = logs.filter(log => log.name === 'LogTrade');
    expect(tradeLogs.length).to.eql(1);
    expect(tradeLogs[0].args.autoTrader).to.eql(dolomiteMargin.expiry.address);
  } else {
    expect(logs.filter(log => log.name === 'LogLiquidate').length).to.eql(1);
    expect(logs.filter(log => log.name === 'LogTrade').length).to.eql(0);
  }
  return { txResult, owedAmount, heldAmount };
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
