import BigNumber from 'bignumber.js';
import {
  address,
  ADDRESSES,
  AmountDenomination,
  AmountReference,
  BalanceCheckFlag,
  Integer,
  INTEGERS,
  TxResult
} from '../../src';
import { expectThrow } from '../helpers/Expect';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { setupMarkets } from '../helpers/DolomiteMarginHelpers';
import { mineAvgBlock, resetEVM, snapshot } from '../helpers/EVM';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { PermitSignature } from '../../src/modules/DolomiteAmmRouterProxy';
import { deployContract } from '../helpers/Deploy';
import ErroringTokenJSON from '../../build/contracts/ErroringToken.json';
import { ErroringToken } from '../../build/testing_wrappers/ErroringToken';
import { TestToken } from '../modules/TestToken';
import { toBytesNoPadding } from '../../src/lib/BytesHelper';
import { ethers } from 'ethers';

let defaultPath: address[];
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
let snapshotId: string;
let admin: address;
let owner1: address;
let owner2: address;
let token_ab: address;
let tokenA: TestToken;
let tokenB: TestToken;
let tokenC: TestToken;
let marketIdA: Integer;
let marketIdB: Integer;
let marketIdC: Integer;

const parA = new BigNumber('1000000000000000000');
const parB = new BigNumber('2000000');
const parC = new BigNumber('300000000000000000000');
const prices = [new BigNumber('1e20'), new BigNumber('1e32'), new BigNumber('1e18')];
const defaultDeadline = new BigNumber('123456789123');
const defaultBalanceCheckFlag = BalanceCheckFlag.From;

describe('DolomiteAmmPair', () => {
  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    tokenA = dolomiteMargin.testing.tokenA;
    tokenB = dolomiteMargin.testing.tokenB;
    tokenC = dolomiteMargin.testing.tokenC;
    defaultPath = [tokenA.address, tokenB.address];
    accounts = r.accounts;
    admin = accounts[0];
    owner1 = accounts[1];
    owner2 = accounts[2];

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);
    await Promise.all([
      dolomiteMargin.testing.priceOracle.setPrice(tokenA.address, prices[0]),
      dolomiteMargin.testing.priceOracle.setPrice(tokenB.address, prices[1]),
      dolomiteMargin.testing.priceOracle.setPrice(tokenB.address, prices[2]),
      setUpBasicBalances(),
    ]);

    expect(await dolomiteMargin.dolomiteAmmFactory.getPairInitCodeHash()).to.eql(
      await dolomiteMargin.dolomiteAmmRouterProxy.getPairInitCodeHash(),
    );

    await Promise.all([
      dolomiteMargin.dolomiteAmmFactory.createPair(
        tokenA.address,
        tokenB.address,
      ),
    ]);

    marketIdA = await dolomiteMargin.getters.getMarketIdByTokenAddress(tokenA.address);
    marketIdB = await dolomiteMargin.getters.getMarketIdByTokenAddress(tokenB.address);
    marketIdC = await dolomiteMargin.getters.getMarketIdByTokenAddress(tokenC.address);

    // Needs to be done once the balances are set up
    await addLiquidity(
      owner2,
      parA.div(100),
      parB.div(100),
      tokenA.address,
      tokenB.address,
    );

    token_ab = await dolomiteMargin.dolomiteAmmFactory.getPair(
      tokenA.address,
      tokenB.address,
    );

    expect(await dolomiteMargin.dolomiteAmmFactory.allPairsLength()).to.eql(INTEGERS.ONE);

    await mineAvgBlock();

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('#initialize', () => {
    describe('Failure cases', () => {
      it('Should fail when called by non-factory', async () => {
        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        await expectThrow(
          pair.initialize(tokenA.address, tokenB.address, dolomiteMargin.transferProxy.address, { from: owner1 }),
          'DolomiteAmmPair: forbidden',
        );
      });
    });
  });

  describe('#decimals', () => {
    it('should work', async () => {
      const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
      expect(await pair.decimals()).to.eql(18);
    });
  });

  describe('#symbol', () => {
    it('should get name properly', async () => {
      const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const symbol = await pair.symbol();
      const [token0] =
        tokenA.address < tokenB.address
          ? [tokenA.address]
          : [tokenB.address];

      // tokenA === USDC && tokenB === DAI
      if (token0 === tokenA.address) {
        expect(symbol).to.eql('DLP_USDC_DAI');
      } else {
        expect(symbol).to.eql('DLP_DAI_USDC');
      }
    });

    it('should get symbol properly for invalid token', async () => {
      const errorToken = await deployContract(dolomiteMargin, ErroringTokenJSON, []) as ErroringToken;
      await addMarket(errorToken);
      await dolomiteMargin.dolomiteAmmFactory.createPair(
        errorToken.options.address,
        tokenB.address,
      );

      const pairAddress = await dolomiteMargin.dolomiteAmmFactory.getPair(
        errorToken.options.address,
        tokenB.address,
      );
      const pair = dolomiteMargin.getDolomiteAmmPair(pairAddress);
      const symbol = await pair.symbol();
      const [token0] =
        errorToken.options.address < tokenB.address
          ? [errorToken.options.address]
          : [tokenB.address];

      // tokenA === ERROR && tokenB === DAI
      if (token0 === errorToken.options.address) {
        expect(symbol).to.eql('DLP__DAI');
      } else {
        expect(symbol).to.eql('DLP_DAI_');
      }
    });
  });

  describe('#name', () => {
    it('should get name properly', async () => {
      const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const name = await pair.name();
      const [token0] =
        tokenA.address < tokenB.address
          ? [tokenA.address]
          : [tokenB.address];

      // tokenA === USDC && tokenB === DAI
      if (token0 === tokenA.address) {
        expect(name).to.eql('Dolomite LP Token: USDC_DAI');
      } else {
        expect(name).to.eql('Dolomite LP Token: DAI_USDC');
      }
    });

    it('should get name properly for invalid token', async () => {
      const errorToken = await deployContract(dolomiteMargin, ErroringTokenJSON, []) as ErroringToken;
      await addMarket(errorToken);
      await dolomiteMargin.dolomiteAmmFactory.createPair(
        errorToken.options.address,
        tokenB.address,
      );

      const pairAddress = await dolomiteMargin.dolomiteAmmFactory.getPair(
        errorToken.options.address,
        tokenB.address,
      );
      const pair = dolomiteMargin.getDolomiteAmmPair(pairAddress);
      const name = await pair.name();
      const [token0] =
        errorToken.options.address < tokenB.address
          ? [errorToken.options.address]
          : [tokenB.address];

      // tokenA === ERROR && tokenB === DAI
      if (token0 === errorToken.options.address) {
        expect(name).to.eql('Dolomite LP Token: _DAI');
      } else {
        expect(name).to.eql('Dolomite LP Token: DAI_');
      }
    });
  });

  describe('#sync', () => {
    it('should work', async () => {
      const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const txResult = await pair.sync();
      await checkSyncLogs(txResult, tokenA.address, tokenB.address);
    });

    it('should fail when the balance would overflow', async () => {
      const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
      await dolomiteMargin.testing.setAccountBalance(pair.address, INTEGERS.ZERO, marketIdA, INTEGERS.MAX_UINT_112.plus(100));
      await expectThrow(
        pair.sync(),
        'DolomiteAmmPair: balance overflow',
      );
    });
  });

  describe('#skim', () => {
    it('should work', async () => {
      await dolomiteMargin.admin.setGlobalOperator(admin, true, { from: admin });

      const amountA = new BigNumber('420');
      const amountB = new BigNumber('469');

      await dolomiteMargin.testing.setAccountBalance(admin, INTEGERS.ZERO, marketIdA, amountA);
      await dolomiteMargin.testing.setAccountBalance(admin, INTEGERS.ZERO, marketIdB, amountB);

      await dolomiteMargin.operation.initiate()
        .transfer({
          primaryAccountOwner: admin,
          primaryAccountId: INTEGERS.ZERO,
          marketId: marketIdA,
          toAccountOwner: token_ab,
          toAccountId: INTEGERS.ZERO,
          amount: {
            value: amountA.negated(),
            reference: AmountReference.Delta,
            denomination: AmountDenomination.Wei
          },
        })
        .transfer({
          primaryAccountOwner: admin,
          primaryAccountId: INTEGERS.ZERO,
          marketId: marketIdB,
          toAccountOwner: token_ab,
          toAccountId: INTEGERS.ZERO,
          amount: {
            value: amountB.negated(),
            reference: AmountReference.Delta,
            denomination: AmountDenomination.Wei
          },
        })
        .commit({ from: admin });

      const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const toAccountNumber = new BigNumber(321);
      await pair.skim(admin, toAccountNumber);

      expect(await dolomiteMargin.getters.getAccountPar(admin, toAccountNumber, marketIdA)).to.eql(amountA);
      expect(await dolomiteMargin.getters.getAccountPar(admin, toAccountNumber, marketIdB)).to.eql(amountB);
    });
  });

  describe('#feeOn', () => {
    it('should work when turned right back off', async () => {
      await dolomiteMargin.dolomiteAmmFactory.setFeeTo(admin, { from: admin });
      await addLiquidity(
        owner1,
        parA.div(10),
        parB.div(10),
        tokenA.address,
        tokenB.address,
      );
      await dolomiteMargin.dolomiteAmmFactory.setFeeTo(ADDRESSES.ZERO, { from: admin });
      await addLiquidity(
        owner1,
        parA.div(10),
        parB.div(10),
        tokenA.address,
        tokenB.address,
      );
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      expect(await lpToken.balanceOf(admin)).to.eql(INTEGERS.ZERO);
    });

    it('should fail when kLast change is too small', async () => {
      await dolomiteMargin.dolomiteAmmFactory.setFeeTo(admin, { from: admin });
      // calling addLiquidity recalculates kLast for tabulating fees
      const path = [tokenA.address, tokenC.address];
      await addLiquidity(
        owner2,
        parA.div(3),
        parA.div(3),
        path[0],
        path[1],
      );
      await swapExactTokensForTokens(owner1, new BigNumber('1600'), path, INTEGERS.ZERO);

      const token_ac = await dolomiteMargin.dolomiteAmmFactory.getPair(path[0], path[1]);
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ac);
      const reserves = await lpToken.getReservesWei();
      expect(reserves.reserve0.times(reserves.reserve1).gt(await lpToken.kLast())).to.eql(true);
      const liquidity = await lpToken.balanceOf(owner2);
      await lpToken.approve(dolomiteMargin.dolomiteAmmRouterProxy.address, INTEGERS.MAX_UINT, { from: owner2 });
      await dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidity(
        owner2,
        INTEGERS.ZERO,
        path[0],
        path[1],
        liquidity,
        INTEGERS.ZERO,
        INTEGERS.ZERO,
        defaultDeadline,
        { from: owner2 },
      );
      expect(await lpToken.balanceOf(admin)).to.eql(INTEGERS.ZERO);
    });

    it('should work when fees accrue and be ~0.1% of trade volume', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      await dolomiteMargin.dolomiteAmmFactory.setFeeTo(admin, { from: admin });
      // calling addLiquidity recalculates kLast for tabulating fees
      await addLiquidity(
        owner1,
        parA.div(3),
        parB.div(3),
        tokenA.address,
        tokenB.address,
      );
      await swapExactTokensForTokens(owner1, parA.div(100), defaultPath, INTEGERS.ONE, false);

      await swapExactTokensForTokens(owner1, parA.div(100), defaultPath, INTEGERS.ONE, false);
      // calling addLiquidity recalculates kLast for tabulating fees
      await addLiquidity(
        owner1,
        parA.div(3),
        parB.div(3),
        tokenA.address,
        tokenB.address,
      );

      const liquidity = await lpToken.balanceOf(owner1);
      await lpToken.approve(dolomiteMargin.dolomiteAmmRouterProxy.address, INTEGERS.MAX_UINT, { from: owner1 });
      await removeLiquidity(
        owner1,
        liquidity,
      );
      const totalSupply2 = await lpToken.totalSupply();
      const balance2 = await lpToken.balanceOf(admin);
      const rawReserves2 = await lpToken.getReservesWei();
      const reserveA2 = tokenA.address.toLowerCase() <
      tokenB.address.toLowerCase()
        ? rawReserves2.reserve0 : rawReserves2.reserve1;
      const balanceA2 = reserveA2.times(balance2).div(totalSupply2);
      // times 1000 because the fee is 0.1%, times 100 because the trade size is 1/100 of parA, times 2 because fee
      // equity is split into reserveA and reserveB
      expect(balanceA2.times(1000).times(100).times(2).gt(parA)).to.eql(true);
    });
  });

  describe('#mint', () => {
    describe('Failure cases', () => {
      it('should fail when amount for tokenA equal to zero', async () => {
        const [token0] = tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];

        const isToken0 = token0.address.toLowerCase() === tokenA.address.toLowerCase();
        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });
        await dolomiteMargin.operation.initiate()
          .transfer({
            primaryAccountOwner: owner1,
            primaryAccountId: INTEGERS.ZERO,
            toAccountOwner: pair.address,
            toAccountId: INTEGERS.ZERO,
            marketId: marketIdB,
            amount: {
              value: parB.negated(),
              denomination: AmountDenomination.Actual,
              reference: AmountReference.Delta,
            }
          })
          .commit({ from: owner1 });

        await expectThrow(
          pair.mint(owner1, { from: owner1 }),
          `DolomiteAmmPair: invalid mint amount ${isToken0 ? '0' : '1'}`,
        );
      });

      it('should fail when amount for tokenB equal to zero', async () => {
        const [token0] = tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];

        const isToken0 = token0.address.toLowerCase() === tokenA.address.toLowerCase();
        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });
        await dolomiteMargin.operation.initiate()
          .transfer({
            primaryAccountOwner: owner1,
            primaryAccountId: INTEGERS.ZERO,
            toAccountOwner: pair.address,
            toAccountId: INTEGERS.ZERO,
            marketId: marketIdA,
            amount: {
              value: parA.negated(),
              denomination: AmountDenomination.Actual,
              reference: AmountReference.Delta,
            }
          })
          .commit({ from: owner1 });

        await expectThrow(
          pair.mint(owner1, { from: owner1 }),
          `DolomiteAmmPair: invalid mint amount ${isToken0 ? '1' : '0'}`,
        );
      });

      it('should fail when liquidity amount equals zero', async () => {
        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });
        await dolomiteMargin.operation.initiate()
          .transfer({
            primaryAccountOwner: owner1,
            primaryAccountId: INTEGERS.ZERO,
            toAccountOwner: pair.address,
            toAccountId: INTEGERS.ZERO,
            marketId: marketIdA,
            amount: {
              value: INTEGERS.ONE.negated(),
              denomination: AmountDenomination.Actual,
              reference: AmountReference.Delta,
            }
          })
          .transfer({
            primaryAccountOwner: owner1,
            primaryAccountId: INTEGERS.ZERO,
            toAccountOwner: pair.address,
            toAccountId: INTEGERS.ZERO,
            marketId: marketIdB,
            amount: {
              value: INTEGERS.ONE.negated(),
              denomination: AmountDenomination.Actual,
              reference: AmountReference.Delta,
            }
          })
          .commit({ from: owner1 });

        await expectThrow(
          pair.mint(owner1, { from: owner1 }),
          'DolomiteAmmPair: insufficient liquidity minted',
        );
      });
    });
  });

  describe('#burn', () => {
    it('should fail when liquidity translates to 0 wei', async () => {
      await addLiquidity(
        owner1,
        parA,
        parB,
        tokenA.address,
        tokenB.address,
      );

      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const dolomiteAmmRouterProxyAddress = dolomiteMargin.contracts.dolomiteAmmRouterProxy.options.address;
      await lpToken.approve(dolomiteAmmRouterProxyAddress, INTEGERS.ONES_255, { from: owner1 });

      await expectThrow(
        removeLiquidity(owner1, INTEGERS.ONE),
        'DolomiteAmmPair: insufficient liquidity burned',
      );
    });
  });

  describe('#getTradeCost', () => {
    it('should fail when tx not sent by DolomiteMargin', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const inputMarketId = marketIdA;
      const outputMarketId = marketIdB;
      const makerAccount = { owner: token_ab, number: INTEGERS.ZERO.toFixed(), };
      const takerAccount = { owner: owner1, number: INTEGERS.ZERO.toFixed(), };

      const oldInputPar = await dolomiteMargin.getters.getAccountPar(
        makerAccount.owner,
        new BigNumber(makerAccount.number),
        inputMarketId,
      );
      const newInputPar = oldInputPar.plus(parA);
      await expectThrow(
        lpToken.getTradeCost(
          inputMarketId,
          outputMarketId,
          makerAccount,
          takerAccount,
          oldInputPar,
          newInputPar,
          parA,
          '0x',
          { from: owner1 },
        ),
        'DolomiteAmmPair: invalid sender',
      );
    });

    it('should fail when maker account is not LP pair', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const inputMarketId = marketIdA;
      const outputMarketId = marketIdB;
      const makerAccount = { owner: owner2, number: INTEGERS.ZERO, };
      const takerAccount = { owner: owner1, number: INTEGERS.ZERO, };
      await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });
      await dolomiteMargin.admin.setGlobalOperator(owner2, true, { from: admin });
      await dolomiteMargin.admin.setGlobalOperator(lpToken.address, true, { from: admin });

      await expectThrow(
        dolomiteMargin.operation.initiate()
          .trade({
            inputMarketId,
            outputMarketId,
            primaryAccountOwner: takerAccount.owner,
            primaryAccountId: takerAccount.number,
            otherAccountOwner: makerAccount.owner,
            otherAccountId: makerAccount.number,
            autoTrader: lpToken.address,
            calculateAmountWithMakerAccount: true,
            data: toBytesNoPadding('0x'),
            amount: {
              value: parA.negated(),
              reference: AmountReference.Delta,
              denomination: AmountDenomination.Actual,
            }
          })
          .commit({ from: owner1 }),
        'DolomiteAmmPair: invalid maker account owner',
      );
    });

    it('should fail when maker account number is not 0', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const inputMarketId = marketIdA;
      const outputMarketId = marketIdB;
      const makerAccount = { owner: lpToken.address, number: INTEGERS.ONE, };
      const takerAccount = { owner: owner1, number: INTEGERS.ZERO, };
      await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });

      await expectThrow(
        dolomiteMargin.operation.initiate()
          .trade({
            inputMarketId,
            outputMarketId,
            primaryAccountOwner: takerAccount.owner,
            primaryAccountId: takerAccount.number,
            otherAccountOwner: makerAccount.owner,
            otherAccountId: makerAccount.number,
            autoTrader: lpToken.address,
            calculateAmountWithMakerAccount: true,
            data: toBytesNoPadding('0x'),
            amount: {
              value: parA.negated(),
              reference: AmountReference.Delta,
              denomination: AmountDenomination.Actual,
            }
          })
          .commit({ from: owner1 }),
        'DolomiteAmmPair: invalid maker account number',
      );
    });

    it('should fail when taker account is token0 or token1 or auto trader', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const inputMarketId = marketIdA;
      const outputMarketId = marketIdB;
      const makerAccount = { owner: lpToken.address, number: INTEGERS.ZERO, };
      const takerAccount = { owner: tokenA.address, number: INTEGERS.ZERO, };
      await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });

      await expectThrow(
        dolomiteMargin.operation.initiate()
          .trade({
            inputMarketId,
            outputMarketId,
            primaryAccountOwner: takerAccount.owner,
            primaryAccountId: takerAccount.number,
            otherAccountOwner: makerAccount.owner,
            otherAccountId: makerAccount.number,
            autoTrader: lpToken.address,
            calculateAmountWithMakerAccount: true,
            data: toBytesNoPadding('0x'),
            amount: {
              value: parA.negated(),
              reference: AmountReference.Delta,
              denomination: AmountDenomination.Actual,
            }
          })
          .commit({ from: owner1 }),
        'DolomiteAmmPair: invalid taker account owner',
      );

      takerAccount.owner = tokenB.address;
      await expectThrow(
        dolomiteMargin.operation.initiate()
          .trade({
            inputMarketId,
            outputMarketId,
            primaryAccountOwner: takerAccount.owner,
            primaryAccountId: takerAccount.number,
            otherAccountOwner: makerAccount.owner,
            otherAccountId: makerAccount.number,
            autoTrader: lpToken.address,
            calculateAmountWithMakerAccount: true,
            data: toBytesNoPadding('0x'),
            amount: {
              value: parA.negated(),
              reference: AmountReference.Delta,
              denomination: AmountDenomination.Actual,
            }
          })
          .commit({ from: owner1 }),
        'DolomiteAmmPair: invalid taker account owner',
      );
    });

    it('should fail when input market ID is invalid', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const inputMarketId = marketIdC;
      const outputMarketId = marketIdB;
      const makerAccount = { owner: lpToken.address, number: INTEGERS.ZERO, };
      const takerAccount = { owner: owner1, number: INTEGERS.ZERO, };
      await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });

      await expectThrow(
        dolomiteMargin.operation.initiate()
          .trade({
            inputMarketId,
            outputMarketId,
            primaryAccountOwner: takerAccount.owner,
            primaryAccountId: takerAccount.number,
            otherAccountOwner: makerAccount.owner,
            otherAccountId: makerAccount.number,
            autoTrader: lpToken.address,
            calculateAmountWithMakerAccount: true,
            data: toBytesNoPadding('0x'),
            amount: {
              value: parA.negated(),
              reference: AmountReference.Delta,
              denomination: AmountDenomination.Actual,
            }
          })
          .commit({ from: owner1 }),
        'DolomiteAmmPair: invalid input market',
      );
    });

    it('should fail when output market ID is invalid', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const inputMarketId = marketIdA;
      const outputMarketId = marketIdC;
      const makerAccount = { owner: lpToken.address, number: INTEGERS.ZERO, };
      const takerAccount = { owner: owner1, number: INTEGERS.ZERO, };
      await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });

      await expectThrow(
        dolomiteMargin.operation.initiate()
          .trade({
            inputMarketId,
            outputMarketId,
            primaryAccountOwner: takerAccount.owner,
            primaryAccountId: takerAccount.number,
            otherAccountOwner: makerAccount.owner,
            otherAccountId: makerAccount.number,
            autoTrader: lpToken.address,
            calculateAmountWithMakerAccount: true,
            data: toBytesNoPadding('0x'),
            amount: {
              value: parA.negated(),
              reference: AmountReference.Delta,
              denomination: AmountDenomination.Actual,
            }
          })
          .commit({ from: owner1 }),
        'DolomiteAmmPair: invalid output market',
      );
    });

    it('should fail when input delta wei is negative', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const inputMarketId = marketIdA;
      const outputMarketId = marketIdB;
      const makerAccount = { owner: lpToken.address, number: INTEGERS.ZERO, };
      const takerAccount = { owner: owner1, number: INTEGERS.ZERO, };
      await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });

      await expectThrow(
        dolomiteMargin.operation.initiate()
          .trade({
            inputMarketId,
            outputMarketId,
            primaryAccountOwner: takerAccount.owner,
            primaryAccountId: takerAccount.number,
            otherAccountOwner: makerAccount.owner,
            otherAccountId: makerAccount.number,
            autoTrader: lpToken.address,
            calculateAmountWithMakerAccount: true,
            data: toBytesNoPadding('0x'),
            amount: {
              value: parA.negated(),
              reference: AmountReference.Delta,
              denomination: AmountDenomination.Actual,
            }
          })
          .commit({ from: owner1 }),
        'DolomiteAmmPair: input wei must be positive',
      );
    });

    it('should fail when output wei is 0', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const inputMarketId = marketIdA;
      const outputMarketId = marketIdB;
      const makerAccount = { owner: lpToken.address, number: INTEGERS.ZERO, };
      const takerAccount = { owner: owner1, number: INTEGERS.ZERO, };
      await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });

      await expectThrow(
        dolomiteMargin.operation.initiate()
          .trade({
            inputMarketId,
            outputMarketId,
            primaryAccountOwner: takerAccount.owner,
            primaryAccountId: takerAccount.number,
            otherAccountOwner: makerAccount.owner,
            otherAccountId: makerAccount.number,
            autoTrader: lpToken.address,
            calculateAmountWithMakerAccount: true,
            data: toBytesNoPadding(ethers.utils.defaultAbiCoder.encode(['uint256'], ['0'])),
            amount: {
              value: parA,
              reference: AmountReference.Delta,
              denomination: AmountDenomination.Actual,
            }
          })
          .commit({ from: owner1 }),
        'DolomiteAmmPair: insufficient output amount',
      );
    });

    it('should fail when input wei is 0', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const inputMarketId = marketIdA;
      const outputMarketId = marketIdB;
      const makerAccount = { owner: lpToken.address, number: INTEGERS.ZERO, };
      const takerAccount = { owner: owner1, number: INTEGERS.ZERO, };
      await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });

      const lpTokenInputPar = await dolomiteMargin.getters.getAccountPar(lpToken.address, INTEGERS.ZERO, inputMarketId);
      await dolomiteMargin.testing.setAccountBalance(
        lpToken.address,
        INTEGERS.ZERO,
        inputMarketId,
        lpTokenInputPar.minus(INTEGERS.ONE),
      );

      await expectThrow(
        dolomiteMargin.operation.initiate()
          .trade({
            inputMarketId,
            outputMarketId,
            primaryAccountOwner: takerAccount.owner,
            primaryAccountId: takerAccount.number,
            otherAccountOwner: makerAccount.owner,
            otherAccountId: makerAccount.number,
            autoTrader: lpToken.address,
            calculateAmountWithMakerAccount: true,
            data: toBytesNoPadding(ethers.utils.defaultAbiCoder.encode(['uint256'], ['1'])),
            amount: {
              value: INTEGERS.ONE,
              reference: AmountReference.Delta,
              denomination: AmountDenomination.Actual,
            }
          })
          .commit({ from: owner1 }),
        'DolomiteAmmPair: insufficient input amount',
      );
    });

    it('should fail when liquidity is insufficient', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const inputMarketId = marketIdA;
      const outputMarketId = marketIdB;
      const makerAccount = { owner: lpToken.address, number: INTEGERS.ZERO, };
      const takerAccount = { owner: owner1, number: INTEGERS.ZERO, };
      await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });
      await dolomiteMargin.testing.setAccountBalance(lpToken.address, INTEGERS.ZERO, outputMarketId, INTEGERS.MAX_UINT_112);

      await expectThrow(
        dolomiteMargin.operation.initiate()
          .trade({
            inputMarketId,
            outputMarketId,
            primaryAccountOwner: takerAccount.owner,
            primaryAccountId: takerAccount.number,
            otherAccountOwner: makerAccount.owner,
            otherAccountId: makerAccount.number,
            autoTrader: lpToken.address,
            calculateAmountWithMakerAccount: true,
            data: toBytesNoPadding(ethers.utils.defaultAbiCoder.encode(['uint256'], [INTEGERS.MAX_UINT_112.toFixed()])),
            amount: {
              value: parA,
              reference: AmountReference.Delta,
              denomination: AmountDenomination.Actual,
            }
          })
          .commit({ from: owner1 }),
        'DolomiteAmmPair: insufficient liquidity',
      );
    });

    it('should fail when liquidity output amount is too large and messes up K value', async () => {
      const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
      const inputMarketId = marketIdA;
      const outputMarketId = marketIdB;
      const makerAccount = { owner: lpToken.address, number: INTEGERS.ZERO, };
      const takerAccount = { owner: owner1, number: INTEGERS.ZERO, };
      await dolomiteMargin.admin.setGlobalOperator(owner1, true, { from: admin });

      await expectThrow(
        dolomiteMargin.operation.initiate()
          .trade({
            inputMarketId,
            outputMarketId,
            primaryAccountOwner: takerAccount.owner,
            primaryAccountId: takerAccount.number,
            otherAccountOwner: makerAccount.owner,
            otherAccountId: makerAccount.number,
            autoTrader: lpToken.address,
            calculateAmountWithMakerAccount: true,
            data: toBytesNoPadding(ethers.utils.defaultAbiCoder.encode(['uint256'], [parB.div(1000).toFixed()])),
            amount: {
              value: INTEGERS.ONE,
              reference: AmountReference.Delta,
              denomination: AmountDenomination.Par,
            }
          })
          .commit({ from: owner1 }),
        'DolomiteAmmPair: K',
      );
    });
  });
});

// ============ Helper Functions ============

async function addMarket(token: ErroringToken) {
  const priceOracle = dolomiteMargin.testing.priceOracle.address;
  const interestSetter = dolomiteMargin.testing.interestSetter.address;
  const price = new BigNumber('1e40'); // large to prevent hitting minBorrowValue check
  const marginPremium = INTEGERS.ZERO;
  const liquidationSpreadPremium = INTEGERS.ZERO;
  const maxSupplyWei = INTEGERS.ZERO;
  const maxBorrowWei = INTEGERS.ZERO;
  const earningsRateOverride = INTEGERS.ZERO;
  const isClosing = false;

  await dolomiteMargin.testing.priceOracle.setPrice(token.options.address, price);

  await dolomiteMargin.admin.addMarket(
    token.options.address,
    priceOracle,
    interestSetter,
    marginPremium,
    liquidationSpreadPremium,
    maxSupplyWei,
    maxBorrowWei,
    earningsRateOverride,
    isClosing,
    { from: admin },
  );

  await mineAvgBlock();
}

async function addLiquidity(
  walletAddress: address,
  amountADesired: BigNumber,
  amountBDesired: BigNumber,
  tokenA: address,
  tokenB: address,
  skipGasCheck: boolean = false,
) {
  const result = await dolomiteMargin.dolomiteAmmRouterProxy.addLiquidity(
    walletAddress,
    INTEGERS.ZERO,
    tokenA,
    tokenB,
    amountADesired,
    amountBDesired,
    INTEGERS.ONE,
    INTEGERS.ONE,
    defaultDeadline,
    defaultBalanceCheckFlag,
    { from: walletAddress },
  );

  await checkSyncLogs(result, tokenA, tokenB);

  if (skipGasCheck) {
    console.log('\t#addLiquidity gas used  ', result.gasUsed.toString());
  }

  return result;
}

async function removeLiquidity(
  walletAddress: address,
  liquidity: BigNumber,
  amountAMin: BigNumber = INTEGERS.ZERO,
  amountBMin: BigNumber = INTEGERS.ZERO,
  permitSignature?: PermitSignature
) {
  let result: TxResult;
  if (permitSignature) {
    result = await dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidityWithPermit(
      walletAddress,
      INTEGERS.ZERO,
      tokenA.address,
      tokenB.address,
      liquidity,
      amountAMin,
      amountBMin,
      defaultDeadline,
      permitSignature,
      { from: walletAddress },
    );
  } else {
    result = await dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidity(
      walletAddress,
      INTEGERS.ZERO,
      tokenA.address,
      tokenB.address,
      liquidity,
      amountAMin,
      amountBMin,
      defaultDeadline,
      { from: walletAddress },
    );
  }

  await checkSyncLogs(result, tokenA.address, tokenB.address);

  console.log('\t#removeLiquidity gas used  ', result.gasUsed.toString());

  return result;
}

async function swapExactTokensForTokens(
  walletAddress: address,
  amountIn: Integer,
  path: string[] = defaultPath,
  amountOutMin: Integer = INTEGERS.ONE,
  logGasUsage = true,
) {
  const result = await dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokens(
    INTEGERS.ZERO,
    amountIn,
    amountOutMin,
    path,
    defaultDeadline,
    defaultBalanceCheckFlag,
    { from: walletAddress },
  );

  if (logGasUsage) {
    console.log(`\t#swapExactTokensForTokens gas used ${path.length}-path `, result.gasUsed.toString());
  }

  return result;
}

async function setUpBasicBalances() {
  const marketA = await dolomiteMargin.getters.getMarketIdByTokenAddress(tokenA.address);
  const marketB = await dolomiteMargin.getters.getMarketIdByTokenAddress(tokenB.address);
  const marketC = await dolomiteMargin.getters.getMarketIdByTokenAddress(tokenC.address);

  return Promise.all([
    dolomiteMargin.testing.setAccountBalance(owner1, INTEGERS.ZERO, marketA, parA),
    dolomiteMargin.testing.setAccountBalance(owner1, INTEGERS.ZERO, marketB, parB),
    dolomiteMargin.testing.setAccountBalance(owner2, INTEGERS.ZERO, marketA, parA),
    dolomiteMargin.testing.setAccountBalance(owner2, INTEGERS.ZERO, marketB, parB),
    dolomiteMargin.testing.setAccountBalance(owner2, INTEGERS.ZERO, marketC, parC),
  ]);
}

async function checkSyncLogs(result: TxResult, tokenA: address, tokenB: address) {
  const pairAddress = await dolomiteMargin.dolomiteAmmFactory.getPair(tokenA, tokenB);
  const pairContract = dolomiteMargin.contracts.getDolomiteAmmPair(pairAddress);
  const pair = dolomiteMargin.getDolomiteAmmPair(pairAddress);
  const syncEventLogs = await pairContract.getPastEvents(
    'Sync',
    { fromBlock: result.blockNumber ?? 'latest' },
  );
  expect(syncEventLogs.length === 1);
  for (const eventLog of syncEventLogs) {
    const log = dolomiteMargin.logs.parseEventLogWithContract(pairContract, eventLog);
    const [marketId0, marketId1] = await Promise.all([pair.marketId0(), pair.marketId1()]);
    const [balance0, balance1] = await Promise.all([
      dolomiteMargin.getters.getAccountPar(log.address, INTEGERS.ZERO, marketId0),
      dolomiteMargin.getters.getAccountPar(log.address, INTEGERS.ZERO, marketId1),
    ]);
    expect(log.args.reserve0).to.eql(balance0);
    expect(log.args.reserve1).to.eql(balance1);
  }
}
