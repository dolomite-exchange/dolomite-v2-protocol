import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import * as testTokenJson from '../../build/contracts/CustomTestToken.json';
import * as testIsolationModeTokenJson from '../../build/contracts/TestIsolationModeToken.json';
import * as testIsolationModeUnwrapperTraderV2Json from '../../build/contracts/TestIsolationModeUnwrapperTraderV2.json';
import * as testIsolationModeWrapperTraderV2Json from '../../build/contracts/TestIsolationModeWrapperTraderV2.json';
import { CustomTestToken as TestTokenContract } from '../../build/testing_wrappers/CustomTestToken';
import { TestIsolationModeToken as TestIsolationModeTokenContract } from '../../build/testing_wrappers/TestIsolationModeToken';
import { TestIsolationModeUnwrapperTraderV2 } from '../../build/testing_wrappers/TestIsolationModeUnwrapperTraderV2';
import { TestIsolationModeWrapperTraderV2 } from '../../build/testing_wrappers/TestIsolationModeWrapperTraderV2';
import {
  address,
  ADDRESSES,
  AmountDenomination,
  AmountReference,
  BalanceCheckFlag,
  Integer,
  INTEGERS,
  TxResult,
} from '../../src';
import {
  GenericEventEmissionType,
  GenericExpiryParam,
  GenericTraderParam,
  GenericTraderType,
  GenericTransferCollateralAmounts,
  GenericTransferCollateralParam,
  GenericUserConfig,
} from '../../src/modules/GenericTraderProxyV1';
import { deployContract } from '../helpers/Deploy';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { setGlobalOperator } from '../helpers/DolomiteMarginHelpers';
import { mineAvgBlock, resetEVM, setTime, snapshot } from '../helpers/EVM';
import { expectThrow } from '../helpers/Expect';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { TestIsolationModeToken } from '../modules/TestIsolationModeToken';
import { TestToken } from '../modules/TestToken';

let dolomiteMargin: TestDolomiteMargin;
let admin: string;
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
let testIsolationModeUnwrapper: TestIsolationModeUnwrapperTraderV2;
let testIsolationModeWrapper: TestIsolationModeWrapperTraderV2;

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
const defaultMaxWei = INTEGERS.ZERO;
const defaultIsClosing = false;
const defaultIsRecyclable = false;
const marketIdToTokenMap = {};
const defaultExpiryTimeDelta = new BigNumber(60 * 60); // 1 hour
const defaultUserConfig: GenericUserConfig = {
  deadline: 123123123123,
  balanceCheckFlag: BalanceCheckFlag.None,
  eventType: GenericEventEmissionType.MarginPosition,
};

const simpleMarketIdPath = [market1, market2];
const simpleAmountWeisPath = [par1, par2];

describe('GenericTraderProxyV1', () => {
  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = r.accounts[0];
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

    testIsolationModeUnwrapper = await deployContract<TestIsolationModeUnwrapperTraderV2>(
      dolomiteMargin,
      testIsolationModeUnwrapperTraderV2Json,
      [token3, token2, dolomiteMargin.address],
    );
    testIsolationModeWrapper = await deployContract<TestIsolationModeWrapperTraderV2>(
      dolomiteMargin,
      testIsolationModeWrapperTraderV2Json,
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
      dolomiteMargin.contracts.callContractFunction(
        testIsolationModeUnwrapper.methods.setVault(traderOwner, true),
      ),
      token1Contract.issueTo(par1.times(1000), dolomiteMargin.address),
      token2Contract.issueTo(par2.times(1000), dolomiteMargin.address),
      token3Contract.issueTo(par3.times(1000), dolomiteMargin.address),
      token4Contract.issueTo(par4.times(1000), dolomiteMargin.address),
      token5Contract.issueTo(par5.times(1000), dolomiteMargin.address),
      token6Contract.issueTo(par6.times(1000), dolomiteMargin.address),
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

  describe('#ownerSetEventEmitterRegistry', () => {
    it('should work normally', async () => {
      await dolomiteMargin.genericTraderProxyV1.ownerSetEventEmitterRegistry(token1, { from: admin });
      expect(await dolomiteMargin.genericTraderProxyV1.eventEmitterRegistry()).to.eql(token1);
    });

    it('should work when the token does not have a #name function', async () => {
      await expectThrow(
        dolomiteMargin.genericTraderProxyV1.ownerSetEventEmitterRegistry(token1, { from: traderOwner }),
        `OnlyDolomiteMargin: Only Dolomite owner can call <${traderOwner.toLowerCase()}>`,
      );
    });
  });

  describe('#swapExactInputForOutput', () => {
    describe('Success cases', () => {
      it('should succeed for a simple swap using external liquidity', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          originalAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
          [
            getParaswapTraderParam(
              simpleMarketIdPath[0],
              simpleMarketIdPath[1],
              simpleAmountWeisPath[0],
              simpleAmountWeisPath[1],
            ),
          ],
          [],
          defaultUserConfig,
          { from: traderOwner },
        );

        const [market1Balance, market2Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
        ]);

        expect(market1Balance).to.eql(INTEGERS.ZERO);
        expect(market2Balance).to.eql(par2.times(2));
      });

      it('should succeed for a simple swap when balance check flag is set to Both', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          originalAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
          [
            getParaswapTraderParam(
              simpleMarketIdPath[0],
              simpleMarketIdPath[1],
              simpleAmountWeisPath[0],
              simpleAmountWeisPath[1],
            ),
          ],
          [],
          { ...defaultUserConfig, balanceCheckFlag: BalanceCheckFlag.Both },
          { from: traderOwner },
        );

        const [market1Balance, market2Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
        ]);

        expect(market1Balance).to.eql(INTEGERS.ZERO);
        expect(market2Balance).to.eql(par2.times(2));
      });

      it('should succeed for a simple swap when balance check flag is set to From', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          originalAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
          [
            getParaswapTraderParam(
              simpleMarketIdPath[0],
              simpleMarketIdPath[1],
              simpleAmountWeisPath[0],
              simpleAmountWeisPath[1],
            ),
          ],
          [],
          { ...defaultUserConfig, balanceCheckFlag: BalanceCheckFlag.From },
          { from: traderOwner },
        );

        const [market1Balance, market2Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
        ]);

        expect(market1Balance).to.eql(INTEGERS.ZERO);
        expect(market2Balance).to.eql(par2.times(2));
      });

      it('should succeed for a simple swap using internal liquidity', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          originalAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
          [await getInternalTraderParamAsync(0, simpleAmountWeisPath[0], simpleAmountWeisPath[1])],
          [{ owner: makerAccountOwner, number: makerAccountNumber1.toNumber() }],
          defaultUserConfig,
          { from: traderOwner },
        );

        const [traderMarket1Balance, traderMarket2Balance, makerMarket1Balance, makerMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
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
          originalAccountNumber,
          [market3, market2],
          par3,
          par2,
          [await getUnwrapperTraderParam()],
          [],
          defaultUserConfig,
          { from: traderOwner },
        );

        const [traderMarket2Balance, traderMarket3Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market3),
        ]);

        expect(traderMarket2Balance).to.eql(par2.plus(par3.div(2)));
        expect(traderMarket3Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a simple swap using wrapper', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          originalAccountNumber,
          [market2, market3],
          par2,
          par3,
          [await getWrapperTraderParam()],
          [],
          defaultUserConfig,
          { from: traderOwner },
        );

        const [traderMarket2Balance, traderMarket3Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market3),
        ]);

        expect(traderMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket3Balance).to.eql(par3.times(2));
      });

      it('should succeed for a simple swap that unwraps into a wrapper', async () => {
        const freshUnwrapper = await deployContract<TestIsolationModeUnwrapperTraderV2>(
          dolomiteMargin,
          testIsolationModeUnwrapperTraderV2Json,
          [token3, token4, dolomiteMargin.address],
        );
        await dolomiteMargin.contracts.callContractFunction(
          freshUnwrapper.methods.setVault(traderOwner, true),
        );
        await token3Contract.setTokenConverterTrusted(freshUnwrapper.options.address, true);
        await token4Contract.setTokenConverterTrusted(freshUnwrapper.options.address, true);

        const traderParam = getUnwrapperTraderParam();
        traderParam.trader = freshUnwrapper.options.address;
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          originalAccountNumber,
          [market3, market4],
          par3,
          par4,
          [traderParam],
          [],
          defaultUserConfig,
          { from: traderOwner },
        );

        const [traderMarket3Balance, traderMarket4Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market3),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market4),
        ]);

        expect(traderMarket3Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket4Balance).to.eql(par4.times(2));
      });

      it('should succeed for a larger swap using external liquidity', async () => {
        const path = [market1, market2, market5];
        const amounts = [par1, par2, par5];
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          originalAccountNumber,
          path,
          amounts[0],
          amounts[amounts.length - 1],
          [
            getParaswapTraderParam(path[0], path[1], amounts[0], amounts[1]),
            getParaswapTraderParam(path[1], path[2], amounts[1], amounts[2]),
          ],
          [],
          defaultUserConfig,
          { from: traderOwner },
        );

        const [market1Balance, market2Balance, market5Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market5),
        ]);

        expect(market1Balance).to.eql(INTEGERS.ZERO);
        expect(market2Balance).to.eql(par2);
        expect(market5Balance).to.eql(par5.times(2));
      });

      it('should succeed for a larger swap using internal liquidity', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          originalAccountNumber,
          [market1, market2, market5, market6],
          par1,
          par6,
          [
            await getInternalTraderParamAsync(0, par1, par2, tradeId1),
            await getInternalTraderParamAsync(0, par2, par5, tradeId2),
            await getInternalTraderParamAsync(1, par5, par6, tradeId3),
          ],
          [
            { owner: makerAccountOwner, number: makerAccountNumber1.toNumber() },
            { owner: makerAccountOwner, number: makerAccountNumber2.toNumber() },
          ],
          defaultUserConfig,
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
          originalAccountNumber,
          [market3, market2, market1, market5, market2, market3],
          par3,
          par3,
          [
            await getUnwrapperTraderParam(),
            await getInternalTraderParamAsync(0, par2, par1, tradeId1),
            await getInternalTraderParamAsync(1, par1, par5, tradeId2),
            await getParaswapTraderParam(market5, market2, par5, par2.times(1.1)),
            await getWrapperTraderParam(),
          ],
          [
            { owner: makerAccountOwner, number: makerAccountNumber1.toNumber() },
            { owner: makerAccountOwner, number: makerAccountNumber2.toNumber() },
          ],
          defaultUserConfig,
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

        expect(traderMarket1Balance).to.eql(par1);
        expect(traderMarket2Balance).to.eql(par2);
        expect(traderMarket3Balance).to.eql(par3.times(1.1));
        expect(traderMarket5Balance).to.eql(par5);
        expect(traderMarket6Balance).to.eql(par6);

        expect(maker1Market1Balance).to.eql(INTEGERS.ZERO);
        expect(maker1Market2Balance).to.eql(par2.times(2));
        expect(maker1Market3Balance).to.eql(par3);
        expect(maker1Market5Balance).to.eql(par5);
        expect(maker1Market6Balance).to.eql(par6);

        expect(maker2Market1Balance).to.eql(par1.times(2));
        expect(maker2Market2Balance).to.eql(par2);
        expect(maker2Market3Balance).to.eql(par3);
        expect(maker2Market5Balance).to.eql(INTEGERS.ZERO);
        expect(maker2Market6Balance).to.eql(par6);
      });

      it("should succeed when a swap wants to use all of the trader's balance", async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          originalAccountNumber,
          simpleMarketIdPath,
          INTEGERS.MAX_UINT,
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
          [
            getParaswapTraderParam(
              simpleMarketIdPath[0],
              simpleMarketIdPath[1],
              simpleAmountWeisPath[0],
              simpleAmountWeisPath[1],
            ),
          ],
          [],
          defaultUserConfig,
          { from: traderOwner },
        );

        const [market1Balance, market2Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
        ]);

        expect(market1Balance).to.eql(INTEGERS.ZERO);
        expect(market2Balance).to.eql(par2.times(2));
      });
    });

    describe('Failure cases', () => {
      it('should fail when deadline has passed', async () => {
        const deadline = 1;
        const timestamp = Date.now();
        await setTime(timestamp);
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            { ...defaultUserConfig, deadline },
          ),
          `GenericTraderProxyV1: Deadline expired <${deadline}, ${Math.floor(timestamp / 1000)}>`,
        );
      });

      it('should fail when balance goes negative for BalanceCheckFlags', async () => {
        const accountString = `${traderOwner.toLowerCase()}, ${tradeAccountNumber.toFixed()}, ${simpleMarketIdPath[0].toFixed()}`;
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0].times(2),
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            { ...defaultUserConfig, balanceCheckFlag: BalanceCheckFlag.From },
          ),
          `AccountBalanceLib: account cannot go negative <${accountString}>`,
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0].times(2),
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            { ...defaultUserConfig, balanceCheckFlag: BalanceCheckFlag.Both },
          ),
          `AccountBalanceLib: account cannot go negative <${accountString}>`,
        );
      });

      it('should fail when marketId path < 2', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            defaultUserConfig,
          ),
          'GenericTraderProxyBase: Invalid market path length',
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            defaultUserConfig,
          ),
          'GenericTraderProxyBase: Invalid market path length',
        );
      });

      it('should fail when input or output amount is 0', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            par1,
            INTEGERS.ZERO,
            [getDefaultParaswapTraderParam()],
            [],
            defaultUserConfig,
          ),
          'GenericTraderProxyBase: Invalid minOutputAmountWei',
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            INTEGERS.ZERO,
            par2,
            [getDefaultParaswapTraderParam()],
            [],
            defaultUserConfig,
          ),
          'GenericTraderProxyBase: Invalid inputAmountWei',
        );
      });

      it('should fail when trader length is incorrect', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [],
            [],
            defaultUserConfig,
          ),
          'GenericTraderProxyBase: Invalid traders params length',
        );
      });

      it('should fail when trader is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [traderWithInvalidAddress],
            [],
            defaultUserConfig,
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
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [traderParam],
            [],
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid isolation mode unwrapper <${market3.toFixed()}, ${traderParam.traderType}>`,
        );
      });

      it('should fail when attempting to unwrap into an isolation mode token', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market3, market4],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getUnwrapperTraderParam()],
            [],
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid unwrap sequence <${market3.toFixed()}, ${market4.toFixed()}>`,
        );
      });

      it('should fail when attempting to unwrap into an isolation mode token', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1, market4],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            defaultUserConfig,
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
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getUnwrapperTraderParam()],
            [],
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid trader type <${GenericTraderType.IsolationModeUnwrapper}>`,
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getWrapperTraderParam()],
            [],
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid trader type <${GenericTraderType.IsolationModeWrapper}>`,
        );
      });

      it('should fail when the input for the unwrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market4, market2],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getUnwrapperTraderParam()],
            [],
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid input for unwrapper <0, ${market4.toFixed()}>`,
        );
      });

      it('should fail when the output for the unwrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market3, market1],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getUnwrapperTraderParam()],
            [],
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid output for unwrapper <1, ${market1.toFixed()}>`,
        );
      });

      it('should fail when the unwrapper trader is not trusted', async () => {
        await token3Contract.setTokenConverterTrusted(testIsolationModeUnwrapper.options.address, false);
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market3, market2],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getUnwrapperTraderParam()],
            [],
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Unwrapper trader not enabled <${testIsolationModeUnwrapper.options.address.toLowerCase()}, ${market3.toFixed()}>`,
        );
      });

      it('should fail when the input for the wrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1, market3],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getWrapperTraderParam()],
            [],
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid input for wrapper <0, ${market1.toFixed()}>`,
        );
      });

      it('should fail when the output for the wrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market2, market4],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getWrapperTraderParam()],
            [],
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid output for wrapper <1, ${market4.toFixed()}>`,
        );
      });

      it('should fail when the wrapper trader is not trusted', async () => {
        await token3Contract.setTokenConverterTrusted(testIsolationModeWrapper.options.address, false);
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market2, market3],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getWrapperTraderParam()],
            [],
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Wrapper trader not enabled <${testIsolationModeWrapper.options.address.toLowerCase()}, ${market3.toFixed()}>`,
        );
      });

      it('should fail when makerAccountIndex is >= makerAccounts.length and trader type is internal liquidity', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [await getInternalTraderParamAsync(0, simpleAmountWeisPath[0], simpleAmountWeisPath[1])],
            [{ owner: ADDRESSES.ZERO, number: makerAccountNumber1.toNumber() }],
            defaultUserConfig,
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
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [traderParam],
            [],
            defaultUserConfig,
          ),
          'GenericTraderProxyBase: Invalid maker account owner <0>',
        );
      });

      it('should fail when the balance is negative and attempting to trade all', async () => {
        const amountPath = [par1.times(2), par2.times(2)];
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
          originalAccountNumber,
          simpleMarketIdPath,
          amountPath[0],
          amountPath[1],
          [getParaswapTraderParam(simpleMarketIdPath[0], simpleMarketIdPath[1], amountPath[0], amountPath[1])],
          [],
          defaultUserConfig,
          { from: traderOwner },
        );

        const [market1Balance, market2Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
        ]);

        expect(market1Balance).to.eql(par1.times(-1));
        expect(market2Balance).to.eql(par2.times(3));

        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutput(
            originalAccountNumber,
            simpleMarketIdPath,
            INTEGERS.MAX_UINT,
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [
              getParaswapTraderParam(
                simpleMarketIdPath[0],
                simpleMarketIdPath[1],
                simpleAmountWeisPath[0],
                simpleAmountWeisPath[1],
              ),
            ],
            [],
            defaultUserConfig,
            { from: traderOwner },
          ),
          `GenericTraderProxyV1: Balance must be positive <${simpleMarketIdPath[0]}>`,
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
        await dolomiteMargin.testing.setAccountBalance(traderOwner, originalAccountNumber, market2, INTEGERS.ZERO);
        const txResult = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
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
          defaultUserConfig,
          { from: traderOwner },
        );

        await checkEventEmissionLogs(
          txResult,
          true,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
          defaultUserConfig.eventType,
        );
        await checkExpiry(txResult, expiryMarketId, expiryTimeDelta);

        const [traderMarket1Balance, traderMarket2Balance, transferMarket1Balance, transferMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          ]);

        expect(traderMarket1Balance).to.eql(par1.negated());
        expect(traderMarket2Balance).to.eql(par2.times(2));

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(par2.negated());
      });

      it('should succeed for a simple swap that opens a borrow position', async () => {
        const expiryMarketId = simpleMarketIdPath[0];
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, expiryMarketId, INTEGERS.ZERO);
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        await dolomiteMargin.testing.setAccountBalance(traderOwner, originalAccountNumber, market2, INTEGERS.ZERO);
        const txResult = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
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
          {
            ...defaultUserConfig,
            eventType: GenericEventEmissionType.BorrowPosition,
          },
          { from: traderOwner },
        );

        await checkEventEmissionLogs(
          txResult,
          true,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
          GenericEventEmissionType.BorrowPosition,
        );
        await checkExpiry(txResult, expiryMarketId, expiryTimeDelta);

        const [traderMarket1Balance, traderMarket2Balance, transferMarket1Balance, transferMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          ]);

        expect(traderMarket1Balance).to.eql(par1.negated());
        expect(traderMarket2Balance).to.eql(par2.times(2));

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(par2.negated());
      });

      it('should succeed for a simple swap that does not emit any logs', async () => {
        const expiryMarketId = simpleMarketIdPath[0];
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, expiryMarketId, INTEGERS.ZERO);
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        await dolomiteMargin.testing.setAccountBalance(traderOwner, originalAccountNumber, market2, INTEGERS.ZERO);
        const txResult = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
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
          {
            ...defaultUserConfig,
            eventType: GenericEventEmissionType.None,
          },
          { from: traderOwner },
        );

        await checkEventEmissionLogs(
          txResult,
          true,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
          GenericEventEmissionType.None,
        );
        await checkExpiry(txResult, expiryMarketId, expiryTimeDelta);

        const [traderMarket1Balance, traderMarket2Balance, transferMarket1Balance, transferMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          ]);

        expect(traderMarket1Balance).to.eql(par1.negated());
        expect(traderMarket2Balance).to.eql(par2.times(2));

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(par2.negated());
      });

      it('should succeed for a simple swap using external liquidity and no expiry', async () => {
        await dolomiteMargin.testing.setAccountBalance(
          traderOwner,
          tradeAccountNumber,
          simpleMarketIdPath[0],
          INTEGERS.ZERO,
        );
        const txResult = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
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
          defaultUserConfig,
          { from: traderOwner },
        );

        await checkEventEmissionLogs(
          txResult,
          true,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
          defaultUserConfig.eventType,
        );
        await checkNoExpiry(simpleMarketIdPath[0]);

        const [traderMarket1Balance, traderMarket2Balance, transferMarket1Balance, transferMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          ]);

        expect(traderMarket1Balance).to.eql(par1.negated());
        expect(traderMarket2Balance).to.eql(par2.times(2));

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a simple swap using external liquidity to close position and no expiry', async () => {
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
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
          defaultUserConfig,
          { from: traderOwner },
        );

        const marketIdsReversed = simpleMarketIdPath.map(marketId => marketId).reverse();
        const amountWeisReversed = simpleAmountWeisPath.map(amount => amount).reverse();
        const txResult = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          marketIdsReversed,
          amountWeisReversed[0],
          amountWeisReversed[amountWeisReversed.length - 1],
          [
            getParaswapTraderParam(
              marketIdsReversed[0],
              marketIdsReversed[1],
              amountWeisReversed[0],
              amountWeisReversed[1],
            ),
          ],
          [],
          {
            fromAccountNumber: tradeAccountNumber,
            toAccountNumber: originalAccountNumber,
            transferAmounts: [{ amountWei: par2, marketId: market2 }],
          },
          {
            marketId: INTEGERS.ZERO,
            expiryTimeDelta: INTEGERS.ZERO,
          },
          defaultUserConfig,
          { from: traderOwner },
        );

        await checkEventEmissionLogs(
          txResult,
          false,
          marketIdsReversed,
          amountWeisReversed[0],
          amountWeisReversed[amountWeisReversed.length - 1],
          defaultUserConfig.eventType,
        );
        await checkNoExpiry(simpleMarketIdPath[0]);

        const [traderMarket1Balance, traderMarket2Balance, transferMarket1Balance, transferMarket2Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market1),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
          ]);

        expect(traderMarket1Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket2Balance).to.eql(INTEGERS.ZERO);

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(par2);
      });

      it('should succeed for a simple swap using internal liquidity', async () => {
        const expiryMarket = simpleMarketIdPath[0];
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, expiryMarket, INTEGERS.ZERO);
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        const result = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
          [await getInternalTraderParamAsync(0, simpleAmountWeisPath[0], simpleAmountWeisPath[1])],
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
          defaultUserConfig,
          { from: traderOwner },
        );

        await checkEventEmissionLogs(
          result,
          true,
          simpleMarketIdPath,
          simpleAmountWeisPath[0],
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
          defaultUserConfig.eventType,
        );
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
        expect(traderMarket2Balance).to.eql(par2.times(2));

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
          amountsPath[0],
          amountsPath[amountsPath.length - 1],
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
          defaultUserConfig,
          { from: traderOwner },
        );

        await checkEventEmissionLogs(
          result,
          true,
          marketPath,
          amountsPath[0],
          amountsPath[amountsPath.length - 1],
          defaultUserConfig.eventType,
        );
        await checkExpiry(result, expiryMarket, expiryTimeDelta);

        const [traderMarket2Balance, traderMarket3Balance, transferMarket2Balance, transferMarket3Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market3),
          ]);

        expect(traderMarket2Balance).to.eql(par2.times(2)); // includes the transfer amount
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
          amountsPath[0],
          amountsPath[amountsPath.length - 1],
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
          defaultUserConfig,
          { from: traderOwner },
        );

        await checkEventEmissionLogs(
          result,
          true,
          marketPath,
          amountsPath[0],
          amountsPath[amountsPath.length - 1],
          defaultUserConfig.eventType,
        );
        await checkExpiry(result, expiryMarket, expiryTimeDelta);

        const [traderMarket2Balance, traderMarket3Balance, transferMarket2Balance, transferMarket3Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market3),
          ]);

        expect(traderMarket2Balance).to.eql(par2.negated());
        expect(traderMarket3Balance).to.eql(par3.times(2));

        expect(transferMarket2Balance).to.eql(par2);
        expect(transferMarket3Balance).to.eql(INTEGERS.ZERO);
      });

      it('should succeed for a simple swap that unwraps into a wrapper', async () => {
        const freshUnwrapper = await deployContract<TestIsolationModeUnwrapperTraderV2>(
          dolomiteMargin,
          testIsolationModeUnwrapperTraderV2Json,
          [token3, token4, dolomiteMargin.address],
        );
        await dolomiteMargin.contracts.callContractFunction(
          freshUnwrapper.methods.setVault(traderOwner, true),
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
          amountsPath[0],
          amountsPath[amountsPath.length - 1],
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
          defaultUserConfig,
          { from: traderOwner },
        );

        await checkEventEmissionLogs(
          result,
          true,
          marketPath,
          amountsPath[0],
          amountsPath[amountsPath.length - 1],
          defaultUserConfig.eventType,
        );
        await checkExpiry(result, expiryMarket, expiryTimeDelta);

        const [traderMarket3Balance, traderMarket4Balance, transferMarket3Balance, transferMarket4Balance] =
          await Promise.all([
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),
            dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market4),

            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market3),
            dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market4),
          ]);

        expect(traderMarket3Balance).to.eql(par3.negated());
        expect(traderMarket4Balance).to.eql(par4.times(2));

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
          amountsPath[0],
          amountsPath[amountsPath.length - 1],
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
          defaultUserConfig,
          { from: traderOwner },
        );

        await checkEventEmissionLogs(
          result,
          true,
          marketPath,
          amountsPath[0],
          amountsPath[amountsPath.length - 1],
          defaultUserConfig.eventType,
        );
        await checkExpiry(result, expiryMarket, expiryTimeDelta);

        const [market1Balance, market2Balance, market5Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market5),
        ]);

        expect(market1Balance).to.eql(par1.negated());
        expect(market2Balance).to.eql(INTEGERS.ZERO);
        expect(market5Balance).to.eql(par5.times(2));
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
          amountsPath[0],
          amountsPath[amountsPath.length - 1],
          [
            await getInternalTraderParamAsync(0, par1, par2, tradeId1),
            await getInternalTraderParamAsync(0, par2, par5, tradeId2),
            await getInternalTraderParamAsync(1, par5, par6, tradeId3),
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
          defaultUserConfig,
          { from: traderOwner },
        );

        await checkEventEmissionLogs(
          result,
          true,
          marketPath,
          amountsPath[0],
          amountsPath[amountsPath.length - 1],
          defaultUserConfig.eventType,
        );
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
        expect(traderMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket5Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket6Balance).to.eql(par6.times(2));

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
        const expiryMarket = market3;
        const expiryTimeDelta = INTEGERS.ONE_HOUR_IN_SECONDS;
        const marketPath = [market3, market2, market1, market5, market2, market3];
        const result = await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          marketPath,
          par3,
          par3,
          [
            await getUnwrapperTraderParam(),
            await getInternalTraderParamAsync(0, par2, par1, tradeId1),
            await getInternalTraderParamAsync(1, par1, par5, tradeId2),
            await getParaswapTraderParam(market5, market2, par5, par2.times(1.1)),
            await getWrapperTraderParam(),
          ],
          [
            { owner: makerAccountOwner, number: makerAccountNumber1.toNumber() },
            { owner: makerAccountOwner, number: makerAccountNumber2.toNumber() },
          ],
          {
            fromAccountNumber: originalAccountNumber,
            toAccountNumber: tradeAccountNumber,
            transferAmounts: [{ amountWei: par3, marketId: market3 }],
          },
          {
            expiryTimeDelta,
            marketId: expiryMarket,
          },
          defaultUserConfig,
          { from: traderOwner },
        );

        await checkEventEmissionLogs(result, true, marketPath, par3, par3.times(1.1), defaultUserConfig.eventType);
        const expiry = await dolomiteMargin.expiry.getExpiry(traderOwner, tradeAccountNumber, expiryMarket);
        // The expiry should not be set because expiryMarket didn't go negative
        expect(expiry).to.eql(INTEGERS.ZERO);

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

        expect(traderMarket1Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket2Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket3Balance).to.eql(par3.times(1.1));
        expect(traderMarket5Balance).to.eql(INTEGERS.ZERO);
        expect(traderMarket6Balance).to.eql(INTEGERS.ZERO);

        expect(transferMarket1Balance).to.eql(par1);
        expect(transferMarket2Balance).to.eql(par2);
        expect(transferMarket3Balance).to.eql(INTEGERS.ZERO);
        expect(transferMarket5Balance).to.eql(par5);
        expect(transferMarket6Balance).to.eql(par6);

        expect(maker1Market1Balance).to.eql(INTEGERS.ZERO);
        expect(maker1Market2Balance).to.eql(par2.times(2));
        expect(maker1Market3Balance).to.eql(par3);
        expect(maker1Market5Balance).to.eql(par5);
        expect(maker1Market6Balance).to.eql(par6);

        expect(maker2Market1Balance).to.eql(par1.times(2));
        expect(maker2Market2Balance).to.eql(par2);
        expect(maker2Market3Balance).to.eql(par3);
        expect(maker2Market5Balance).to.eql(INTEGERS.ZERO);
        expect(maker2Market6Balance).to.eql(par6);
      });

      it("should succeed when a swap wants to use all of the trader's balance", async () => {
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, market1, par1);

        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          INTEGERS.MAX_UINT,
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
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
          { expiryTimeDelta: INTEGERS.ZERO, marketId: market1 },
          defaultUserConfig,
          { from: traderOwner },
        );

        const [market1Balance, market2Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
        ]);

        expect(market1Balance).to.eql(INTEGERS.ZERO);
        expect(market2Balance).to.eql(par2.times(2));
      });

      it("should succeed when a swap wants transfer all of the trader's output", async () => {
        await dolomiteMargin.testing.setAccountBalance(traderOwner, tradeAccountNumber, market1, par1);

        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          INTEGERS.MAX_UINT,
          simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
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
            transferAmounts: [{ amountWei: INTEGERS.MAX_UINT_SUB_1, marketId: market2 }],
          },
          { expiryTimeDelta: INTEGERS.ZERO, marketId: market1 },
          defaultUserConfig,
          { from: traderOwner },
        );

        const [market1Balance, market2BalanceTradeAccount, market2BalanceOriginalAccount] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, originalAccountNumber, market2),
        ]);

        expect(market1Balance).to.eql(INTEGERS.ZERO);
        expect(market2BalanceTradeAccount).to.eql(INTEGERS.ZERO);
        expect(market2BalanceOriginalAccount).to.eql(par2.times(2));
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

      it('should fail when deadline has passed', async () => {
        const deadline = 1;
        const timestamp = Date.now();
        await setTime(timestamp);
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            { ...defaultUserConfig, deadline },
          ),
          `GenericTraderProxyV1: Deadline expired <${deadline}, ${Math.floor(timestamp / 1000)}>`,
        );
      });

      it('should fail when trade balance goes negative for BalanceCheckFlags', async () => {
        const accountString = `${traderOwner.toLowerCase()}, ${tradeAccountNumber.toFixed()}, ${simpleMarketIdPath[0].toFixed()}`;
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            { ...defaultUserConfig, balanceCheckFlag: BalanceCheckFlag.From },
          ),
          `AccountBalanceLib: account cannot go negative <${accountString}>`,
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            { ...defaultUserConfig, balanceCheckFlag: BalanceCheckFlag.Both },
          ),
          `AccountBalanceLib: account cannot go negative <${accountString}>`,
        );
      });

      it('should fail when transfer balance goes negative for BalanceCheckFlags', async () => {
        const transferMarket = defaultTransferAmount.marketId;
        const accountString = `${traderOwner.toLowerCase()}, ${originalAccountNumber.toFixed()}, ${transferMarket.toFixed()}`;
        await dolomiteMargin.testing.setAccountBalance(
          traderOwner,
          originalAccountNumber,
          transferMarket,
          INTEGERS.ZERO,
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            { ...defaultUserConfig, balanceCheckFlag: BalanceCheckFlag.To },
          ),
          `AccountBalanceLib: account cannot go negative <${accountString}>`,
        );
      });

      it('should fail when marketId path < 2', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          'GenericTraderProxyBase: Invalid market path length',
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          'GenericTraderProxyBase: Invalid market path length',
        );
      });

      it('should fail when amount at any index is 0', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            par1,
            INTEGERS.ZERO,
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          'GenericTraderProxyBase: Invalid minOutputAmountWei',
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            INTEGERS.ZERO,
            par2,
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          'GenericTraderProxyBase: Invalid inputAmountWei',
        );
      });

      it('should fail when trader length is incorrect', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          'GenericTraderProxyBase: Invalid traders params length',
        );
      });

      it('should fail when trader is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [traderWithInvalidAddress],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
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
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [traderParam],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid isolation mode unwrapper <${market3.toFixed()}, ${traderParam.traderType}>`,
        );
      });

      it('should fail when attempting to unwrap into an isolation mode token', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market3, market4],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getUnwrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid unwrap sequence <${market3.toFixed()}, ${market4.toFixed()}>`,
        );
      });

      it('should fail when attempting to unwrap into an isolation mode token', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market4],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
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
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getUnwrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid trader type <${GenericTraderType.IsolationModeUnwrapper}>`,
        );
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getWrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid trader type <${GenericTraderType.IsolationModeWrapper}>`,
        );
      });

      it('should fail when the input for the unwrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market4, market2],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getUnwrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid input for unwrapper <0, ${market4.toFixed()}>`,
        );
      });

      it('should fail when the output for the unwrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market3, market1],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getUnwrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid output for unwrapper <1, ${market1.toFixed()}>`,
        );
      });

      it('should fail when the unwrapper trader is not trusted', async () => {
        await token3Contract.setTokenConverterTrusted(testIsolationModeUnwrapper.options.address, false);
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market3, market2],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getUnwrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Unwrapper trader not enabled <${testIsolationModeUnwrapper.options.address.toLowerCase()}, ${market3.toFixed()}>`,
        );
      });

      it('should fail when the input for the wrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market3],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getWrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid input for wrapper <0, ${market1.toFixed()}>`,
        );
      });

      it('should fail when the output for the wrapper is invalid', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market2, market4],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getWrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Invalid output for wrapper <1, ${market4.toFixed()}>`,
        );
      });

      it('should fail when the wrapper trader is not trusted', async () => {
        await token3Contract.setTokenConverterTrusted(testIsolationModeWrapper.options.address, false);
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market2, market3],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getWrapperTraderParam()],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          `GenericTraderProxyBase: Wrapper trader not enabled <${testIsolationModeWrapper.options.address.toLowerCase()}, ${market3.toFixed()}>`,
        );
      });

      it('should fail when makerAccountIndex is >= makerAccounts.length and trader type is internal liquidity', async () => {
        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            [market1, market2],
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [await getInternalTraderParamAsync(0, simpleAmountWeisPath[0], simpleAmountWeisPath[1])],
            [{ owner: ADDRESSES.ZERO, number: 0 }],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
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
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [traderParam],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
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
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            transferParam,
            defaultExpiryParam,
            defaultUserConfig,
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
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            transferParam,
            defaultExpiryParam,
            defaultUserConfig,
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
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            transferParam,
            defaultExpiryParam,
            defaultUserConfig,
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
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [getDefaultParaswapTraderParam()],
            [],
            transferParam,
            defaultExpiryParam,
            defaultUserConfig,
          ),
          'GenericTraderProxyV1: Invalid transfer amount at index <0>',
        );
      });

      it('should fail when the balance is negative and attempting to trade all', async () => {
        const amountPath = [par1, par2];
        await dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
          tradeAccountNumber,
          simpleMarketIdPath,
          amountPath[0],
          amountPath[1],
          [getParaswapTraderParam(simpleMarketIdPath[0], simpleMarketIdPath[1], amountPath[0], amountPath[1])],
          [],
          defaultTransferParam,
          defaultExpiryParam,
          defaultUserConfig,
          { from: traderOwner },
        );

        const [market1Balance, market2Balance, market3Balance] = await Promise.all([
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market1),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market2),
          dolomiteMargin.getters.getAccountWei(traderOwner, tradeAccountNumber, market3),
        ]);

        expect(market1Balance).to.eql(par1.times(-1));
        expect(market2Balance).to.eql(par2);
        expect(market3Balance).to.eql(par3);

        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            INTEGERS.MAX_UINT,
            simpleAmountWeisPath[simpleAmountWeisPath.length - 1],
            [
              getParaswapTraderParam(
                simpleMarketIdPath[0],
                simpleMarketIdPath[1],
                simpleAmountWeisPath[0],
                simpleAmountWeisPath[1],
              ),
            ],
            [],
            defaultTransferParam,
            defaultExpiryParam,
            defaultUserConfig,
            { from: traderOwner },
          ),
          `GenericTraderProxyV1: Balance must be positive <${simpleMarketIdPath[0]}>`,
        );
      });

      it('should fail when transferring the trade amount from the non-last marketId', async () => {
        const transferParam: GenericTransferCollateralParam = {
          fromAccountNumber: originalAccountNumber,
          toAccountNumber: tradeAccountNumber,
          transferAmounts: [
            {
              marketId: market3,
              amountWei: INTEGERS.MAX_UINT_SUB_1,
            },
          ],
        };

        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[1],
            [
              getParaswapTraderParam(
                simpleMarketIdPath[0],
                simpleMarketIdPath[1],
                simpleAmountWeisPath[0],
                simpleAmountWeisPath[1],
              ),
            ],
            [],
            transferParam,
            defaultExpiryParam,
            defaultUserConfig,
            { from: traderOwner },
          ),
          `GenericTraderProxyV1: Invalid transfer marketId <${transferParam.transferAmounts[0].marketId.toFixed()}>`,
        );
      });

      it('should fail when transferring the trade amount from the non-trade account', async () => {
        const transferParam: GenericTransferCollateralParam = {
          fromAccountNumber: originalAccountNumber,
          toAccountNumber: tradeAccountNumber,
          transferAmounts: [
            {
              marketId: market2,
              amountWei: INTEGERS.MAX_UINT_SUB_1,
            },
          ],
        };

        await expectThrow(
          dolomiteMargin.genericTraderProxyV1.swapExactInputForOutputAndModifyPosition(
            tradeAccountNumber,
            simpleMarketIdPath,
            simpleAmountWeisPath[0],
            simpleAmountWeisPath[1],
            [
              getParaswapTraderParam(
                simpleMarketIdPath[0],
                simpleMarketIdPath[1],
                simpleAmountWeisPath[0],
                simpleAmountWeisPath[1],
              ),
            ],
            [],
            transferParam,
            defaultExpiryParam,
            defaultUserConfig,
            { from: traderOwner },
          ),
          'GenericTraderProxyV1: Invalid from account ID',
        );
      });
    });
  });

  describe('#isIsolationModeMarket', () => {
    it('should work normally', async () => {
      expect(await dolomiteMargin.genericTraderProxyV1.isIsolationModeMarket(market1)).to.eql(false);
      expect(await dolomiteMargin.genericTraderProxyV1.isIsolationModeMarket(market2)).to.eql(false);
      expect(await dolomiteMargin.genericTraderProxyV1.isIsolationModeMarket(market3)).to.eql(true);
      expect(await dolomiteMargin.genericTraderProxyV1.isIsolationModeMarket(market4)).to.eql(true);
      expect(await dolomiteMargin.genericTraderProxyV1.isIsolationModeMarket(market5)).to.eql(false);
      expect(await dolomiteMargin.genericTraderProxyV1.isIsolationModeMarket(market6)).to.eql(false);
    });

    it('should work when the token does not have a #name function', async () => {
      await token6Contract.setShouldRevertNameCall(true);
      await expectThrow(token6Contract.getName());
      expect(await dolomiteMargin.genericTraderProxyV1.isIsolationModeMarket(market6)).to.eql(false);
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
  amountIn: Integer,
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
    tradeData: ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'bytes'],
      [amountIn.toFixed(), ethers.utils.defaultAbiCoder.encode(['uint256'], [tradeId.toFixed()])],
    ),
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
    ['Dolomite: Fee + Staked GLP', 'TEST4', 18],
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
      defaultMaxWei,
      defaultIsClosing,
      defaultIsRecyclable,
      { from: accounts[0] },
    );
  }
}

async function checkEventEmissionLogs(
  txResult: TxResult,
  isOpen: boolean,
  marketPath: Integer[],
  inputAmountWei: Integer,
  outputAmountWei: Integer,
  logType: GenericEventEmissionType,
) {
  if (logType === GenericEventEmissionType.MarginPosition) {
    const inputMarket = marketPath[0];
    const outputMarket = marketPath[marketPath.length - 1];
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
    expect(isOpen ? logs[0].args.depositToken : logs[0].args.withdrawalToken).to.eql(
      marketIdToTokenMap[marketPath[isOpen ? marketPath.length - 1 : 0].toFixed()],
    );
    expect(logs[0].args.inputBalanceUpdate).to.eql({
      deltaWei: inputMarket.eq(outputMarket)
        ? outputAmountWei
        : isOpen
        ? inputAmountWei.negated()
        : inputAmountWei.negated().times(2),
      newPar: inputMarket.eq(outputMarket) ? outputAmountWei : isOpen ? inputAmountWei.negated() : INTEGERS.ZERO,
    });
    if (isOpen) {
      expect(logs[0].args.outputBalanceUpdate).to.eql({
        deltaWei: inputMarket.eq(outputMarket) ? outputAmountWei : outputAmountWei.times(2),
        newPar: inputMarket.eq(outputMarket) ? outputAmountWei : outputAmountWei.times(2),
      });
      expect(logs[0].args.marginDepositUpdate).to.eql({
        deltaWei: inputMarket.eq(outputMarket) ? outputAmountWei : outputAmountWei.times(2),
        newPar: inputMarket.eq(outputMarket) ? outputAmountWei : outputAmountWei.times(2),
      });
    } else {
      expect(logs[0].args.outputBalanceUpdate).to.eql({
        deltaWei: outputAmountWei,
        newPar: INTEGERS.ZERO,
      });
      // The tradeAmount + collateral are sold and transferred out
      expect(logs[0].args.marginWithdrawalUpdate).to.eql({
        deltaWei: inputAmountWei.times(2).negated(),
        newPar: INTEGERS.ZERO,
      });
    }
  } else if (logType === GenericEventEmissionType.BorrowPosition) {
    const logs = dolomiteMargin.logs.parseLogs(txResult).filter(log => log.name === 'BorrowPositionOpen');
    expect(logs.length).to.eql(1);
    expect(logs[0].args.borrower).to.eql(traderOwner);
    expect(logs[0].args.borrowAccountNumber).to.eql(tradeAccountNumber);
  } else {
    if (logType !== GenericEventEmissionType.None) {
      return Promise.reject(new Error(`Invalid log type: ${logType}`));
    }
    const logs = dolomiteMargin.logs
      .parseLogs(txResult)
      .filter(
        log =>
          log.name === 'BorrowPositionOpen' || log.name === 'MarginPositionClose' || log.name === 'MarginPositionOpen',
      );
    expect(logs.length).to.eql(0);
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
