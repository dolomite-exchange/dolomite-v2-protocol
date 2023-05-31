import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import * as testTokenJson from '../../build/contracts/CustomTestToken.json';
import * as testIsolationModeTokenJson from '../../build/contracts/TestIsolationModeToken.json';
import * as testIsolationModeUnwrapperTraderJson from '../../build/contracts/TestIsolationModeUnwrapperTrader.json';
import * as testIsolationModeWrapperTraderJson from '../../build/contracts/TestIsolationModeWrapperTrader.json';
import { CustomTestToken as TestTokenContract } from '../../build/testing_wrappers/CustomTestToken';
import { TestIsolationModeToken as TestIsolationModeTokenContract } from '../../build/testing_wrappers/TestIsolationModeToken';
import { TestIsolationModeUnwrapperTrader } from '../../build/testing_wrappers/TestIsolationModeUnwrapperTrader';
import { TestIsolationModeWrapperTrader } from '../../build/testing_wrappers/TestIsolationModeWrapperTrader';
import {
  address,
  ADDRESSES,
  AmountDenomination,
  AmountReference,
  ContractCallOptions,
  Integer,
  INTEGERS,
  TxResult,
} from '../../src';
import { GenericTraderParam, GenericTraderType } from '../../src/modules/GenericTraderProxyV1';
import { deployContract } from '../helpers/Deploy';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { fastForward, mineAvgBlock, resetEVM, snapshot } from '../helpers/EVM';
import { expectThrow } from '../helpers/Expect';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { TestIsolationModeToken } from '../modules/TestIsolationModeToken';
import { TestToken } from '../modules/TestToken';

let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
let admin: address;
let solidOwner: address;
let liquidOwner: address;
let makerOwner: address;
let operator: address;
let snapshotId: string;
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
let testIsolationModeUnwrapper: TestIsolationModeUnwrapperTrader;
let testIsolationModeWrapper: TestIsolationModeWrapperTrader;

const solidNumber = new BigNumber(111);
const liquidNumber = new BigNumber(222);
const makerNumber1 = new BigNumber(333);
const makerNumber2 = new BigNumber(444);
const market1 = INTEGERS.ZERO;
const market2 = INTEGERS.ONE;
const market3 = new BigNumber(2); // isolation mode
const market4 = new BigNumber(3); // isolation mode
const market5 = new BigNumber(4);
const market6 = new BigNumber(5);
const par = new BigNumber('1e18');
const par1 = par.times('2.5'); // $250; 2.5 units
const negPar = par.negated(); // -$250; -2.5 unit
const par2 = par.times('125'); // $250; 125 units
const par3 = par.times('250'); // $250; 250 units
const par4 = par.times('50'); // $250; 50 units
const par5 = par.times('65'); // $650; 65 units
const par6 = par.times('75'); // $750; 75 units
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
const defaultExpiryTimeDelta = new BigNumber(5); // 5 seconds

const simpleMarketIdPath = [market1, market2];
const simpleAmountWeisPath = [par1, par2];

describe('LiquidatorProxyV4WithGenericTrader', () => {
  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    solidOwner = dolomiteMargin.getDefaultAccount();
    liquidOwner = accounts[3];
    makerOwner = accounts[4];
    operator = accounts[6];

    await resetEVM();
    await setupMarkets();

    await Promise.all([
      dolomiteMargin.permissions.approveOperator(operator, { from: solidOwner }),
      dolomiteMargin.permissions.approveOperator(dolomiteMargin.testing.autoTrader.address, { from: makerOwner }),
    ]);

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

    testIsolationModeUnwrapper = await deployContract<TestIsolationModeUnwrapperTrader>(
      dolomiteMargin,
      testIsolationModeUnwrapperTraderJson,
      [token3, token2, dolomiteMargin.address],
    );
    testIsolationModeWrapper = await deployContract<TestIsolationModeWrapperTrader>(
      dolomiteMargin,
      testIsolationModeWrapperTraderJson,
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

    await token3Contract.setTokenConverterTrusted(testIsolationModeUnwrapper.options.address, true);
    await token3Contract.setTokenConverterTrusted(testIsolationModeWrapper.options.address, true);

    await Promise.all([
      token1Contract.issueTo(par1.times(1000), dolomiteMargin.address),
      token2Contract.issueTo(par2.times(1000), dolomiteMargin.address),
      token3Contract.issueTo(par3.times(1000), dolomiteMargin.address),
      token4Contract.issueTo(par4.times(1000), dolomiteMargin.address),
      token5Contract.issueTo(par5.times(1000), dolomiteMargin.address),
      token6Contract.issueTo(par6.times(1000), dolomiteMargin.address),
      dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par1),
      dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market2, par2),
      dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market3, par3),
      dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market4, par4),
      dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market5, par5),
      dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market6, par6),
      dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, par1),
      dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par2),
      dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, par3),
      dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, par4),
      dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, par5),
      dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, par6),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber1, market1, par1),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber1, market2, par2),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber1, market3, par3),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber1, market4, par4),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber1, market5, par5),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber1, market6, par6),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber2, market1, par1),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber2, market2, par2),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber2, market3, par3),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber2, market4, par4),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber2, market5, par5),
      dolomiteMargin.testing.setAccountBalance(makerOwner, makerNumber2, market6, par6),
    ]);

    await mineAvgBlock();

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('#MarginPositionRegistry', () => {
    it('should fail when not called by a global operator', async () => {
      await expectThrow(
        dolomiteMargin.contracts.callContractFunction(
          dolomiteMargin.contracts.marginPositionRegistry.methods.emitMarginPositionOpen(
            solidOwner,
            solidNumber.toFixed(),
            token1,
            token2,
            token2,
            { deltaWei: { sign: false, value: 0 }, newPar: { sign: false, value: 0 } },
            { deltaWei: { sign: false, value: 0 }, newPar: { sign: false, value: 0 } },
            { deltaWei: { sign: false, value: 0 }, newPar: { sign: false, value: 0 } },
          ),
          { from: solidOwner },
        ),
        `OnlyDolomiteMargin: Only global operator can call <${solidOwner.toLowerCase()}>`
      );
    });

    it('should fail when not called by a global operator', async () => {
      await expectThrow(
        dolomiteMargin.contracts.callContractFunction(
          dolomiteMargin.contracts.marginPositionRegistry.methods.emitMarginPositionClose(
            solidOwner,
            solidNumber.toFixed(),
            token1,
            token2,
            token2,
            { deltaWei: { sign: false, value: 0 }, newPar: { sign: false, value: 0 } },
            { deltaWei: { sign: false, value: 0 }, newPar: { sign: false, value: 0 } },
            { deltaWei: { sign: false, value: 0 }, newPar: { sign: false, value: 0 } },
          ),
          { from: solidOwner },
        ),
        `OnlyDolomiteMargin: Only global operator can call <${solidOwner.toLowerCase()}>`
      );
    });
  });

  describe('#liquidate', () => {
    const isOverCollateralized = false;
    const noExpiry = null;
    describe('Success cases', () => {
      it('should succeed for a simple swap using external liquidity', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar.times('2.25')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);
        const marketPath = [market2, market1];
        const amountWeisPath = [par.times('118.125'), par.times('2.3625')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketPath,
          amountWeisPath,
          [getParaswapTraderParam(marketPath[0], marketPath[1], amountWeisPath[0], amountWeisPath[1])],
          [],
          noExpiry,
          { from: operator },
        );

        const [solidMarket1Balance, solidMarket2Balance, liquidMarket1Balance, liquidMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),

            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          ]);

        expect(solidMarket1Balance).to.eql(par1.plus(amountWeisPath[1].minus(par.times('2.25'))));
        expect(solidMarket2Balance).to.eql(par2);

        expect(liquidMarket1Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket2Balance).to.eql(par2.minus(amountWeisPath[0]));
      });

      it('should succeed when there is a risk override', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar.times('2.4')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
          dolomiteMargin.testing.accountRiskOverrideSetter.setAccountRiskOverride(liquidOwner, new BigNumber('0.1'), new BigNumber('0.03')),
          dolomiteMargin.admin.setAccountRiskOverride(liquidOwner, dolomiteMargin.testing.accountRiskOverrideSetter.address, { from: admin }),
        ]);
        const marketPath = [market2, market1];
        const amountWeisPath = [par.times('123.6'), par.times('2.4720')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketPath,
          amountWeisPath,
          [getParaswapTraderParam(marketPath[0], marketPath[1], amountWeisPath[0], amountWeisPath[1])],
          [],
          noExpiry,
          { from: operator },
        );

        const [solidMarket1Balance, solidMarket2Balance, liquidMarket1Balance, liquidMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),

            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          ]);

        expect(solidMarket1Balance).to.eql(par1.plus(amountWeisPath[1].minus(par.times('2.40'))));
        expect(solidMarket2Balance).to.eql(par2);

        expect(liquidMarket1Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket2Balance).to.eql(par2.minus(amountWeisPath[0]));
      });

      it('should succeed for a simple swap when desired liquidation amount < max amount', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar.times('2.25')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);
        const marketPath = [market2, market1];
        const amountWeisPath = [
          par.times('52.5'), // heldAmountAdj
          par.times('1'), // owedAmount - NOT adjusted
        ];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketPath,
          amountWeisPath,
          [
            getParaswapTraderParam(
              marketPath[0],
              marketPath[1],
              amountWeisPath[0],
              amountWeisPath[0].times(price2).div(price1),
            ),
          ],
          [],
          noExpiry,
          { from: operator },
        );

        const [solidMarket1Balance, solidMarket2Balance, liquidMarket1Balance, liquidMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),

            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          ]);

        expect(solidMarket1Balance).to.eql(par1.plus(par.times('1.05').minus(amountWeisPath[1])));
        expect(solidMarket2Balance).to.eql(par2);

        expect(liquidMarket1Balance).to.eql(par1.negated().div(2));
        expect(liquidMarket2Balance).to.eql(par2.minus(amountWeisPath[0]));
      });

      it('should succeed when debt (adjusted) > collateral', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar.times('2.25')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par2.div(2)),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, par.times('12.5')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);

        const marketPath1 = [market2, market1];
        const amountWeisPath1 = [par2.div(2), INTEGERS.MAX_UINT];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketPath1,
          amountWeisPath1,
          [
            getParaswapTraderParam(
              marketPath1[0],
              marketPath1[1],
              amountWeisPath1[0],
              amountWeisPath1[0].times(price2).div(price1),
            ),
          ],
          [],
          noExpiry,
          { from: operator },
        );

        // liquidAccount.balanceOfMarket2 = -1.059523809523809523
        // 1.112499999999999999
        const marketPath2 = [market5, market1];
        const amountWeisPath2 = [par.times('11.125'), INTEGERS.MAX_UINT];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketPath2,
          amountWeisPath2,
          [
            getParaswapTraderParam(
              marketPath2[0],
              marketPath2[1],
              amountWeisPath2[0],
              amountWeisPath2[0].times(price5).div(price1),
            ),
          ],
          [],
          noExpiry,
          { from: operator },
        );

        const [
          solidMarket1Balance,
          solidMarket2Balance,
          solidMarket5Balance,
          liquidMarket1Balance,
          liquidMarket2Balance,
          liquidMarket5Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market5),

          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market5),
        ]);

        // Profit = (reward_% * debt) + par1
        // --> (0.05 * 2.25) + 2.5
        expect(solidMarket1Balance).to.eql(par1.plus(par.times('0.1125')));
        expect(solidMarket2Balance).to.eql(par2);
        expect(solidMarket5Balance).to.eql(par.times('64.999999999999999991')); // rounding

        expect(liquidMarket1Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket5Balance).to.eql(par.times('1.375000000000000009')); // rounding
      });

      it('should succeed for a simple swap using internal liquidity', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar.times('2.25')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);

        const marketPath = [market2, market1];
        const amountWeisPath = [par.times('118.125'), par.times('2.3625')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketPath,
          amountWeisPath,
          [await getInternalTraderParamAsync(0, amountWeisPath[1], tradeId1)],
          [{ owner: makerOwner, number: makerNumber1.toNumber() }],
          noExpiry,
          { from: operator },
        );

        const [
          solidMarket1Balance,
          solidMarket2Balance,
          liquidMarket1Balance,
          liquidMarket2Balance,
          makerMarket1Balance,
          makerMarket2Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market1),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market2),
        ]);

        expect(solidMarket1Balance).to.eql(par1.plus(par.times('0.1125')));
        expect(solidMarket2Balance).to.eql(par2);

        expect(liquidMarket1Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket2Balance).to.eql(par2.minus(par.times('118.125')));

        expect(makerMarket1Balance).to.eql(par1.minus(amountWeisPath[1]));
        expect(makerMarket2Balance).to.eql(par2.plus(amountWeisPath[0]));
      });

      it('should succeed for a simple swap using unwrapper', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, negPar.times('112.5')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);

        const marketIdsPath = [market3, market2];
        const amountWeisPath = [par.times('236.25'), par.times('118.125')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketIdsPath,
          amountWeisPath,
          [await getUnwrapperTraderParam()],
          [],
          noExpiry,
          { from: operator },
        );

        const [solidMarket2Balance, solidMarket3Balance, liquidMarket2Balance, liquidMarket3Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market3),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market3),
          ]);

        expect(solidMarket2Balance).to.eql(par2.plus(amountWeisPath[1].minus(par.times('112.5'))));
        expect(solidMarket3Balance).to.eql(par3);

        expect(liquidMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket3Balance).to.eql(par3.minus(amountWeisPath[0]));
      });

      it('should succeed for a simple swap using wrapper', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, negPar.times('225')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);

        const marketIdsPath = [market2, market3];
        const amountWeisPath = [par.times('118.125'), par.times('236.25')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketIdsPath,
          amountWeisPath,
          [await getWrapperTraderParam()],
          [],
          noExpiry,
          { from: operator },
        );

        const [solidMarket2Balance, solidMarket3Balance, liquidMarket2Balance, liquidMarket3Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market3),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market3),
          ]);

        expect(solidMarket2Balance).to.eql(par2);
        expect(solidMarket3Balance).to.eql(par3.plus(amountWeisPath[1].minus(par.times('225'))));

        expect(liquidMarket2Balance).to.eql(par2.minus(amountWeisPath[0]));
        expect(liquidMarket3Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a simple swap that unwraps into a wrapper', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, negPar.times('45')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);

        const freshUnwrapper = await deployContract<TestIsolationModeUnwrapperTrader>(
          dolomiteMargin,
          testIsolationModeUnwrapperTraderJson,
          [token3, token4, dolomiteMargin.address],
        );
        await token3Contract.setTokenConverterTrusted(freshUnwrapper.options.address, true);
        await token4Contract.setTokenConverterTrusted(freshUnwrapper.options.address, true);

        const marketIdsPath = [market3, market4];
        const amountWeisPath = [par.times('236.25'), par.times('47.25')];
        const traderParam = getUnwrapperTraderParam();
        traderParam.trader = freshUnwrapper.options.address;
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketIdsPath,
          amountWeisPath,
          [traderParam],
          [],
          noExpiry,
          { from: operator },
        );

        const [solidMarket3Balance, solidMarket4Balance, liquidMarket3Balance, liquidMarket4Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market3),
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market4),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market3),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market4),
          ]);

        expect(solidMarket3Balance).to.eql(par3);
        expect(solidMarket4Balance).to.eql(par4.plus(amountWeisPath[1].minus(par.times('45'))));

        expect(liquidMarket3Balance).to.eql(par3.minus(amountWeisPath[0]));
        expect(liquidMarket4Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a larger swap using external liquidity', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, negPar.times('22.5')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);

        const path = [market1, market2, market5];
        const amountWeisPath = [par.times('2.3625'), par.times('236.25'), par.times('23.625')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          path,
          amountWeisPath,
          [
            getParaswapTraderParam(path[0], path[1], amountWeisPath[0], amountWeisPath[1]),
            getParaswapTraderParam(path[1], path[2], amountWeisPath[1], amountWeisPath[2]),
          ],
          [],
          noExpiry,
          { from: operator },
        );

        const [
          solidMarket1Balance,
          solidMarket2Balance,
          solidMarket5Balance,
          liquidMarket1Balance,
          liquidMarket2Balance,
          liquidMarket5Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market5),

          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market5),
        ]);

        expect(solidMarket1Balance).to.eql(par1);
        expect(solidMarket2Balance).to.eql(par2);
        expect(solidMarket5Balance).to.eql(
          par5.plus(amountWeisPath[amountWeisPath.length - 1].minus(par.times('22.5'))),
        );

        expect(liquidMarket1Balance).to.eql(par1.minus(amountWeisPath[0]));
        expect(liquidMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket5Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a larger swap using internal liquidity', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, negPar.times('22.5')),
        ]);

        const marketIdsPath = [market1, market2, market5, market6];
        const amountWeisPath = [par.times('2.3625'), par.times('236.25'), par.times('47.25'), par.times('47.25')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketIdsPath,
          amountWeisPath,
          [
            await getInternalTraderParamAsync(0, amountWeisPath[1], tradeId1),
            await getInternalTraderParamAsync(0, amountWeisPath[2], tradeId2),
            await getInternalTraderParamAsync(1, amountWeisPath[3], tradeId3),
          ],
          [
            { owner: makerOwner, number: makerNumber1.toNumber() },
            { owner: makerOwner, number: makerNumber2.toNumber() },
          ],
          noExpiry,
          { from: operator },
        );

        const [
          solidMarket1Balance,
          solidMarket2Balance,
          solidMarket5Balance,
          solidMarket6Balance,
          liquidMarket1Balance,
          liquidMarket2Balance,
          liquidMarket5Balance,
          liquidMarket6Balance,
          maker1Market1Balance,
          maker1Market2Balance,
          maker1Market5Balance,
          maker1Market6Balance,
          maker2Market1Balance,
          maker2Market2Balance,
          maker2Market5Balance,
          maker2Market6Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market5),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market6),

          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market5),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market6),

          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market1),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market2),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market5),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market6),

          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market1),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market2),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market5),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market6),
        ]);

        expect(solidMarket1Balance).to.eql(par1);
        expect(solidMarket2Balance).to.eql(par2);
        expect(solidMarket5Balance).to.eql(par5);
        expect(solidMarket6Balance).to.eql(
          par6.plus(amountWeisPath[amountWeisPath.length - 1].minus(par.times('22.5'))),
        );

        expect(liquidMarket1Balance).to.eql(par1.minus(amountWeisPath[0]));
        expect(liquidMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket5Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket6Balance).to.eql(INTEGERS.ZERO);

        expect(maker1Market1Balance).to.eql(par1.plus(amountWeisPath[0]));
        expect(maker1Market2Balance).to.eql(par2);
        expect(maker1Market5Balance).to.eql(par5.minus(amountWeisPath[2]));
        expect(maker1Market6Balance).to.eql(par6);

        expect(maker2Market1Balance).to.eql(par1);
        expect(maker2Market2Balance).to.eql(par2);
        expect(maker2Market5Balance).to.eql(par5.plus(amountWeisPath[2]));
        expect(maker2Market6Balance).to.eql(par6.minus(amountWeisPath[3]));
      });

      it('should succeed for a mega swap using all forms of liquidity', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, negPar.times('22.5')),
        ]);

        const marketIdsPath = [market1, market2, market3, market2, market5, market6];
        const amountWeisPath = [
          par.times('2.3625'),
          par.times('118.125'),
          par.times('236.25'),
          par.times('118.125'),
          par.times('23.625'),
          par.times('23.625'),
        ];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketIdsPath,
          amountWeisPath,
          [
            await getInternalTraderParamAsync(0, amountWeisPath[1], tradeId1),
            await getWrapperTraderParam(),
            await getUnwrapperTraderParam(),
            await getInternalTraderParamAsync(1, amountWeisPath[4], tradeId2),
            await getParaswapTraderParam(market5, market6, amountWeisPath[4], amountWeisPath[5]),
          ],
          [
            { owner: makerOwner, number: makerNumber1.toNumber() },
            { owner: makerOwner, number: makerNumber2.toNumber() },
          ],
          noExpiry,
          { from: operator },
        );

        const [
          solidMarket1Balance,
          solidMarket2Balance,
          solidMarket3Balance,
          solidMarket5Balance,
          solidMarket6Balance,
          liquidMarket1Balance,
          liquidMarket2Balance,
          liquidMarket3Balance,
          liquidMarket5Balance,
          liquidMarket6Balance,
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
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market3),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market5),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market6),

          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market3),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market5),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market6),

          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market1),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market2),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market3),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market5),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market6),

          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market1),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market2),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market3),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market5),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market6),
        ]);

        expect(solidMarket1Balance).to.eql(par1);
        expect(solidMarket2Balance).to.eql(par2);
        expect(solidMarket3Balance).to.eql(par3);
        expect(solidMarket5Balance).to.eql(par5);
        expect(solidMarket6Balance).to.eql(
          par6.plus(amountWeisPath[amountWeisPath.length - 1].minus(par.times('22.5'))),
        );

        expect(liquidMarket1Balance).to.eql(par1.minus(amountWeisPath[0]));
        expect(liquidMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket3Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket5Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket6Balance).to.eql(INTEGERS.ZERO);

        expect(maker1Market1Balance).to.eql(par1.plus(amountWeisPath[0]));
        expect(maker1Market2Balance).to.eql(par2.minus(amountWeisPath[1]));
        expect(maker1Market3Balance).to.eql(par3);
        expect(maker1Market5Balance).to.eql(par5);
        expect(maker1Market6Balance).to.eql(par6);

        expect(maker2Market1Balance).to.eql(par1);
        expect(maker2Market2Balance).to.eql(par2.plus(amountWeisPath[3]));
        expect(maker2Market3Balance).to.eql(par3);
        expect(maker2Market5Balance).to.eql(par5.minus(amountWeisPath[4]));
        expect(maker2Market6Balance).to.eql(par6);
      });
    });

    describe('Failure cases', () => {
      it('should fail when marketId path < 2', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [],
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
            null,
          ),
          'GenericTraderProxyBase: Invalid market path length',
        );
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market1],
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
            null,
          ),
          'GenericTraderProxyBase: Invalid market path length',
        );
      });

      it('should fail when first and last market are the same', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market1, market1],
            simpleAmountWeisPath,
            [
              getParaswapTraderParam(
                simpleMarketIdPath[0],
                simpleMarketIdPath[0],
                simpleAmountWeisPath[0],
                simpleAmountWeisPath[1],
              ),
            ],
            [],
            null,
          ),
          'GenericTraderProxyBase: Duplicate markets in path',
        );
      });

      it('should fail when amounts do not match markets length', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            simpleMarketIdPath,
            [par1],
            [
              getParaswapTraderParam(
                simpleMarketIdPath[0],
                simpleMarketIdPath[1],
                simpleAmountWeisPath[0],
                simpleAmountWeisPath[1],
              ),
            ],
            [],
            null,
          ),
          'GenericTraderProxyBase: Invalid amounts path length',
        );
      });

      it('should fail when amount at any index is 0', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            simpleMarketIdPath,
            [par1, INTEGERS.ZERO],
            [getParaswapTraderParam(simpleMarketIdPath[0], simpleMarketIdPath[1], par1, INTEGERS.ZERO)],
            [],
            null,
          ),
          'GenericTraderProxyBase: Invalid amount at index <1>',
        );
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            simpleMarketIdPath,
            [INTEGERS.ZERO, par2],
            [
              getParaswapTraderParam(
                simpleMarketIdPath[0],
                simpleMarketIdPath[1],
                INTEGERS.ZERO,
                simpleAmountWeisPath[1],
              ),
            ],
            [],
            null,
          ),
          'GenericTraderProxyBase: Invalid amount at index <0>',
        );
      });

      it('should fail when trader length is incorrect', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath,
            [],
            [],
            null,
          ),
          'GenericTraderProxyBase: Invalid traders params length',
        );
      });

      it('should fail when trader is invalid', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath,
            [traderWithInvalidAddress],
            [],
            null,
          ),
          'GenericTraderProxyBase: Invalid trader at index <0>',
        );
      });

      it('should fail when attempting to use a normal trader for an isolation mode token', async () => {
        const traderParam = getUnwrapperTraderParam();
        traderParam.traderType = GenericTraderType.ExternalLiquidity;
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market3, market2],
            simpleAmountWeisPath,
            [traderParam],
            [],
            null,
          ),
          `GenericTraderProxyBase: Invalid isolation mode unwrapper <${market3.toFixed()}, ${traderParam.traderType}>`,
        );
      });

      it('should fail when attempting to unwrap into an isolation mode token', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market3, market4],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
            null,
          ),
          `GenericTraderProxyBase: Invalid unwrap sequence <${market3.toFixed()}, ${market4.toFixed()}>`,
        );
      });

      it('should fail when attempting to wrap using external liquidity', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market1, market4],
            simpleAmountWeisPath,
            [getParaswapTraderParam(market1, market4, par1, par4)],
            [],
            null,
          ),
          `GenericTraderProxyBase: Invalid isolation mode wrapper <${market4.toFixed()}, ${
            GenericTraderType.ExternalLiquidity
          }>`,
        );
      });

      it('should fail when attempting to incorrectly set the trader type to be an unwrapper or wrapper for non-isolation mode', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
            null,
          ),
          `GenericTraderProxyBase: Invalid trader type <${GenericTraderType.IsolationModeUnwrapper}>`,
        );
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
            null,
          ),
          `GenericTraderProxyBase: Invalid trader type <${GenericTraderType.IsolationModeWrapper}>`,
        );
      });

      it('should fail when the input for the unwrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market4, market2],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
            null,
          ),
          `GenericTraderProxyBase: Invalid input for unwrapper <0, ${market4.toFixed()}>`,
        );
      });

      it('should fail when the output for the unwrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market3, market1],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
            null,
          ),
          `GenericTraderProxyBase: Invalid output for unwrapper <1, ${market1.toFixed()}>`,
        );
      });

      it('should fail when the unwrapper trader is not trusted', async () => {
        await token3Contract.setTokenConverterTrusted(testIsolationModeUnwrapper.options.address, false);
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market3, market2],
            simpleAmountWeisPath,
            [getUnwrapperTraderParam()],
            [],
            null,
          ),
          `GenericTraderProxyBase: Unwrapper trader not enabled <${testIsolationModeUnwrapper.options.address.toLowerCase()}, ${market3.toFixed()}>`,
        );
      });

      it('should fail when the input for the wrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market1, market3],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
            null,
          ),
          `GenericTraderProxyBase: Invalid input for wrapper <0, ${market1.toFixed()}>`,
        );
      });

      it('should fail when the output for the wrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market2, market4],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
            null,
          ),
          `GenericTraderProxyBase: Invalid output for wrapper <1, ${market4.toFixed()}>`,
        );
      });

      it('should fail when the wrapper trader is not trusted', async () => {
        await token3Contract.setTokenConverterTrusted(testIsolationModeWrapper.options.address, false);
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market2, market3],
            simpleAmountWeisPath,
            [getWrapperTraderParam()],
            [],
            null,
          ),
          `GenericTraderProxyBase: Wrapper trader not enabled <${testIsolationModeWrapper.options.address.toLowerCase()}, ${market3.toFixed()}>`,
        );
      });

      it('should fail when makerAccountIndex is >= makerAccounts.length and trader type is internal liquidity', async () => {
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [await getInternalTraderParamAsync(0, par2, tradeId1)],
            [],
            null,
          ),
          'GenericTraderProxyBase: Invalid maker account owner <0>',
        );
      });

      it('should fail when the maker account is non-zero and trader type is external liquidity', async () => {
        const traderParam = getParaswapTraderParam(market1, market2, par1, par2);
        traderParam.makerAccountIndex = 1;
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
            [market1, market2],
            simpleAmountWeisPath,
            [traderParam],
            [],
            null,
          ),
          'GenericTraderProxyBase: Invalid maker account owner <0>',
        );
      });

      it('Fails for msg.sender is non-operator', async () => {
        await Promise.all([
          setUpBasicBalances(isOverCollateralized),
          dolomiteMargin.permissions.disapproveOperator(operator, { from: solidOwner }),
        ]);
        await expectThrow(
          liquidate([market2, market1], null, { from: operator }),
          `LiquidatorProxyBase: Sender not operator <${operator.toLowerCase()}>`,
        );
      });

      it('Fails if proxy is non-operator', async () => {
        await Promise.all([
          setUpBasicBalances(isOverCollateralized),
          dolomiteMargin.admin.setGlobalOperator(dolomiteMargin.liquidatorProxyV4WithGenericTrader.address, false, {
            from: admin,
          }),
        ]);
        await expectThrow(liquidate([market2, market1]), 'Storage: Unpermissioned global operator');
      });

      it('Fails if owed market is positive', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await expectThrow(
          liquidate([market1, market2]), // swap the two markets so owed = held
          `LiquidatorProxyBase: Owed market cannot be positive <${market2.toFixed()}>`,
        );
      });

      it('Fails for liquid account & held market is negative', async () => {
        await setUpBasicBalances(isOverCollateralized);
        await dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, new BigNumber(-1));
        await expectThrow(
          liquidate([market2, market1]),
          `LiquidatorProxyBase: Held market cannot be negative <${market2.toFixed()}>`,
        );
      });

      it('Fails for liquid account if not actually under collateralized', async () => {
        await setUpBasicBalances(true);
        await expectThrow(
          liquidate([market2, market1]),
          `LiquidateOrVaporizeImpl: Unliquidatable account <${liquidOwner.toLowerCase()}, ${liquidNumber.toFixed()}>`,
        );
      });

      it('should fail when expiration passed through is incorrect', async () => {
        await setUpBasicBalances(true);
        const realExpiry = await setUpExpiration(market1);
        const randomExpiry = new BigNumber('123123123');
        await expectThrow(
          liquidate([market2, market1], randomExpiry),
          `LiquidatorProxyBase: Expiry mismatch <${realExpiry.toFixed()}, ${randomExpiry.toFixed()}>`,
        );
      });
    });
  });

  describe('#expire', () => {
    describe('Success cases', () => {
      it('should succeed for a simple swap using external liquidity', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar.times('2.00')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);
        const expiry = await setUpExpiration(market1);
        const marketPath = [market2, market1];
        const amountWeisPath = [par.times('105'), par.times('2.1')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketPath,
          amountWeisPath,
          [getParaswapTraderParam(marketPath[0], marketPath[1], amountWeisPath[0], amountWeisPath[1])],
          [],
          expiry,
          { from: operator },
        );

        const [solidMarket1Balance, solidMarket2Balance, liquidMarket1Balance, liquidMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),

            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          ]);

        expect(solidMarket1Balance).to.eql(par1.plus(amountWeisPath[1].minus(par.times('2.00'))));
        expect(solidMarket2Balance).to.eql(par2);

        expect(liquidMarket1Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket2Balance).to.eql(par2.minus(amountWeisPath[0]));
      });

      it('should succeed for a simple swap using internal liquidity', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, negPar.times('2.00')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);

        const expiry = await setUpExpiration(market1);
        const marketPath = [market2, market1];
        const amountWeisPath = [par.times('105'), par.times('2.1')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketPath,
          amountWeisPath,
          [await getInternalTraderParamAsync(0, amountWeisPath[1], tradeId1)],
          [{ owner: makerOwner, number: makerNumber1.toNumber() }],
          expiry,
          { from: operator },
        );

        const [
          solidMarket1Balance,
          solidMarket2Balance,
          liquidMarket1Balance,
          liquidMarket2Balance,
          makerMarket1Balance,
          makerMarket2Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market1),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market2),
        ]);

        expect(solidMarket1Balance).to.eql(par1.plus(par.times('0.1')));
        expect(solidMarket2Balance).to.eql(par2);

        expect(liquidMarket1Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket2Balance).to.eql(par2.minus(par.times('105')));

        expect(makerMarket1Balance).to.eql(par1.minus(amountWeisPath[1]));
        expect(makerMarket2Balance).to.eql(par2.plus(amountWeisPath[0]));
      });

      it('should succeed for a simple swap using unwrapper', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, negPar.times('100')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);

        const expiry = await setUpExpiration(market2);
        const marketIdsPath = [market3, market2];
        const amountWeisPath = [par.times('210'), par.times('105')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketIdsPath,
          amountWeisPath,
          [await getUnwrapperTraderParam()],
          [],
          expiry,
          { from: operator },
        );

        const [solidMarket2Balance, solidMarket3Balance, liquidMarket2Balance, liquidMarket3Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market3),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market3),
          ]);

        expect(solidMarket2Balance).to.eql(par2.plus(amountWeisPath[1].minus(par.times('100'))));
        expect(solidMarket3Balance).to.eql(par3);

        expect(liquidMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket3Balance).to.eql(par3.minus(amountWeisPath[0]));
      });

      it('should succeed for a simple swap using wrapper', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, negPar.times('200')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);

        const expiry = await setUpExpiration(market3);
        const marketIdsPath = [market2, market3];
        const amountWeisPath = [par.times('105'), par.times('210')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketIdsPath,
          amountWeisPath,
          [await getWrapperTraderParam()],
          [],
          expiry,
          { from: operator },
        );

        const [solidMarket2Balance, solidMarket3Balance, liquidMarket2Balance, liquidMarket3Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market3),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market3),
          ]);

        expect(solidMarket2Balance).to.eql(par2);
        expect(solidMarket3Balance).to.eql(par3.plus(amountWeisPath[1].minus(par.times('200'))));

        expect(liquidMarket2Balance).to.eql(par2.minus(amountWeisPath[0]));
        expect(liquidMarket3Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a simple swap that unwraps into a wrapper', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market1, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, negPar.times('40')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);

        const freshUnwrapper = await deployContract<TestIsolationModeUnwrapperTrader>(
          dolomiteMargin,
          testIsolationModeUnwrapperTraderJson,
          [token3, token4, dolomiteMargin.address],
        );
        await token3Contract.setTokenConverterTrusted(freshUnwrapper.options.address, true);
        await token4Contract.setTokenConverterTrusted(freshUnwrapper.options.address, true);

        const expiry = await setUpExpiration(market4);
        const marketIdsPath = [market3, market4];
        const amountWeisPath = [par.times('210'), par.times('42')];
        const traderParam = getUnwrapperTraderParam();
        traderParam.trader = freshUnwrapper.options.address;
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketIdsPath,
          amountWeisPath,
          [traderParam],
          [],
          expiry,
          { from: operator },
        );

        const [solidMarket3Balance, solidMarket4Balance, liquidMarket3Balance, liquidMarket4Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market3),
            dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market4),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market3),
            dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market4),
          ]);

        expect(solidMarket3Balance).to.eql(par3);
        expect(solidMarket4Balance).to.eql(par4.plus(amountWeisPath[1].minus(par.times('40'))));

        expect(liquidMarket3Balance).to.eql(par3.minus(amountWeisPath[0]));
        expect(liquidMarket4Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a larger swap using external liquidity', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, negPar.times('20')),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, INTEGERS.ZERO),
        ]);

        const expiry = await setUpExpiration(market5);
        const path = [market1, market2, market5];
        const amountWeisPath = [par.times('2.1'), par.times('210'), par.times('21')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          path,
          amountWeisPath,
          [
            getParaswapTraderParam(path[0], path[1], amountWeisPath[0], amountWeisPath[1]),
            getParaswapTraderParam(path[1], path[2], amountWeisPath[1], amountWeisPath[2]),
          ],
          [],
          expiry,
          { from: operator },
        );

        const [
          solidMarket1Balance,
          solidMarket2Balance,
          solidMarket5Balance,
          liquidMarket1Balance,
          liquidMarket2Balance,
          liquidMarket5Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market5),

          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market5),
        ]);

        expect(solidMarket1Balance).to.eql(par1);
        expect(solidMarket2Balance).to.eql(par2);
        expect(solidMarket5Balance).to.eql(par5.plus(amountWeisPath[amountWeisPath.length - 1].minus(par.times('20'))));

        expect(liquidMarket1Balance).to.eql(par1.minus(amountWeisPath[0]));
        expect(liquidMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket5Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a larger swap using internal liquidity', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, negPar.times('20')),
        ]);

        const expiry = await setUpExpiration(market6);
        const marketIdsPath = [market1, market2, market5, market6];
        const amountWeisPath = [par.times('2.1'), par.times('210'), par.times('42'), par.times('42')];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketIdsPath,
          amountWeisPath,
          [
            await getInternalTraderParamAsync(0, amountWeisPath[1], tradeId1),
            await getInternalTraderParamAsync(0, amountWeisPath[2], tradeId2),
            await getInternalTraderParamAsync(1, amountWeisPath[3], tradeId3),
          ],
          [
            { owner: makerOwner, number: makerNumber1.toNumber() },
            { owner: makerOwner, number: makerNumber2.toNumber() },
          ],
          expiry,
          { from: operator },
        );

        const [
          solidMarket1Balance,
          solidMarket2Balance,
          solidMarket5Balance,
          solidMarket6Balance,
          liquidMarket1Balance,
          liquidMarket2Balance,
          liquidMarket5Balance,
          liquidMarket6Balance,
          maker1Market1Balance,
          maker1Market2Balance,
          maker1Market5Balance,
          maker1Market6Balance,
          maker2Market1Balance,
          maker2Market2Balance,
          maker2Market5Balance,
          maker2Market6Balance,
        ] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market5),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market6),

          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market5),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market6),

          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market1),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market2),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market5),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market6),

          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market1),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market2),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market5),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market6),
        ]);

        expect(solidMarket1Balance).to.eql(par1);
        expect(solidMarket2Balance).to.eql(par2);
        expect(solidMarket5Balance).to.eql(par5);
        expect(solidMarket6Balance).to.eql(par6.plus(amountWeisPath[amountWeisPath.length - 1].minus(par.times('20'))));

        expect(liquidMarket1Balance).to.eql(par1.minus(amountWeisPath[0]));
        expect(liquidMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket5Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket6Balance).to.eql(INTEGERS.ZERO);

        expect(maker1Market1Balance).to.eql(par1.plus(amountWeisPath[0]));
        expect(maker1Market2Balance).to.eql(par2);
        expect(maker1Market5Balance).to.eql(par5.minus(amountWeisPath[2]));
        expect(maker1Market6Balance).to.eql(par6);

        expect(maker2Market1Balance).to.eql(par1);
        expect(maker2Market2Balance).to.eql(par2);
        expect(maker2Market5Balance).to.eql(par5.plus(amountWeisPath[2]));
        expect(maker2Market6Balance).to.eql(par6.minus(amountWeisPath[3]));
      });

      it('should succeed for a mega swap using all forms of liquidity', async () => {
        await Promise.all([
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market3, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market4, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market5, INTEGERS.ZERO),
          dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market6, negPar.times('20')),
        ]);

        const expiry = await setUpExpiration(market6);
        const marketIdsPath = [market1, market2, market3, market2, market5, market6];
        const amountWeisPath = [
          par.times('2.1'),
          par.times('105'),
          par.times('210'),
          par.times('105'),
          par.times('21'),
          par.times('21'),
        ];
        await dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
          solidOwner,
          solidNumber,
          liquidOwner,
          liquidNumber,
          marketIdsPath,
          amountWeisPath,
          [
            await getInternalTraderParamAsync(0, amountWeisPath[1], tradeId1),
            await getWrapperTraderParam(),
            await getUnwrapperTraderParam(),
            await getInternalTraderParamAsync(1, amountWeisPath[4], tradeId2),
            await getParaswapTraderParam(market5, market6, amountWeisPath[4], amountWeisPath[5]),
          ],
          [
            { owner: makerOwner, number: makerNumber1.toNumber() },
            { owner: makerOwner, number: makerNumber2.toNumber() },
          ],
          expiry,
          { from: operator },
        );

        const [
          solidMarket1Balance,
          solidMarket2Balance,
          solidMarket3Balance,
          solidMarket5Balance,
          solidMarket6Balance,
          liquidMarket1Balance,
          liquidMarket2Balance,
          liquidMarket3Balance,
          liquidMarket5Balance,
          liquidMarket6Balance,
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
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market1),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market2),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market3),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market5),
          dolomiteMargin.getters.getAccountWei(solidOwner, solidNumber, market6),

          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market1),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market2),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market3),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market5),
          dolomiteMargin.getters.getAccountWei(liquidOwner, liquidNumber, market6),

          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market1),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market2),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market3),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market5),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber1, market6),

          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market1),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market2),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market3),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market5),
          dolomiteMargin.getters.getAccountWei(makerOwner, makerNumber2, market6),
        ]);

        expect(solidMarket1Balance).to.eql(par1);
        expect(solidMarket2Balance).to.eql(par2);
        expect(solidMarket3Balance).to.eql(par3);
        expect(solidMarket5Balance).to.eql(par5);
        expect(solidMarket6Balance).to.eql(par6.plus(amountWeisPath[amountWeisPath.length - 1].minus(par.times('20'))));

        expect(liquidMarket1Balance).to.eql(par1.minus(amountWeisPath[0]));
        expect(liquidMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket3Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket5Balance).to.eql(INTEGERS.ZERO);
        expect(liquidMarket6Balance).to.eql(INTEGERS.ZERO);

        expect(maker1Market1Balance).to.eql(par1.plus(amountWeisPath[0]));
        expect(maker1Market2Balance).to.eql(par2.minus(amountWeisPath[1]));
        expect(maker1Market3Balance).to.eql(par3);
        expect(maker1Market5Balance).to.eql(par5);
        expect(maker1Market6Balance).to.eql(par6);

        expect(maker2Market1Balance).to.eql(par1);
        expect(maker2Market2Balance).to.eql(par2.plus(amountWeisPath[3]));
        expect(maker2Market3Balance).to.eql(par3);
        expect(maker2Market5Balance).to.eql(par5.minus(amountWeisPath[4]));
        expect(maker2Market6Balance).to.eql(par6);
      });
    });

    describe('Failure cases', () => {
      it('should fail when expiry overflows', async () => {
        await dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par2.negated());
        const expiry = new BigNumber('5000000000');
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
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
            expiry,
          ),
          `LiquidatorProxyBase: Expiry overflows <${expiry.toFixed()}>`,
        );
      });

      it('should fail when position has not expired yet', async () => {
        await dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par2.negated());
        const expiry = new BigNumber('3000000000');
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
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
            expiry,
          ),
          `LiquidatorProxyBase: Borrow not yet expired <${expiry.toFixed()}>`,
        );
      });

      it('should fail when expiry does not match on-chain', async () => {
        await dolomiteMargin.testing.setAccountBalance(liquidOwner, liquidNumber, market2, par2.negated());
        const expiry = await setUpExpiration(market2);
        await expectThrow(
          dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
            solidOwner,
            solidNumber,
            liquidOwner,
            liquidNumber,
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
            expiry.minus(123),
          ),
          `LiquidatorProxyBase: Expiry mismatch <${expiry.toFixed()}, ${expiry.minus(123).toFixed()}>`,
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
  tradeData: ethers.utils.defaultAbiCoder.encode(['bytes'], [[]]),
};

function getUnwrapperTraderParam(): GenericTraderParam {
  return {
    traderType: GenericTraderType.IsolationModeUnwrapper,
    makerAccountIndex: 0,
    trader: testIsolationModeUnwrapper.options.address,
    tradeData: ethers.utils.defaultAbiCoder.encode(['bytes'], [[]]),
  };
}

function getWrapperTraderParam(): GenericTraderParam {
  return {
    traderType: GenericTraderType.IsolationModeWrapper,
    makerAccountIndex: 0,
    trader: testIsolationModeWrapper.options.address,
    tradeData: ethers.utils.defaultAbiCoder.encode(['bytes'], [[]]),
  };
}

async function getInternalTraderParamAsync(
  makerAccountIndex: number,
  amountOut: Integer,
  tradeId: Integer,
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

async function setUpBasicBalances(isOverCollateralized: boolean) {
  await Promise.all([
    dolomiteMargin.testing.setAccountBalance(solidOwner, solidNumber, market1, par1),

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
  timeDelta: Integer = defaultExpiryTimeDelta,
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
    await fastForward(timeDelta.toNumber() + 60 * 60 * 24);
  }

  return dolomiteMargin.expiry.getExpiry(liquidOwner, liquidNumber, market);
}

async function liquidate(
  markets: Integer[],
  expiration: Integer | null = null,
  options?: ContractCallOptions,
): Promise<TxResult> {
  return dolomiteMargin.liquidatorProxyV4WithGenericTrader.liquidate(
    solidOwner,
    solidNumber,
    liquidOwner,
    liquidNumber,
    markets,
    simpleAmountWeisPath,
    [
      getParaswapTraderParam(
        markets[0],
        markets[markets.length - 1],
        simpleAmountWeisPath[0],
        simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
      ),
    ],
    [],
    expiration,
    options,
  );
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
