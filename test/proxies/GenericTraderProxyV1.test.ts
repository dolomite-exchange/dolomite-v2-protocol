import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import * as testIsolationModeTokenJson from '../../build/contracts/TestIsolationModeToken.json';
import * as testLiquidityTokenUnwrapperTraderJson from '../../build/contracts/TestLiquidityTokenUnwrapperTrader.json';
import * as testLiquidityTokenWrapperTraderJson from '../../build/contracts/TestLiquidityTokenWrapperTrader.json';
import * as testTokenJson from '../../build/contracts/CustomTestToken.json';
import { CustomTestToken as TestTokenContract } from '../../build/testing_wrappers/CustomTestToken';
import { TestIsolationModeToken as TestIsolationModeTokenContract } from '../../build/testing_wrappers/TestIsolationModeToken';
import { TestLiquidityTokenUnwrapperTrader } from '../../build/testing_wrappers/TestLiquidityTokenUnwrapperTrader';
import { TestLiquidityTokenWrapperTrader } from '../../build/testing_wrappers/TestLiquidityTokenWrapperTrader';
import { address, ADDRESSES, AmountDenomination, AmountReference, Integer, INTEGERS, TxResult } from '../../src';
import {
  GenericExpiryParam,
  GenericTraderParam,
  GenericTraderType,
  GenericTransferCollateralAmounts,
  GenericTransferCollateralParam,
} from '../../src/modules/GenericTraderProxyV1';
import { deployContract } from '../helpers/Deploy';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { mineAvgBlock, resetEVM, snapshot } from '../helpers/EVM';
import { expectThrow } from '../helpers/Expect';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { TestIsolationModeToken } from '../modules/TestIsolationModeToken';
import { TestToken } from '../modules/TestToken';
import { setGlobalOperator } from '../helpers/DolomiteMarginHelpers';

let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
let snapshotId: string;
let traderOwner: address;
let makerAccountOwner: address;
let token1: address;
let token2: address;
let token3: address; // isolation mode
let token4: address; // isolation mode
let token5: address; // isolation mode
let token6: address; // isolation mode
let token1Contract: TestToken;
let token2Contract: TestToken;
let token3Contract: TestIsolationModeToken;
let token4Contract: TestIsolationModeToken;
let token5Contract: TestToken;
let token6Contract: TestToken;
let testLiquidityUnwrapper: TestLiquidityTokenUnwrapperTrader;
let testLiquidityWrapper: TestLiquidityTokenWrapperTrader;

const tradeAccountNumber = new BigNumber(111);
const originalAccountNumber = new BigNumber(0);
const makerAccountNumber1 = new BigNumber(333);
const makerAccountNumber2 = new BigNumber(444);
const market1 = INTEGERS.ZERO;
const market2 = INTEGERS.ONE;
const market3 = new BigNumber(2); // isolation mode
const market4 = new BigNumber(3); // isolation mode
const market5 = new BigNumber(4);
const market6 = new BigNumber(5);
const par1 = new BigNumber('1e18'); // $100; 1 unit
const par2 = par1.times('125'); // $250; 125 units
const par3 = par1.times('250'); // $250; 250 units
const par4 = par1.times('50'); // $250; 50 units
const par5 = par1.times('65'); // $650; 65 units
const par6 = par1.times('75'); // $750; 75 units
const price1 = new BigNumber('100000000000000000000'); // $100
const price2 = new BigNumber('2000000000000000000'); // $2
const price3 = new BigNumber('1000000000000000000'); // $1
const price4 = new BigNumber('5000000000000000000'); // $5
const price5 = new BigNumber('10000000000000000000'); // $10
const price6 = new BigNumber('10000000000000000000'); // $10
const tradeId1 = new BigNumber('42161');
const tradeId2 = new BigNumber('42162');
const tradeId3 = new BigNumber('42163');
const defaultMarginPremium = INTEGERS.ZERO;
const defaultSpreadPremium = INTEGERS.ZERO;
const defaultMaxSupplyWei = INTEGERS.ZERO;
const defaultMaxBorrowWei = INTEGERS.ZERO;
const defaultEarningsRateOverride = INTEGERS.ZERO;
const defaultIsClosing = false;
const marketIdToTokenMap = {};
const defaultExpiryTimeDelta = new BigNumber(60 * 60); // 1 hour

const simpleMarketIdPath = [market1, market2];
const simpleAmountWeisPath = [par1, par2];

describe('GenericTraderProxyV1', () => {
  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    traderOwner = dolomiteMargin.getDefaultAccount();
    makerAccountOwner = accounts[7];

    await resetEVM();
    await setupMarkets();

    token1 = await dolomiteMargin.getters.getMarketTokenAddress(market1);
    token2 = await dolomiteMargin.getters.getMarketTokenAddress(market2);
    token3 = await dolomiteMargin.getters.getMarketTokenAddress(market3);
    token4 = await dolomiteMargin.getters.getMarketTokenAddress(market4);
    token5 = await dolomiteMargin.getters.getMarketTokenAddress(market5);
    token6 = await dolomiteMargin.getters.getMarketTokenAddress(market6);

    marketIdToTokenMap[market1.toFixed()] = token1;
    marketIdToTokenMap[market2.toFixed()] = token2;
    marketIdToTokenMap[market3.toFixed()] = token3;
    marketIdToTokenMap[market4.toFixed()] = token4;
    marketIdToTokenMap[market5.toFixed()] = token5;
    marketIdToTokenMap[market6.toFixed()] = token6;

    testLiquidityUnwrapper = await deployContract<TestLiquidityTokenUnwrapperTrader>(
      dolomiteMargin,
      testLiquidityTokenUnwrapperTraderJson,
      [token3, token2, dolomiteMargin.address],
    );
    testLiquidityWrapper = await deployContract<TestLiquidityTokenWrapperTrader>(
      dolomiteMargin,
      testLiquidityTokenWrapperTraderJson,
      [token2, token3, dolomiteMargin.address],
    );

    token1Contract = new TestToken(dolomiteMargin.contracts, dolomiteMargin.token, dolomiteMargin.contracts.tokenA);
    token2Contract = new TestToken(dolomiteMargin.contracts, dolomiteMargin.token, dolomiteMargin.contracts.tokenB);

    const testToken3RawContract = new dolomiteMargin.web3.eth.Contract(
      testIsolationModeTokenJson.abi,
      token3,
    ) as TestIsolationModeTokenContract;
    testToken3RawContract.options.from = dolomiteMargin.getDefaultAccount();
    token3Contract = new TestIsolationModeToken(dolomiteMargin.contracts, dolomiteMargin.token, testToken3RawContract);

    const testToken4RawContract = new dolomiteMargin.web3.eth.Contract(
      testIsolationModeTokenJson.abi,
      token4,
    ) as TestIsolationModeTokenContract;
    testToken4RawContract.options.from = dolomiteMargin.getDefaultAccount();
    token4Contract = new TestIsolationModeToken(dolomiteMargin.contracts, dolomiteMargin.token, testToken4RawContract);

    const testToken5RawContract = new dolomiteMargin.web3.eth.Contract(testTokenJson.abi, token5) as TestTokenContract;
    testToken5RawContract.options.from = dolomiteMargin.getDefaultAccount();
    token5Contract = new TestToken(dolomiteMargin.contracts, dolomiteMargin.token, testToken5RawContract);

    const testToken6RawContract = new dolomiteMargin.web3.eth.Contract(
      testIsolationModeTokenJson.abi,
      token6,
    ) as TestIsolationModeTokenContract;
    testToken6RawContract.options.from = dolomiteMargin.getDefaultAccount();
    token6Contract = new TestIsolationModeToken(dolomiteMargin.contracts, dolomiteMargin.token, testToken6RawContract);

    await token3Contract.setTokenConverterTrusted(testLiquidityUnwrapper.options.address, true);
    await token3Contract.setTokenConverterTrusted(testLiquidityWrapper.options.address, true);

    await Promise.all([
      token1Contract.issueTo(par1.times(1000), dolomiteMargin.address),
      token2Contract.issueTo(par2.times(1000), dolomiteMargin.address),
      token3Contract.issueTo(par3.times(1000), dolomiteMargin.address),
      token4Contract.issueTo(par4.times(1000), dolomiteMargin.address),
      token5Contract.issueTo(par5.times(1000), dolomiteMargin.address),
      token6Contract.issueTo(par6.times(1000), dolomiteMargin.address),
      dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, market1, par1),
      dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, market2, par2),
      dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, market3, par3),
      dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, market4, par4),
      dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, market5, par5),
      dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, market6, par6),
      dolomiteMargin.testing.setAccountBalance(traderOwner, originalAccountNumber, market1, par1),
      dolomiteMargin.testing.setAccountBalance(traderOwner, originalAccountNumber, market2, par2),
      dolomiteMargin.testing.setAccountBalance(traderOwner, originalAccountNumber, market3, par3),
      dolomiteMargin.testing.setAccountBalance(traderOwner, originalAccountNumber, market4, par4),
      dolomiteMargin.testing.setAccountBalance(traderOwner, originalAccountNumber, market5, par5),
      dolomiteMargin.testing.setAccountBalance(traderOwner, originalAccountNumber, market6, par6),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber1, market1, par1),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber1, market2, par2),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber1, market3, par3),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber1, market4, par4),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber1, market5, par5),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber1, market6, par6),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber2, market1, par1),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber2, market2, par2),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber2, market3, par3),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber2, market4, par4),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber2, market5, par5),
      dolomiteMargin.testing.setAccountBalance(makerAccountOwner, makerAccountNumber2, market6, par6),
    ]);

    await setGlobalOperator(dolomiteMargin, accounts, dolomiteMargin.testing.autoTrader.address);

    await mineAvgBlock();

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('#swapExactInputForOutput', () => {
    describe('Success cases', () => {
      it('should succeed for a simple swap using external liquidity', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath,
          [
            getParaswapTraderParam(
              simpleMarketIdPath[0],
              simpleMarketIdPath[1],
              simpleAmountWeisPath[0],
              simpleAmountWeisPath[1],
            ),
          ],
          [],
          { from: traderOwner },
        );

        const [market1Balance, market2Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
        ]);

        expect(market1Balance).to.eql(INTEGERS.ZERO);
        expect(market2Balance).to.eql(par2.times(2));
      });

      it('should succeed for a simple swap using internal liquidity', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath,
          [await getInternalTraderParamAsync(0, simpleAmountWeisPath[1])],
          [{ owner: makerAccountOwner, number: makerAccountNumber1.toNumber() }],
          { from: traderOwner },
        );

        const [traderMarket1Balance, traderMarket2Balance, makerMarket1Balance, makerMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
            dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market1),
            dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market2),
          ]);

        expect(traderMarket1Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket2Balance).to.eql(par2.times(2));

        expect(makerMarket1Balance).to.eql(par1.times(2));
        expect(makerMarket2Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a simple swap using unwrapper', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          tradeAccountNumber,
          [market3, market2],
          [par3, par2],
          [await getUnwrapperTraderParam()],
          [],
          { from: traderOwner },
        );

        const [traderMarket2Balance, traderMarket3Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),
        ]);

        expect(traderMarket2Balance).to.eql(par2.plus(par3.div(2)));
        expect(traderMarket3Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a simple swap using wrapper', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          tradeAccountNumber,
          [market2, market3],
          [par2, par3],
          [await getWrapperTraderParam()],
          [],
          { from: traderOwner },
        );

        const [traderMarket2Balance, traderMarket3Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),
        ]);

        expect(traderMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket3Balance).to.eql(par3.times(2));
      });

      it('should succeed for a simple swap that unwraps into a wrapper', async () => {
        const freshUnwrapper = await deployContract<TestLiquidityTokenUnwrapperTrader>(
          dolomiteMargin,
          testLiquidityTokenUnwrapperTraderJson,
          [token3, token4, dolomiteMargin.address],
        );
        await token3Contract.setTokenConverterTrusted(freshUnwrapper.options.address, true);
        await token4Contract.setTokenConverterTrusted(freshUnwrapper.options.address, true);

        const traderParam = getUnwrapperTraderParam();
        traderParam.trader = freshUnwrapper.options.address;
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          tradeAccountNumber,
          [market3, market4],
          [par3, par4],
          [traderParam],
          [],
          { from: traderOwner },
        );

        const [traderMarket3Balance, traderMarket4Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market4),
        ]);

        expect(traderMarket3Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket4Balance).to.eql(par4.times(2));
      });

      it('should succeed for a larger swap using external liquidity', async () => {
        const path = [market1, market2, market5];
        const amounts = [par1, par2, par5];
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          tradeAccountNumber,
          path,
          amounts,
          [
            getParaswapTraderParam(path[0], path[1], amounts[0], amounts[1]),
            getParaswapTraderParam(path[1], path[2], amounts[1], amounts[2]),
          ],
          [],
          { from: traderOwner },
        );

        const [market1Balance, market2Balance, market5Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market5),
        ]);

        expect(market1Balance).to.eql(INTEGERS.ZERO);
        expect(market2Balance).to.eql(par2);
        expect(market5Balance).to.eql(par5.times(2));
      });

      it('should succeed for a larger swap using internal liquidity', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          tradeAccountNumber,
          [market1, market2, market5, market6],
          [par1, par2, par5, par6],
          [
            await getInternalTraderParamAsync(0, par2, tradeId1),
            await getInternalTraderParamAsync(0, par5, tradeId2),
            await getInternalTraderParamAsync(1, par6, tradeId3),
          ],
          [
            { owner: makerAccountOwner, number: makerAccountNumber1.toNumber() },
            { owner: makerAccountOwner, number: makerAccountNumber2.toNumber() },
          ],
          { from: traderOwner },
        );

        const [
          traderMarket1Balance,
          traderMarket2Balance,
          traderMarket5Balance,
          traderMarket6Balance,
          maker1Market1Balance,
          maker1Market2Balance,
          maker1Market5Balance,
          maker1Market6Balance,
          maker2Market1Balance,
          maker2Market2Balance,
          maker2Market5Balance,
          maker2Market6Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market5),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market6),

          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market1),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market2),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market5),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market6),

          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market1),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market2),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market5),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market6),
        ]);

        expect(traderMarket1Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket2Balance).to.eql(par2);
        expect(traderMarket5Balance).to.eql(par5);
        expect(traderMarket6Balance).to.eql(par6.times(2));

        expect(maker1Market1Balance).to.eql(par1.times(2));
        expect(maker1Market2Balance).to.eql(par2);
        expect(maker1Market5Balance).to.eql(INTEGERS.ZERO);
        expect(maker1Market6Balance).to.eql(par6);

        expect(maker2Market1Balance).to.eql(par1);
        expect(maker2Market2Balance).to.eql(par2);
        expect(maker2Market5Balance).to.eql(par5.times(2));
        expect(maker2Market6Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a mega swap using all forms of liquidity', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          tradeAccountNumber,
          [market1, market2, market3, market2, market5, market6],
          [par1, par2, par3, par2, par5, par6],
          [
            await getInternalTraderParamAsync(0, par2, tradeId1),
            await getWrapperTraderParam(),
            await getUnwrapperTraderParam(),
            await getInternalTraderParamAsync(1, par5, tradeId2),
            await getParaswapTraderParam(market5, market6, par5, par6),
          ],
          [
            { owner: makerAccountOwner, number: makerAccountNumber1.toNumber() },
            { owner: makerAccountOwner, number: makerAccountNumber2.toNumber() },
          ],
          { from: traderOwner },
        );

        const [
          traderMarket1Balance,
          traderMarket2Balance,
          traderMarket3Balance,
          traderMarket5Balance,
          traderMarket6Balance,
          maker1Market1Balance,
          maker1Market2Balance,
          maker1Market3Balance,
          maker1Market5Balance,
          maker1Market6Balance,
          maker2Market1Balance,
          maker2Market2Balance,
          maker2Market3Balance,
          maker2Market5Balance,
          maker2Market6Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market5),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market6),

          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market1),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market2),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market3),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market5),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market6),

          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market1),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market2),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market3),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market5),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market6),
        ]);

        expect(traderMarket1Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket2Balance).to.eql(par2);
        expect(traderMarket3Balance).to.eql(par3);
        expect(traderMarket5Balance).to.eql(par5);
        expect(traderMarket6Balance).to.eql(par6.times(2));

        expect(maker1Market1Balance).to.eql(par1.times(2));
        expect(maker1Market2Balance).to.eql(INTEGERS.ZERO);
        expect(maker1Market3Balance).to.eql(par3);
        expect(maker1Market5Balance).to.eql(par5);
        expect(maker1Market6Balance).to.eql(par6);

        expect(maker2Market1Balance).to.eql(par1);
        expect(maker2Market2Balance).to.eql(par2.times(2));
        expect(maker2Market3Balance).to.eql(par3);
        expect(maker2Market5Balance).to.eql(INTEGERS.ZERO);
        expect(maker2Market6Balance).to.eql(par6);
      });
    });

    describe('Failure cases', () => {
      it('should fail when marketId path < 2', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
          ),
          'GenericTraderProxyBase: Invalid market path length',
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
          ),
          'GenericTraderProxyBase: Invalid market path length',
        );
      });

      it('should fail when first and last market are the same', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1, market1],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
          ),
          'GenericTraderProxyBase: Duplicate markets in path',
        );
      });

      it('should fail when amounts do not match markets length', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            [par1],
            [getDefaultParaswapTraderParam()],
            [],
          ),
          'GenericTraderProxyBase: Invalid amounts path length',
        );
      });

      it('should fail when amount at any index is 0', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            [par1, INTEGERS.ZERO],
            [getDefaultParaswapTraderParam()],
            [],
          ),
          'GenericTraderProxyBase: Invalid amount at index <1>',
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            [INTEGERS.ZERO, par2],
            [getDefaultParaswapTraderParam()],
            [],
          ),
          'GenericTraderProxyBase: Invalid amount at index <0>',
        );
      });

      it('should fail when trader length is incorrect', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath,
            [],
            [],
          ),
          'GenericTraderProxyBase: Invalid traders params length',
        );
      });

      it('should fail when trader is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath,
            [traderWithInvalidAddress],
            [],
          ),
          'GenericTraderProxyBase: Invalid trader at index <0>',
        );
      });

      it('should fail when attempting to use a normal trader for an isolation mode token', async () => {
        const traderParam = getUnwrapperTraderParam();
        traderParam.traderType = GenericTraderType.ExternalLiquidity;
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market3, market2],
            simpleAmountWeisPath,
            [traderParam],
            [],
          ),
          `GenericTraderProxyBase: Invalid isolation mode unwrapper <${market3.toFixed()}, ${traderParam.traderType}>`,
        );
      });

      it('should fail when attempting to unwrap into an isolation mode token', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market3, market4],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
          ),
          `GenericTraderProxyBase: Invalid unwrap sequence <${market3.toFixed()}, ${market4.toFixed()}>`,
        );
      });

      it('should fail when attempting to unwrap into an isolation mode token', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1, market4],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
          ),
          `GenericTraderProxyBase: Invalid isolation mode wrapper <${market4.toFixed()}, ${
            GenericTraderType.ExternalLiquidity
          }>`,
        );
      });

      it('should fail when attempting to incorrectly set the trader type to be an unwrapper or wrapper for non-isolation mode', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
          ),
          `GenericTraderProxyBase: Invalid trader type <${GenericTraderType.IsolationModeUnwrapper}>`,
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
          ),
          `GenericTraderProxyBase: Invalid trader type <${GenericTraderType.IsolationModeWrapper}>`,
        );
      });

      it('should fail when the input for the unwrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market4, market2],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
          ),
          `GenericTraderProxyBase: Invalid input for unwrapper <0, ${market4.toFixed()}>`,
        );
      });

      it('should fail when the output for the unwrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market3, market1],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
          ),
          `GenericTraderProxyBase: Invalid output for unwrapper <1, ${market1.toFixed()}>`,
        );
      });

      it('should fail when the unwrapper trader is not trusted', async () => {
        await token3Contract.setTokenConverterTrusted(testLiquidityUnwrapper.options.address, false);
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market3, market2],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
          ),
          `GenericTraderProxyBase: Unwrapper trader not enabled <${testLiquidityUnwrapper.options.address.toLowerCase()}, ${market3.toFixed()}>`,
        );
      });

      it('should fail when the input for the wrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1, market3],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
          ),
          `GenericTraderProxyBase: Invalid input for wrapper <0, ${market1.toFixed()}>`,
        );
      });

      it('should fail when the output for the wrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market2, market4],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
          ),
          `GenericTraderProxyBase: Invalid output for wrapper <1, ${market4.toFixed()}>`,
        );
      });

      it('should fail when the wrapper trader is not trusted', async () => {
        await token3Contract.setTokenConverterTrusted(testLiquidityWrapper.options.address, false);
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market2, market3],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
          ),
          `GenericTraderProxyBase: Wrapper trader not enabled <${testLiquidityWrapper.options.address.toLowerCase()}, ${market3.toFixed()}>`,
        );
      });

      it('should fail when makerAccountIndex is >= makerAccounts.length and trader type is internal liquidity', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [await getInternalTraderParamAsync(0, par2)],
            [{ owner: ADDRESSES.ZERO, number: makerAccountNumber1.toNumber() }],
          ),
          'GenericTraderProxyBase: Invalid maker account owner <0>',
        );
      });

      it('should fail when the maker account is non-zero and trader type is external liquidity', async () => {
        const traderParam = getDefaultParaswapTraderParam();
        traderParam.makerAccountIndex = 1;
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [traderParam],
            [],
          ),
          'GenericTraderProxyBase: Invalid maker account owner <0>',
        );
      });
    });
  });

  describe('#swapExactInputForOutputAndModifyPosition', () => {
    describe('Success cases', () => {
      it('should succeed for a simple swap using external liquidity', async () => {
        const expiryMarketId = simpleMarketIdPath[0];
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, expiryMarketId, INTEGERS.ZERO);
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        const txResult = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath,
          [
            getParaswapTraderParam(
              simpleMarketIdPath[0],
              simpleMarketIdPath[1],
              simpleAmountWeisPath[0],
              simpleAmountWeisPath[1],
            ),
          ],
          [],
          {
            fromAccountNumber: originalAccountNumber,
            toAccountNumber: tradeAccountNumber,
            transferAmounts: [{ amountWei: par2, marketId: market2 }],
          },
          {
            expiryTimeDelta,
            marketId: expiryMarketId,
          },
          { from: traderOwner },
        );

        await checkMarginPositionLogs(txResult, true, simpleMarketIdPath, simpleAmountWeisPath);
        await checkExpiry(txResult, expiryMarketId, expiryTimeDelta);

        const [traderMarket1Balance, traderMarket2Balance, transferMarket1Balance, transferMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          ]);

        expect(traderMarket1Balance).to.eql(par1.negated());
        expect(traderMarket2Balance).to.eql(par2.times(3));

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a simple swap using external liquidity and no expiry', async () => {
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, simpleMarketIdPath[0], INTEGERS.ZERO);
        const txResult = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath,
          [
            getParaswapTraderParam(
              simpleMarketIdPath[0],
              simpleMarketIdPath[1],
              simpleAmountWeisPath[0],
              simpleAmountWeisPath[1],
            ),
          ],
          [],
          {
            fromAccountNumber: originalAccountNumber,
            toAccountNumber: tradeAccountNumber,
            transferAmounts: [{ amountWei: par2, marketId: market2 }],
          },
          {
            marketId: INTEGERS.ZERO,
            expiryTimeDelta: INTEGERS.ZERO,
          },
          { from: traderOwner },
        );

        await checkMarginPositionLogs(txResult, true, simpleMarketIdPath, simpleAmountWeisPath);
        await checkNoExpiry(simpleMarketIdPath[0]);

        const [traderMarket1Balance, traderMarket2Balance, transferMarket1Balance, transferMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          ]);

        expect(traderMarket1Balance).to.eql(par1.negated());
        expect(traderMarket2Balance).to.eql(par2.times(3));

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a simple swap using external liquidity to close position and no expiry', async () => {
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, simpleMarketIdPath[0], INTEGERS.ZERO);
        const txResult = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath,
          [
            getParaswapTraderParam(
              simpleMarketIdPath[0],
              simpleMarketIdPath[1],
              simpleAmountWeisPath[0],
              simpleAmountWeisPath[1],
            ),
          ],
          [],
          {
            fromAccountNumber: tradeAccountNumber,
            toAccountNumber: originalAccountNumber,
            transferAmounts: [{ amountWei: par2.times(2), marketId: market2 }],
          },
          {
            marketId: INTEGERS.ZERO,
            expiryTimeDelta: INTEGERS.ZERO,
          },
          { from: traderOwner },
        );

        await checkMarginPositionLogs(txResult, false, simpleMarketIdPath, simpleAmountWeisPath);
        await checkNoExpiry(simpleMarketIdPath[0]);

        const [traderMarket1Balance, traderMarket2Balance, transferMarket1Balance, transferMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          ]);

        expect(traderMarket1Balance).to.eql(par1.negated());
        expect(traderMarket2Balance).to.eql(INTEGERS.ZERO);

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(par2.times(3));
      });

      it('should succeed for a simple swap using internal liquidity', async () => {
        const expiryMarket = simpleMarketIdPath[0];
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, expiryMarket, INTEGERS.ZERO);
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        const result = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath,
          [await getInternalTraderParamAsync(0, simpleAmountWeisPath[1])],
          [{ owner: makerAccountOwner, number: makerAccountNumber1.toNumber() }],
          {
            fromAccountNumber: originalAccountNumber,
            toAccountNumber: tradeAccountNumber,
            transferAmounts: [{ amountWei: par2, marketId: market2 }],
          },
          {
            expiryTimeDelta,
            marketId: expiryMarket,
          },
          { from: traderOwner },
        );

        await checkMarginPositionLogs(result, true, simpleMarketIdPath, simpleAmountWeisPath);
        await checkExpiry(result, expiryMarket, expiryTimeDelta);

        const [
          traderMarket1Balance,
          traderMarket2Balance,
          transferMarket1Balance,
          transferMarket2Balance,
          makerMarket1Balance,
          makerMarket2Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market1),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market2),
        ]);

        expect(traderMarket1Balance).to.eql(par1.negated());
        expect(traderMarket2Balance).to.eql(par2.times(3));

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(INTEGERS.ZERO);

        expect(makerMarket1Balance).to.eql(par1.times(2));
        expect(makerMarket2Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a simple swap using unwrapper', async () => {
        const expiryMarket = market3;
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        const marketPath = [market3, market2];
        const amountsPath = [par3, par2];
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, expiryMarket, INTEGERS.ZERO);
        const result = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          marketPath,
          amountsPath,
          [await getUnwrapperTraderParam()],
          [],
          {
            fromAccountNumber: originalAccountNumber,
            toAccountNumber: tradeAccountNumber,
            transferAmounts: [{ amountWei: par2, marketId: market2 }],
          },
          {
            expiryTimeDelta,
            marketId: expiryMarket,
          },
          { from: traderOwner },
        );

        await checkMarginPositionLogs(result, true, marketPath, amountsPath);
        await checkExpiry(result, expiryMarket, expiryTimeDelta);

        const [traderMarket2Balance, traderMarket3Balance, transferMarket2Balance, transferMarket3Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market3),
          ]);

        expect(traderMarket2Balance).to.eql(par2.times(3)); // includes the transfer amount
        expect(traderMarket3Balance).to.eql(par3.negated());

        expect(transferMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(transferMarket3Balance).to.eql(par3);
      });

      it('should succeed for a simple swap using wrapper', async () => {
        const expiryMarket = market2;
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        const marketPath = [market2, market3];
        const amountsPath = [par2, par3];
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, expiryMarket, INTEGERS.ZERO);
        const result = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          marketPath,
          amountsPath,
          [await getWrapperTraderParam()],
          [],
          {
            fromAccountNumber: originalAccountNumber,
            toAccountNumber: tradeAccountNumber,
            transferAmounts: [{ amountWei: par3, marketId: market3 }],
          },
          {
            expiryTimeDelta,
            marketId: expiryMarket,
          },
          { from: traderOwner },
        );

        await checkMarginPositionLogs(result, true, marketPath, amountsPath);
        await checkExpiry(result, expiryMarket, expiryTimeDelta);

        const [traderMarket2Balance, traderMarket3Balance, transferMarket2Balance, transferMarket3Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market3),
          ]);

        expect(traderMarket2Balance).to.eql(par2.negated());
        expect(traderMarket3Balance).to.eql(par3.times(3));

        expect(transferMarket2Balance).to.eql(par2);
        expect(transferMarket3Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a simple swap that unwraps into a wrapper', async () => {
        const freshUnwrapper = await deployContract<TestLiquidityTokenUnwrapperTrader>(
          dolomiteMargin,
          testLiquidityTokenUnwrapperTraderJson,
          [token3, token4, dolomiteMargin.address],
        );
        await token3Contract.setTokenConverterTrusted(freshUnwrapper.options.address, true);
        await token4Contract.setTokenConverterTrusted(freshUnwrapper.options.address, true);

        const traderParam = getUnwrapperTraderParam();
        traderParam.trader = freshUnwrapper.options.address;

        const expiryMarket = market3;
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        const marketPath = [market3, market4];
        const amountsPath = [par3, par4];
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, expiryMarket, INTEGERS.ZERO);
        const result = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          marketPath,
          amountsPath,
          [traderParam],
          [],
          {
            fromAccountNumber: originalAccountNumber,
            toAccountNumber: tradeAccountNumber,
            transferAmounts: [{ amountWei: par4, marketId: market4 }],
          },
          {
            expiryTimeDelta,
            marketId: expiryMarket,
          },
          { from: traderOwner },
        );

        await checkMarginPositionLogs(result, true, marketPath, amountsPath);
        await checkExpiry(result, expiryMarket, expiryTimeDelta);

        const [traderMarket3Balance, traderMarket4Balance, transferMarket3Balance, transferMarket4Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market4),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market3),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market4),
          ]);

        expect(traderMarket3Balance).to.eql(par3.negated());
        expect(traderMarket4Balance).to.eql(par4.times(3));

        expect(transferMarket3Balance).to.eql(par3);
        expect(transferMarket4Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a larger swap using external liquidity', async () => {
        const expiryMarket = market1;
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        const marketPath = [market1, market2, market5];
        const amountsPath = [par1, par2, par5];
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, expiryMarket, INTEGERS.ZERO);
        const result = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          marketPath,
          amountsPath,
          [
            getParaswapTraderParam(marketPath[0], marketPath[1], amountsPath[0], amountsPath[1]),
            getParaswapTraderParam(marketPath[1], marketPath[2], amountsPath[1], amountsPath[2]),
          ],
          [],
          {
            fromAccountNumber: originalAccountNumber,
            toAccountNumber: tradeAccountNumber,
            transferAmounts: [{ amountWei: par5, marketId: market5 }],
          },
          {
            expiryTimeDelta,
            marketId: expiryMarket,
          },
          { from: traderOwner },
        );

        await checkMarginPositionLogs(result, true, marketPath, amountsPath);
        await checkExpiry(result, expiryMarket, expiryTimeDelta);

        const [market1Balance, market2Balance, market5Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market5),
        ]);

        expect(market1Balance).to.eql(par1.negated());
        expect(market2Balance).to.eql(par2);
        expect(market5Balance).to.eql(par5.times(3));
      });

      it('should succeed for a larger swap using internal liquidity', async () => {
        const marketPath = [market1, market2, market5, market6];
        const amountsPath = [par1, par2, par5, par6];
        const expiryMarket = market1;
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, expiryMarket, INTEGERS.ZERO);
        const result = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          marketPath,
          amountsPath,
          [
            await getInternalTraderParamAsync(0, par2, tradeId1),
            await getInternalTraderParamAsync(0, par5, tradeId2),
            await getInternalTraderParamAsync(1, par6, tradeId3),
          ],
          [
            { owner: makerAccountOwner, number: makerAccountNumber1.toNumber() },
            { owner: makerAccountOwner, number: makerAccountNumber2.toNumber() },
          ],
          {
            fromAccountNumber: originalAccountNumber,
            toAccountNumber: tradeAccountNumber,
            transferAmounts: [{ amountWei: par6, marketId: market6 }],
          },
          {
            expiryTimeDelta,
            marketId: expiryMarket,
          },
          { from: traderOwner },
        );

        await checkMarginPositionLogs(result, true, marketPath, amountsPath);
        await checkExpiry(result, expiryMarket, expiryTimeDelta);

        const [
          traderMarket1Balance,
          traderMarket2Balance,
          traderMarket5Balance,
          traderMarket6Balance,
          transferMarket1Balance,
          transferMarket2Balance,
          transferMarket5Balance,
          transferMarket6Balance,
          maker1Market1Balance,
          maker1Market2Balance,
          maker1Market5Balance,
          maker1Market6Balance,
          maker2Market1Balance,
          maker2Market2Balance,
          maker2Market5Balance,
          maker2Market6Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market5),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market6),

          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market5),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market6),

          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market1),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market2),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market5),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market6),

          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market1),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market2),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market5),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market6),
        ]);

        expect(traderMarket1Balance).to.eql(par1.negated());
        expect(traderMarket2Balance).to.eql(par2);
        expect(traderMarket5Balance).to.eql(par5);
        expect(traderMarket6Balance).to.eql(par6.times(3));

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(par2);
        expect(transferMarket5Balance).to.eql(par5);
        expect(transferMarket6Balance).to.eql(INTEGERS.ZERO);

        expect(maker1Market1Balance).to.eql(par1.times(2));
        expect(maker1Market2Balance).to.eql(par2);
        expect(maker1Market5Balance).to.eql(INTEGERS.ZERO);
        expect(maker1Market6Balance).to.eql(par6);

        expect(maker2Market1Balance).to.eql(par1);
        expect(maker2Market2Balance).to.eql(par2);
        expect(maker2Market5Balance).to.eql(par5.times(2));
        expect(maker2Market6Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a mega swap using all forms of liquidity', async () => {
        const expiryMarket = market1;
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        const marketPath = [market1, market2, market3, market2, market5, market6];
        const amountsPath = [par1, par2, par3, par2, par5, par6];
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, expiryMarket, INTEGERS.ZERO);
        const result = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          marketPath,
          amountsPath,
          [
            await getInternalTraderParamAsync(0, par2, tradeId1),
            await getWrapperTraderParam(),
            await getUnwrapperTraderParam(),
            await getInternalTraderParamAsync(1, par5, tradeId2),
            await getParaswapTraderParam(market5, market6, par5, par6),
          ],
          [
            { owner: makerAccountOwner, number: makerAccountNumber1.toNumber() },
            { owner: makerAccountOwner, number: makerAccountNumber2.toNumber() },
          ],
          {
            fromAccountNumber: originalAccountNumber,
            toAccountNumber: tradeAccountNumber,
            transferAmounts: [{ amountWei: par6, marketId: market6 }],
          },
          {
            expiryTimeDelta,
            marketId: expiryMarket,
          },
          { from: traderOwner },
        );

        await checkMarginPositionLogs(result, true, marketPath, amountsPath);
        await checkExpiry(result, expiryMarket, expiryTimeDelta);

        const [
          traderMarket1Balance,
          traderMarket2Balance,
          traderMarket3Balance,
          traderMarket5Balance,
          traderMarket6Balance,
          transferMarket1Balance,
          transferMarket2Balance,
          transferMarket3Balance,
          transferMarket5Balance,
          transferMarket6Balance,
          maker1Market1Balance,
          maker1Market2Balance,
          maker1Market3Balance,
          maker1Market5Balance,
          maker1Market6Balance,
          maker2Market1Balance,
          maker2Market2Balance,
          maker2Market3Balance,
          maker2Market5Balance,
          maker2Market6Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market5),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market6),

          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market3),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market5),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market6),

          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market1),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market2),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market3),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market5),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber1, market6),

          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market1),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market2),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market3),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market5),
          dolomiteMargin.getters.getAccountWei(makerAccountOwner, makerAccountNumber2, market6),
        ]);

        expect(traderMarket1Balance).to.eql(par1.negated());
        expect(traderMarket2Balance).to.eql(par2);
        expect(traderMarket3Balance).to.eql(par3);
        expect(traderMarket5Balance).to.eql(par5);
        expect(traderMarket6Balance).to.eql(par6.times(3));

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(par2);
        expect(transferMarket3Balance).to.eql(par3);
        expect(transferMarket5Balance).to.eql(par5);
        expect(transferMarket6Balance).to.eql(INTEGERS.ZERO);

        expect(maker1Market1Balance).to.eql(par1.times(2));
        expect(maker1Market2Balance).to.eql(INTEGERS.ZERO);
        expect(maker1Market3Balance).to.eql(par3);
        expect(maker1Market5Balance).to.eql(par5);
        expect(maker1Market6Balance).to.eql(par6);

        expect(maker2Market1Balance).to.eql(par1);
        expect(maker2Market2Balance).to.eql(par2.times(2));
        expect(maker2Market3Balance).to.eql(par3);
        expect(maker2Market5Balance).to.eql(INTEGERS.ZERO);
        expect(maker2Market6Balance).to.eql(par6);
      });
    });

    describe('Failure cases', () => {
      const defaultTransferAmount: GenericTransferCollateralAmounts = {
        marketId: market3,
        amountWei: par3,
      };

      const defaultTransferParam: GenericTransferCollateralParam = {
        fromAccountNumber: originalAccountNumber,
        toAccountNumber: tradeAccountNumber,
        transferAmounts: [defaultTransferAmount],
      };

      const defaultExpiryParam: GenericExpiryParam = {
        marketId: market2,
        expiryTimeDelta: defaultExpiryTimeDelta,
      };

      it('should fail when marketId path < 2', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyBase: Invalid market path length',
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyBase: Invalid market path length',
        );
      });

      it('should fail when first and last market are the same', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market1],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyBase: Duplicate markets in path',
        );
      });

      it('should fail when amounts do not match markets length', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            [par1],
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyBase: Invalid amounts path length',
        );
      });

      it('should fail when amount at any index is 0', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            [par1, INTEGERS.ZERO],
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyBase: Invalid amount at index <1>',
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            [INTEGERS.ZERO, par2],
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyBase: Invalid amount at index <0>',
        );
      });

      it('should fail when trader length is incorrect', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath,
            [],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyBase: Invalid traders params length',
        );
      });

      it('should fail when trader is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath,
            [traderWithInvalidAddress],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyBase: Invalid trader at index <0>',
        );
      });

      it('should fail when attempting to use a normal trader for an isolation mode token', async () => {
        const traderParam = getUnwrapperTraderParam();
        traderParam.traderType = GenericTraderType.ExternalLiquidity;
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market3, market2],
            simpleAmountWeisPath,
            [traderParam],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          `GenericTraderProxyBase: Invalid isolation mode unwrapper <${market3.toFixed()}, ${traderParam.traderType}>`,
        );
      });

      it('should fail when attempting to unwrap into an isolation mode token', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market3, market4],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          `GenericTraderProxyBase: Invalid unwrap sequence <${market3.toFixed()}, ${market4.toFixed()}>`,
        );
      });

      it('should fail when attempting to unwrap into an isolation mode token', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market4],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          `GenericTraderProxyBase: Invalid isolation mode wrapper <${market4.toFixed()}, ${
            GenericTraderType.ExternalLiquidity
          }>`,
        );
      });

      it('should fail when attempting to incorrectly set the trader type to be an unwrapper or wrapper for non-isolation mode', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          `GenericTraderProxyBase: Invalid trader type <${GenericTraderType.IsolationModeUnwrapper}>`,
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          `GenericTraderProxyBase: Invalid trader type <${GenericTraderType.IsolationModeWrapper}>`,
        );
      });

      it('should fail when the input for the unwrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market4, market2],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          `GenericTraderProxyBase: Invalid input for unwrapper <0, ${market4.toFixed()}>`,
        );
      });

      it('should fail when the output for the unwrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market3, market1],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          `GenericTraderProxyBase: Invalid output for unwrapper <1, ${market1.toFixed()}>`,
        );
      });

      it('should fail when the unwrapper trader is not trusted', async () => {
        await token3Contract.setTokenConverterTrusted(testLiquidityUnwrapper.options.address, false);
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market3, market2],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          `GenericTraderProxyBase: Unwrapper trader not enabled <${testLiquidityUnwrapper.options.address.toLowerCase()}, ${market3.toFixed()}>`,
        );
      });

      it('should fail when the input for the wrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market3],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          `GenericTraderProxyBase: Invalid input for wrapper <0, ${market1.toFixed()}>`,
        );
      });

      it('should fail when the output for the wrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market2, market4],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          `GenericTraderProxyBase: Invalid output for wrapper <1, ${market4.toFixed()}>`,
        );
      });

      it('should fail when the wrapper trader is not trusted', async () => {
        await token3Contract.setTokenConverterTrusted(testLiquidityWrapper.options.address, false);
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market2, market3],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          `GenericTraderProxyBase: Wrapper trader not enabled <${testLiquidityWrapper.options.address.toLowerCase()}, ${market3.toFixed()}>`,
        );
      });

      it('should fail when makerAccountIndex is >= makerAccounts.length and trader type is internal liquidity', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [await getInternalTraderParamAsync(0, par2)],
            [{ owner: ADDRESSES.ZERO, number: 0 }],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyBase: Invalid maker account owner <0>',
        );
      });

      it('should fail when the maker account is non-zero and trader type is external liquidity', async () => {
        const traderParam = getDefaultParaswapTraderParam();
        traderParam.makerAccountIndex = 1;
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [traderParam],
            [],
            defaultTransferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyBase: Invalid maker account owner <0>',
        );
      });

      it('should fail when the transfer amounts array is empty', async () => {
        const transferParam: GenericTransferCollateralParam = {
          fromAccountNumber: originalAccountNumber,
          toAccountNumber: tradeAccountNumber,
          transferAmounts: [],
        };
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
            transferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyV1: Invalid transfer amounts length',
        );
      });

      it('should fail when the transfer is to the same account number', async () => {
        const transferParam: GenericTransferCollateralParam = {
          fromAccountNumber: originalAccountNumber,
          toAccountNumber: originalAccountNumber,
          transferAmounts: [defaultTransferAmount],
        };
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
            transferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyV1: Cannot transfer to same account',
        );
      });

      it('should fail when the transfer account is not a trade account', async () => {
        const transferParam: GenericTransferCollateralParam = {
          fromAccountNumber: originalAccountNumber,
          toAccountNumber: originalAccountNumber.plus(4),
          transferAmounts: [defaultTransferAmount],
        };
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
            transferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyV1: Invalid trade account number',
        );
      });

      it('should fail when a transfer is is for an amount of 0', async () => {
        const transferAmount: GenericTransferCollateralAmounts = {
          marketId: market3,
          amountWei: INTEGERS.ZERO,
        };
        const transferParam: GenericTransferCollateralParam = {
          fromAccountNumber: tradeAccountNumber,
          toAccountNumber: originalAccountNumber,
          transferAmounts: [transferAmount],
        };
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [getDefaultParaswapTraderParam()],
            [],
            transferParam,
            defaultExpiryParam,
          ),
          'GenericTraderProxyV1: Invalid transfer amount at index <0>',
        );
      });
    });
  });
});

// ============ Helper Functions ============

const traderWithInvalidAddress: GenericTraderParam = {
  traderType: GenericTraderType.ExternalLiquidity,
  makerAccountIndex: 0,
  trader: ADDRESSES.ZERO,
  tradeData: ethers.utils.defaultAbiCoder.encode(['bytes'], ['0x0']),
};

function getUnwrapperTraderParam(): GenericTraderParam {
  return {
    traderType: GenericTraderType.IsolationModeUnwrapper,
    makerAccountIndex: 0,
    trader: testLiquidityUnwrapper.options.address,
    tradeData: ethers.utils.defaultAbiCoder.encode(['bytes'], ['0x0']),
  };
}

function getWrapperTraderParam(): GenericTraderParam {
  return {
    traderType: GenericTraderType.IsolationModeWrapper,
    makerAccountIndex: 0,
    trader: testLiquidityWrapper.options.address,
    tradeData: ethers.utils.defaultAbiCoder.encode(['bytes'], ['0x0']),
  };
}

async function getInternalTraderParamAsync(
  makerAccountIndex: number,
  amountOut: Integer,
  tradeId: Integer = new BigNumber('4321'),
): Promise<GenericTraderParam> {
  const data = {
    value: amountOut.negated(),
    denomination: AmountDenomination.Actual,
    reference: AmountReference.Delta,
  };
  await dolomiteMargin.testing.autoTrader.setData(tradeId, data);

  return {
    makerAccountIndex,
    traderType: GenericTraderType.InternalLiquidity,
    trader: dolomiteMargin.contracts.testAutoTrader.options.address,
    tradeData: ethers.utils.defaultAbiCoder.encode(['uint256'], [tradeId.toFixed()]),
  };
}

function getParaswapTraderParam(
  marketIn: Integer,
  marketOut: Integer,
  amountIn: Integer,
  amountOut: Integer,
): GenericTraderParam {
  const calldata = dolomiteMargin.contracts.testParaswapAugustusRouter.methods
    .call(
      marketIdToTokenMap[marketIn.toFixed()],
      amountIn.toFixed(),
      marketIdToTokenMap[marketOut.toFixed()],
      amountOut.toFixed(),
    )
    .encodeABI();
  return {
    traderType: GenericTraderType.ExternalLiquidity,
    makerAccountIndex: 0,
    trader: dolomiteMargin.contracts.testParaswapTrader.options.address,
    tradeData: calldata,
  };
}

function getDefaultParaswapTraderParam(): GenericTraderParam {
  const [marketIn, marketOut] = simpleMarketIdPath;
  const [amountIn, amountOut] = simpleAmountWeisPath;
  return getParaswapTraderParam(marketIn, marketOut, amountIn, amountOut);
}

async function setupMarkets() {
  const token3Contract = await deployContract<TestIsolationModeTokenContract>(
    dolomiteMargin,
    testIsolationModeTokenJson,
    ['Dolomite Isolation: Test Token 3', 'TEST3', 18],
  );
  const token4Contract = await deployContract<TestIsolationModeTokenContract>(
    dolomiteMargin,
    testIsolationModeTokenJson,
    ['Dolomite Isolation: Test Token 4', 'TEST4', 18],
  );
  const token5Contract = await deployContract<TestTokenContract>(dolomiteMargin, testTokenJson, [
    'Test Token 5',
    'TEST5',
    18,
  ]);
  const token6Contract = await deployContract<TestTokenContract>(dolomiteMargin, testTokenJson, [
    'Test Token 6',
    'TEST6',
    18,
  ]);

  const token1 = dolomiteMargin.testing.tokenA.address;
  const token2 = dolomiteMargin.testing.tokenB.address;
  const token3 = token3Contract.options.address;
  const token4 = token4Contract.options.address;
  const token5 = token5Contract.options.address;
  const token6 = token6Contract.options.address;

  await Promise.all([
    dolomiteMargin.testing.priceOracle.setPrice(token1, price1),
    dolomiteMargin.testing.priceOracle.setPrice(token2, price2),
    dolomiteMargin.testing.priceOracle.setPrice(token3, price3),
    dolomiteMargin.testing.priceOracle.setPrice(token4, price4),
    dolomiteMargin.testing.priceOracle.setPrice(token5, price5),
    dolomiteMargin.testing.priceOracle.setPrice(token6, price6),
  ]);

  const tokens = [token1, token2, token3, token4, token5, token6];

  for (let i = 0; i < tokens.length; i += 1) {
    await dolomiteMargin.admin.addMarket(
      tokens[i],
      dolomiteMargin.testing.priceOracle.address,
      dolomiteMargin.testing.interestSetter.address,
      defaultMarginPremium,
      defaultSpreadPremium,
      defaultMaxSupplyWei,
      defaultMaxBorrowWei,
      defaultEarningsRateOverride,
      defaultIsClosing,
      { from: accounts[0] },
    );
  }
}

async function checkMarginPositionLogs(
  txResult: TxResult,
  isOpen: boolean,
  marketPath: Integer[],
  amountPath: Integer[],
) {
  const logs = dolomiteMargin.logs.parseLogs(txResult).filter(log => {
    if (isOpen) {
      return log.name === 'MarginPositionOpen';
    }
    return log.name === 'MarginPositionClose';
  });
  expect(logs.length).to.eql(1);
  expect(logs[0].args.accountOwner).to.eql(traderOwner);
  expect(logs[0].args.accountNumber).to.eql(tradeAccountNumber);
  expect(logs[0].args.inputToken).to.eql(marketIdToTokenMap[marketPath[0].toFixed()]);
  expect(logs[0].args.outputToken).to.eql(marketIdToTokenMap[marketPath[marketPath.length - 1].toFixed()]);
  expect(
    isOpen ? logs[0].args.depositToken : logs[0].args.withdrawalToken,
  ).to.eql(marketIdToTokenMap[marketPath[marketPath.length - 1].toFixed()]);
  expect(logs[0].args.inputBalanceUpdate).to.eql({
    deltaWei: amountPath[0].negated(),
    newPar: amountPath[0].negated(),
  });
  if (isOpen) {
    expect(logs[0].args.outputBalanceUpdate).to.eql({
      deltaWei: amountPath[amountPath.length - 1].times(2),
      newPar: amountPath[amountPath.length - 1].times(3),
    });
    expect(logs[0].args.marginDepositUpdate).to.eql({
      deltaWei: amountPath[amountPath.length - 1].times(2),
      newPar: amountPath[amountPath.length - 1].times(3),
    });
  } else {
    expect(logs[0].args.outputBalanceUpdate).to.eql({
      deltaWei: amountPath[amountPath.length - 1].times(-1),
      newPar: INTEGERS.ZERO,
    });
    expect(logs[0].args.marginWithdrawalUpdate).to.eql({
      deltaWei: amountPath[amountPath.length - 1].times(-1),
      newPar: INTEGERS.ZERO,
    });
  }
}

async function checkExpiry(txResult: TxResult, marketId: Integer, expiryTimeDelta: Integer) {
  const block = await dolomiteMargin.web3.eth.getBlock(txResult.blockNumber);
  const expiry = await dolomiteMargin.expiry.getExpiry(traderOwner, tradeAccountNumber, marketId);
  expect(block.timestamp + expiryTimeDelta.toNumber()).to.eql(expiry.toNumber());
}

async function checkNoExpiry(marketId: Integer) {
  expect(await dolomiteMargin.expiry.getExpiry(traderOwner, tradeAccountNumber, marketId)).to.eql(INTEGERS.ZERO);
}
