import BigNumber from 'bignumber.js';
import { promisify } from 'es6-promisify';
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
import { expectThrow, expectThrowInvalidBalance } from '../helpers/Expect';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { setupMarkets } from '../helpers/DolomiteMarginHelpers';
import { mineAvgBlock, resetEVM, snapshot } from '../helpers/EVM';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { PermitSignature } from '../../src/modules/DolomiteAmmRouterProxy';
import { EIP712_DOMAIN_STRUCT } from '../../src/lib/SignatureHelper';

let defaultPath: address[];
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
let snapshotId: string;
let admin: address;
let owner1: address;
let owner2: address;
let owner3: address;
let token_ab: address;
let token_bc: address;
let marketIdA: Integer;
let marketIdB: Integer;
let marketIdC: Integer;

const zero = new BigNumber(0);
const parA = new BigNumber('1000000000000000000');
const parB = new BigNumber('2000000');
const parC = new BigNumber('300000000000000000000');
const prices = [new BigNumber('1e20'), new BigNumber('1e32'), new BigNumber('1e18'), new BigNumber('1e21')];
const defaultDeadline = new BigNumber('123456789123');
const defaultBalanceCheckFlag = BalanceCheckFlag.From;
const defaultBalanceCheckFlagForMarginTrade = BalanceCheckFlag.To;
const defaultIsClosing = false;

describe('DolomiteAmmRouterProxy', () => {
  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    defaultPath = [dolomiteMargin.testing.tokenA.address, dolomiteMargin.testing.tokenB.address];
    accounts = r.accounts;
    admin = accounts[0];
    owner1 = accounts[1];
    owner2 = accounts[2];
    owner3 = accounts[3];

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);
    await Promise.all([
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenA.address, prices[0]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenB.address, prices[1]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.testing.tokenC.address, prices[2]),
      dolomiteMargin.testing.priceOracle.setPrice(dolomiteMargin.weth.address, prices[3]),
      setUpBasicBalances(),
    ]);

    expect(await dolomiteMargin.dolomiteAmmFactory.getPairInitCodeHash()).to.eql(
      await dolomiteMargin.dolomiteAmmRouterProxy.getPairInitCodeHash(),
    );

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

    await Promise.all([
      dolomiteMargin.dolomiteAmmFactory.createPair(
        dolomiteMargin.testing.tokenA.address,
        dolomiteMargin.testing.tokenB.address,
      ),
    ]);

    marketIdA = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenA.address);
    marketIdB = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenB.address);
    marketIdC = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenC.address);

    // Needs to be done once the balances are set up
    await addLiquidity(
      owner2,
      parA.div(100),
      parB.div(100),
      dolomiteMargin.testing.tokenA.address,
      dolomiteMargin.testing.tokenB.address,
    );
    await addLiquidity(
      owner2,
      parB.div(100),
      parC.div(100),
      dolomiteMargin.testing.tokenB.address,
      dolomiteMargin.testing.tokenC.address,
    );

    token_ab = await dolomiteMargin.dolomiteAmmFactory.getPair(
      dolomiteMargin.testing.tokenA.address,
      dolomiteMargin.testing.tokenB.address,
    );

    token_bc = await dolomiteMargin.dolomiteAmmFactory.getPair(
      dolomiteMargin.testing.tokenB.address,
      dolomiteMargin.testing.tokenC.address,
    );

    expect(await dolomiteMargin.dolomiteAmmFactory.allPairsLength()).to.eql(new BigNumber(2));

    await mineAvgBlock();

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('#addLiquidity', () => {
    describe('Success cases', () => {
      it('should work for normal case', async () => {
        await addLiquidity(
          owner1,
          parA,
          parB,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const reserves = await pair.getReservesWei();

        const marketId0 = await pair.marketId0();
        const balance0 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0);
        expect(reserves.reserve0).to.eql(balance0);

        const marketId1 = await pair.marketId1();
        const balance1 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1);
        expect(reserves.reserve1).to.eql(balance1);

        const balance = await pair.balanceOf(owner1);
        await pair.transfer(owner3, balance, { from: owner1 });
        expect(await pair.balanceOf(owner1)).to.eql(INTEGERS.ZERO);
        expect(await pair.balanceOf(owner3)).to.eql(balance);
      });

      it('should work for various weights', async () => {
        await addLiquidity(
          owner1,
          parA.div(4),
          parB.div(4),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        await addLiquidity(
          owner1,
          parA.div(3),
          parB.div(4),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        await addLiquidity(
          owner1,
          parA.div(4),
          parB.div(3),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const reserves = await pair.getReservesWei();

        const marketId0 = await pair.marketId0();
        const balance0 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0);
        expect(reserves.reserve0).to.eql(balance0);

        const marketId1 = await pair.marketId1();
        const balance1 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1);
        expect(reserves.reserve1).to.eql(balance1);
      });

      it('should work when cross margin is enabled and balance goes below 0', async () => {
        const marketA = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenA.address);
        const marketB = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenB.address);
        await dolomiteMargin.testing.setAccountBalance(owner1, INTEGERS.ZERO, marketA, parA.times('100'));

        await dolomiteMargin.dolomiteAmmRouterProxy.addLiquidity(
          owner1,
          INTEGERS.ZERO,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          parA.times('1.01'),
          parB.times('1.01'),
          INTEGERS.ONE,
          parB,
          defaultDeadline,
          BalanceCheckFlag.None,
          { from: owner1 },
        );

        const balanceB = await dolomiteMargin.getters.getAccountWei(owner1, INTEGERS.ZERO, marketB);
        expect(balanceB.isLessThan(INTEGERS.ZERO)).to.eql(true);
      });
    });

    describe('Failure cases', () => {
      it('should fail when transaction expires', async () => {
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.addLiquidity(
            owner1,
            INTEGERS.ZERO,
            dolomiteMargin.testing.tokenA.address,
            dolomiteMargin.testing.tokenB.address,
            parA.times('2'),
            parB.times('2'),
            INTEGERS.ONE,
            INTEGERS.ONE,
            new BigNumber(Math.floor((new Date().getTime() / 1000) - 3600)),
            defaultBalanceCheckFlag,
            { from: owner1 },
          ),
          'DolomiteAmmRouterProxy: deadline expired',
        );
      });

      it('should not work when amount exceeds user balance', async () => {
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.addLiquidity(
            owner1,
            INTEGERS.ZERO,
            dolomiteMargin.testing.tokenA.address,
            dolomiteMargin.testing.tokenB.address,
            parA.times('2'),
            parB.times('2'),
            INTEGERS.ONE,
            INTEGERS.ONE,
            defaultDeadline,
            defaultBalanceCheckFlag,
            { from: owner1 },
          ),
          `OperationImpl: Undercollateralized account <${owner1.toLowerCase()}, 0>`,
        );
      });

      it('should not work when amountA exceeds user preference', async () => {
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.addLiquidity(
            owner1,
            INTEGERS.ZERO,
            dolomiteMargin.testing.tokenA.address,
            dolomiteMargin.testing.tokenB.address,
            parA.div('3'),
            parB.div('4'),
            parA,
            INTEGERS.ONE,
            defaultDeadline,
            defaultBalanceCheckFlag,
            { from: owner1 },
          ),
          'DolomiteAmmRouterProxy: insufficient A amount',
        );
      });

      it('should not work when amountB exceeds user preference', async () => {
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.addLiquidity(
            owner1,
            INTEGERS.ZERO,
            dolomiteMargin.testing.tokenA.address,
            dolomiteMargin.testing.tokenB.address,
            parA.div('4'),
            parB.div('3'),
            INTEGERS.ONE,
            parB,
            defaultDeadline,
            defaultBalanceCheckFlag,
            { from: owner1 },
          ),
          'DolomiteAmmRouterProxy: insufficient B amount',
        );
      });

      it('should not work when the user balance goes below 0', async () => {
        const marketA = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenA.address);
        const marketB = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenB.address);
        const marketC = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenC.address);
        const accountNumber = INTEGERS.ZERO;

        await dolomiteMargin.testing.setAccountBalance(owner1, accountNumber, marketA, INTEGERS.ZERO);
        await dolomiteMargin.testing.setAccountBalance(owner1, accountNumber, marketB, parB);
        await dolomiteMargin.testing.setAccountBalance(owner1, accountNumber, marketC, parC.times('100'));

        await expectThrowInvalidBalance(
          dolomiteMargin.dolomiteAmmRouterProxy.addLiquidity(
            owner1,
            accountNumber,
            dolomiteMargin.testing.tokenA.address,
            dolomiteMargin.testing.tokenB.address,
            parA,
            parB,
            INTEGERS.ONE,
            parB,
            defaultDeadline,
            defaultBalanceCheckFlag,
            { from: owner1 },
          ),
          owner1,
          accountNumber,
          marketA
        );
        let balanceA = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, marketA);
        expect(balanceA).to.eql(INTEGERS.ZERO);
        let balanceB = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, marketB);
        expect(balanceB).to.eql(parB);

        await dolomiteMargin.testing.setAccountBalance(owner1, accountNumber, marketA, parA);
        await dolomiteMargin.testing.setAccountBalance(owner1, accountNumber, marketB, INTEGERS.ZERO);
        await dolomiteMargin.testing.setAccountBalance(owner1, accountNumber, marketC, parC.times('100'));

        await expectThrowInvalidBalance(
          dolomiteMargin.dolomiteAmmRouterProxy.addLiquidity(
            owner1,
            accountNumber,
            dolomiteMargin.testing.tokenA.address,
            dolomiteMargin.testing.tokenB.address,
            parA,
            parB,
            parA,
            INTEGERS.ONE,
            defaultDeadline,
            defaultBalanceCheckFlag,
            { from: owner1 },
          ),
          owner1,
          accountNumber,
          marketB,
        );

        balanceA = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, marketA);
        expect(balanceA).to.eql(parA);
        balanceB = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, marketB);
        expect(balanceB).to.eql(INTEGERS.ZERO);
      });
    });
  });

  describe('#removeLiquidity', () => {
    describe('Success cases', () => {
      it('should work for normal case', async () => {
        await addLiquidity(
          owner1,
          parA,
          parB,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const lpToken = await dolomiteMargin.getDolomiteAmmPair(token_ab);
        const liquidity = await lpToken.balanceOf(owner1);

        await lpToken.approve(dolomiteMargin.contracts.dolomiteAmmRouterProxy.options.address, INTEGERS.ONES_255, {
          from: owner1,
        });

        await removeLiquidity(owner1, liquidity);

        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const reserves = await pair.getReservesWei();

        const marketId0 = await pair.marketId0();
        const balance0 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0);
        expect(reserves.reserve0).to.eql(balance0);

        const marketId1 = await pair.marketId1();
        const balance1 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1);
        expect(reserves.reserve1).to.eql(balance1);
      });

      it('should work without infinite approval', async () => {
        await addLiquidity(
          owner1,
          parA,
          parB,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const lpToken = await dolomiteMargin.getDolomiteAmmPair(token_ab);
        const liquidity = await lpToken.balanceOf(owner1);

        await lpToken.approve(dolomiteMargin.contracts.dolomiteAmmRouterProxy.options.address, liquidity, {
          from: owner1,
        });

        await removeLiquidity(owner1, liquidity);

        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const reserves = await pair.getReservesWei();

        const marketId0 = await pair.marketId0();
        const balance0 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0);
        expect(reserves.reserve0).to.eql(balance0);

        const marketId1 = await pair.marketId1();
        const balance1 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1);
        expect(reserves.reserve1).to.eql(balance1);
      });
    });

    describe('Failure cases', () => {
      it('should not work when amount exceeds user balance', async () => {
        await addLiquidity(
          owner1,
          parA,
          parB,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const liquidity = await lpToken.balanceOf(owner1);

        const dolomiteAmmRouterProxyAddress = dolomiteMargin.contracts.dolomiteAmmRouterProxy.options.address;

        await lpToken.approve(dolomiteAmmRouterProxyAddress, INTEGERS.ONES_255, { from: owner1 });

        await expectThrow(removeLiquidity(owner1, liquidity.times('2')), '');

        await expectThrow(
          removeLiquidity(owner1, liquidity, parA.times('2'), parB.times('99').div('100')),
          `DolomiteAmmRouterProxy: insufficient A amount <${parA}, ${parA.times('2')}>`,
        );
        await expectThrow(
          removeLiquidity(owner1, liquidity, parA.times('99').div('100'), parB.times('2')),
          `DolomiteAmmRouterProxy: insufficient B amount <${parB}, ${parB.times('2')}>`,
        );
      });

      it('should not work when liquidity translates to 0 wei', async () => {
        await addLiquidity(
          owner1,
          parA,
          parB,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
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
  });

  describe('#removeLiquidityWithPermit', () => {
    describe('Success cases', () => {
      it('should work when permitting max', async () => {
        await addLiquidity(
          owner1,
          parA,
          parB,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const lpToken = await dolomiteMargin.getDolomiteAmmPair(token_ab);
        const liquidity = await lpToken.balanceOf(owner1);

        const dataToSign = {
          types: {
            EIP712Domain: EIP712_DOMAIN_STRUCT,
            Permit: [
              { type: 'address', name: 'owner' },
              { type: 'address', name: 'spender' },
              { type: 'uint256', name: 'value' },
              { type: 'uint256', name: 'nonce' },
              { type: 'uint256', name: 'deadline' },
            ],
          },
          domain: {
            name: await lpToken.name(),
            version: '1',
            chainId: '1', // getting chain ID doesn't work with ganache and defaults to '1'
            verifyingContract: lpToken.address,
          },
          primaryType: 'Permit',
          message: {
            owner: owner1,
            spender: dolomiteMargin.contracts.dolomiteAmmRouterProxy.options.address,
            value: INTEGERS.MAX_UINT.toFixed(),
            nonce: '0',
            deadline: defaultDeadline.toFixed(),
          },
        };

        const provider = dolomiteMargin.web3.currentProvider;
        const sendAsync = promisify(provider.send).bind(provider);
        const response = await sendAsync({
          method: 'eth_signTypedData',
          params: [owner1, dataToSign],
          jsonrpc: '2.0',
          id: new Date().getTime(),
        });

        const permitSignature: PermitSignature = {
          approveMax: true,
          r: `0x${response.result.slice(2, 66)}`,
          s: `0x${response.result.slice(66, 130)}`,
          v: `0x${response.result.slice(130, 132)}`,
        };
        await removeLiquidity(owner1, liquidity, INTEGERS.ZERO, INTEGERS.ZERO, permitSignature);

        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const reserves = await pair.getReservesWei();

        const marketId0 = await pair.marketId0();
        const balance0 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0);
        expect(reserves.reserve0).to.eql(balance0);

        const marketId1 = await pair.marketId1();
        const balance1 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1);
        expect(reserves.reserve1).to.eql(balance1);
      });

      it('should work when permitting just enough', async () => {
        await addLiquidity(
          owner1,
          parA,
          parB,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const lpToken = await dolomiteMargin.getDolomiteAmmPair(token_ab);
        const liquidity = await lpToken.balanceOf(owner1);

        const dataToSign = {
          types: {
            EIP712Domain: EIP712_DOMAIN_STRUCT,
            Permit: [
              { type: 'address', name: 'owner' },
              { type: 'address', name: 'spender' },
              { type: 'uint256', name: 'value' },
              { type: 'uint256', name: 'nonce' },
              { type: 'uint256', name: 'deadline' },
            ],
          },
          domain: {
            name: await lpToken.name(),
            version: '1',
            chainId: '1', // getting chain ID doesn't work with ganache and defaults to '1'
            verifyingContract: lpToken.address,
          },
          primaryType: 'Permit',
          message: {
            owner: owner1,
            spender: dolomiteMargin.contracts.dolomiteAmmRouterProxy.options.address,
            value: liquidity.toFixed(),
            nonce: '0',
            deadline: defaultDeadline.toFixed(),
          },
        };

        const provider = dolomiteMargin.web3.currentProvider;
        const sendAsync = promisify(provider.send).bind(provider);
        const response = await sendAsync({
          method: 'eth_signTypedData',
          params: [owner1, dataToSign],
          jsonrpc: '2.0',
          id: new Date().getTime(),
        });

        const permitSignature: PermitSignature = {
          approveMax: false,
          r: `0x${response.result.slice(2, 66)}`,
          s: `0x${response.result.slice(66, 130)}`,
          v: `0x${response.result.slice(130, 132)}`,
        };
        await removeLiquidity(owner1, liquidity, INTEGERS.ZERO, INTEGERS.ZERO, permitSignature);

        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const reserves = await pair.getReservesWei();

        const marketId0 = await pair.marketId0();
        const balance0 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0);
        expect(reserves.reserve0).to.eql(balance0);

        const marketId1 = await pair.marketId1();
        const balance1 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1);
        expect(reserves.reserve1).to.eql(balance1);
      });
    });

    describe('Failure cases', () => {
      it('should not work when permit fails', async () => {
        await addLiquidity(
          owner1,
          parA,
          parB,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const lpToken = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const liquidity = await lpToken.balanceOf(owner1);

        const dolomiteAmmRouterProxyAddress = dolomiteMargin.contracts.dolomiteAmmRouterProxy.options.address;

        await lpToken.approve(dolomiteAmmRouterProxyAddress, INTEGERS.ONES_255, { from: owner1 });

        await expectThrow(removeLiquidity(owner1, liquidity.times('2')), '');

        await expectThrow(
          removeLiquidity(owner1, liquidity, parA.times('2'), parB.times('99').div('100')),
          `DolomiteAmmRouterProxy: insufficient A amount <${parA}, ${parA.times('2')}>`,
        );
        await expectThrow(
          removeLiquidity(owner1, liquidity, parA.times('99').div('100'), parB.times('2')),
          `DolomiteAmmRouterProxy: insufficient B amount <${parB}, ${parB.times('2')}>`,
        );
      });

      it('should not work when permit deadline fails', async () => {
        await addLiquidity(
          owner1,
          parA,
          parB,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const lpToken = await dolomiteMargin.getDolomiteAmmPair(token_ab);
        const liquidity = await lpToken.balanceOf(owner1);

        const deadline = INTEGERS.ONE;
        const dataToSign = {
          types: {
            EIP712Domain: EIP712_DOMAIN_STRUCT,
            Permit: [
              { type: 'address', name: 'owner' },
              { type: 'address', name: 'spender' },
              { type: 'uint256', name: 'value' },
              { type: 'uint256', name: 'nonce' },
              { type: 'uint256', name: 'deadline' },
            ],
          },
          domain: {
            name: await lpToken.name(),
            version: '1',
            chainId: '1', // getting chain ID doesn't work with ganache and defaults to '1'
            verifyingContract: lpToken.address,
          },
          primaryType: 'Permit',
          message: {
            owner: owner1,
            spender: dolomiteMargin.contracts.dolomiteAmmRouterProxy.options.address,
            value: liquidity.toFixed(),
            nonce: '0',
            deadline: deadline.toFixed(),
          },
        };

        const provider = dolomiteMargin.web3.currentProvider;
        const sendAsync = promisify(provider.send).bind(provider);
        const response = await sendAsync({
          method: 'eth_signTypedData',
          params: [owner1, dataToSign],
          jsonrpc: '2.0',
          id: new Date().getTime(),
        });

        const permitSignature: PermitSignature = {
          approveMax: false,
          r: `0x${response.result.slice(2, 66)}`,
          s: `0x${response.result.slice(66, 130)}`,
          v: `0x${response.result.slice(130, 132)}`,
        };
        await expectThrow(
          removeLiquidity(owner1, liquidity, INTEGERS.ZERO, INTEGERS.ZERO, permitSignature, deadline),
          'DolomiteAmmERC20: expired',
        );
      });

      it('should not work when permit signature fails', async () => {
        await addLiquidity(
          owner1,
          parA,
          parB,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const lpToken = await dolomiteMargin.getDolomiteAmmPair(token_ab);
        const liquidity = await lpToken.balanceOf(owner1);

        const dataToSign = {
          types: {
            EIP712Domain: EIP712_DOMAIN_STRUCT,
            Permit: [
              { type: 'address', name: 'owner' },
              { type: 'address', name: 'spender' },
              { type: 'uint256', name: 'value' },
              { type: 'uint256', name: 'nonce' },
              { type: 'uint256', name: 'deadline' },
            ],
          },
          domain: {
            name: await lpToken.name(),
            version: '1',
            chainId: '1', // getting chain ID doesn't work with ganache and defaults to '1'
            verifyingContract: lpToken.address,
          },
          primaryType: 'Permit',
          message: {
            owner: owner1,
            spender: dolomiteMargin.contracts.dolomiteAmmRouterProxy.options.address,
            value: liquidity.toFixed(),
            nonce: '0',
            deadline: defaultDeadline.toFixed(),
          },
        };

        const provider = dolomiteMargin.web3.currentProvider;
        const sendAsync = promisify(provider.send).bind(provider);
        const response = await sendAsync({
          method: 'eth_signTypedData',
          params: [owner1, dataToSign],
          jsonrpc: '2.0',
          id: new Date().getTime(),
        });

        const permitSignature: PermitSignature = {
          approveMax: false,
          r: `0x${'f'.repeat(64)}`, // mess up the signature on purpose
          s: `0x${response.result.slice(66, 130)}`,
          v: `0x${response.result.slice(130, 132)}`,
        };
        await expectThrow(
          removeLiquidity(owner1, liquidity, INTEGERS.ZERO, INTEGERS.ZERO, permitSignature),
          'DolomiteAmmERC20: invalid signature',
        );
      });
    });
  });

  describe('#swapExactTokensForTokens', () => {
    describe('Success cases', () => {
      it('should work for normal case', async () => {
        await addLiquidity(
          owner1,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        await swapExactTokensForTokens(owner1, parA.div(100));

        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const { reserve0, reserve1 } = await pair.getReservesWei();

        const marketId0 = await pair.marketId0();
        const reserveBalance0 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0);
        expect(reserve0).to.eql(reserveBalance0);

        const marketId1 = await pair.marketId1();
        const reserveBalance1 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1);
        expect(reserve1).to.eql(reserveBalance1);
      });

      it('should work for Par case', async () => {
        await addLiquidity(
          owner1,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const createAmount = (value: Integer) => {
          return {
            sign: true,
            denomination: AmountDenomination.Par,
            ref: AmountReference.Delta,
            value: value.toFixed(0),
          };
        };

        await dolomiteMargin.contracts.callContractFunction(
          dolomiteMargin.contracts.dolomiteAmmRouterProxy.methods.swapExactTokensForTokensAndModifyPosition(
            {
              tokenPath: defaultPath,
              marginTransferToken: ADDRESSES.ZERO,
              tradeAccountNumber: INTEGERS.ZERO.toFixed(0),
              otherAccountNumber: INTEGERS.ZERO.toFixed(0),
              amountIn: createAmount(parA.div(100)),
              amountOut: createAmount(INTEGERS.ZERO),
              marginTransferWei: INTEGERS.ZERO.toFixed(0),
              isDepositIntoTradeAccount: false,
              expiryTimeDelta: INTEGERS.ZERO.toFixed(0),
              balanceCheckFlag: defaultBalanceCheckFlag,
            },
            defaultDeadline.toFixed(0),
          ),
          { from: owner1 },
        );

        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const { reserve0, reserve1 } = await pair.getReservesWei();

        const marketId0 = await pair.marketId0();
        const reserveBalance0 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0);
        expect(reserve0).to.eql(reserveBalance0);

        const marketId1 = await pair.marketId1();
        const reserveBalance1 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1);
        expect(reserve1).to.eql(reserveBalance1);
      });

      it('should work for normal case with a path of more than 2 tokens', async () => {
        await addLiquidity(
          owner2,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        await addLiquidity(
          owner2,
          parB.div(10),
          parC.div(10),
          dolomiteMargin.testing.tokenB.address,
          dolomiteMargin.testing.tokenC.address,
        );

        const _3Path = [
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          dolomiteMargin.testing.tokenC.address,
        ];

        await swapExactTokensForTokens(owner1, parA.div(100), _3Path);

        await swapExactTokensForTokens(owner1, parA.div(100), _3Path);

        const pair_ab = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const reserves_ab = await pair_ab.getReservesWei();

        const marketId0_ab = await pair_ab.marketId0();
        const balance0_ab = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0_ab);
        expect(reserves_ab.reserve0).to.eql(balance0_ab);

        const marketId1_ab = await pair_ab.marketId1();
        const balance1_ab = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1_ab);
        expect(reserves_ab.reserve1).to.eql(balance1_ab);

        const pair_bc = dolomiteMargin.getDolomiteAmmPair(token_bc);
        const reserves_bc = await pair_bc.getReservesWei();

        const marketId0_bc = await pair_bc.marketId0();
        const balance0_bc = await dolomiteMargin.getters.getAccountWei(token_bc, INTEGERS.ZERO, marketId0_bc);
        expect(reserves_bc.reserve0).to.eql(balance0_bc);

        const marketId1_bc = await pair_bc.marketId1();
        const balance1_bc = await dolomiteMargin.getters.getAccountWei(token_bc, INTEGERS.ZERO, marketId1_bc);
        expect(reserves_bc.reserve1).to.eql(balance1_bc);
      });

      it('should work when cross margin is enabled and balance goes below 0', async () => {
        await dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokens(
          INTEGERS.ZERO,
          parA.times('1.01'),
          parB.times('0'),
          [dolomiteMargin.testing.tokenA.address, dolomiteMargin.testing.tokenB.address],
          defaultDeadline,
          BalanceCheckFlag.None,
          { from: owner1 },
        );

        const marketA = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenA.address);
        const balanceA = await dolomiteMargin.getters.getAccountWei(owner1, INTEGERS.ZERO, marketA);
        expect(balanceA.isLessThan(INTEGERS.ZERO)).to.eql(true);
      });
    });

    describe('Failure cases', () => {
      it('should not work when trade size outputs too little', async () => {
        await addLiquidity(
          owner1,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        await expectThrow(
          swapExactTokensForTokens(owner1, parA, defaultPath, parB),
          `DolomiteAmmRouterProxy: insufficient output amount <198139, ${parB}>`,
        );
      });

      it('should not work when cross margin is disabled and balance goes below 0', async () => {
        const marketA = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenA.address);
        const marketB = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenB.address);
        const marketC = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenC.address);
        const accountNumber = INTEGERS.ZERO;

        await expectThrowInvalidBalance(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokens(
            accountNumber,
            parA.times('1.1'),
            INTEGERS.ONE,
            [dolomiteMargin.testing.tokenA.address, dolomiteMargin.testing.tokenB.address],
            defaultDeadline,
            BalanceCheckFlag.Both,
            { from: owner1 },
          ),
          owner1,
          accountNumber,
          marketA,
        );
        const balanceA = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, marketA);
        expect(balanceA.isGreaterThan(INTEGERS.ZERO)).to.eql(true);

        await expectThrowInvalidBalance(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokens(
            accountNumber,
            parB.times('1.1'),
            INTEGERS.ONE,
            [dolomiteMargin.testing.tokenB.address, dolomiteMargin.testing.tokenA.address],
            defaultDeadline,
            BalanceCheckFlag.Both,
            { from: owner1 },
          ),
          owner1,
          accountNumber,
          marketB,
        );
        const balanceB = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, marketB);
        expect(balanceB.isGreaterThan(INTEGERS.ZERO)).to.eql(true);

        const tradeAccountNumber = new BigNumber('123');
        await dolomiteMargin.testing.setAccountBalance(owner1, accountNumber, marketC, parC);
        await expectThrowInvalidBalance(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
            tradeAccountNumber,
            accountNumber,
            parA.div(100),
            INTEGERS.ONE,
            [dolomiteMargin.testing.tokenA.address, dolomiteMargin.testing.tokenB.address],
            dolomiteMargin.testing.tokenC.address,
            parC.times('1.01'),
            true,
            INTEGERS.ZERO,
            defaultDeadline,
            BalanceCheckFlag.Both, // BOTH is equal to `tradeAccountNumber` & `otherAccountNumber` which equals `123` & `0`
            { from: owner1 },
          ),
          owner1,
          tradeAccountNumber,
          marketA,
        );
        await expectThrowInvalidBalance(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
            tradeAccountNumber,
            accountNumber,
            parA.div(100),
            INTEGERS.ONE,
            [dolomiteMargin.testing.tokenA.address, dolomiteMargin.testing.tokenB.address],
            dolomiteMargin.testing.tokenC.address,
            parC.times('1.01'),
            true,
            INTEGERS.ZERO,
            defaultDeadline,
            BalanceCheckFlag.From, // BOTH is equal to `tradeAccountNumber` & `otherAccountNumber` which equals `123` & `0`
            { from: owner1 },
          ),
          owner1,
          tradeAccountNumber,
          marketA,
        );
        await expectThrowInvalidBalance(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
            tradeAccountNumber,
            accountNumber,
            parA.div(100),
            INTEGERS.ONE,
            [dolomiteMargin.testing.tokenA.address, dolomiteMargin.testing.tokenB.address],
            dolomiteMargin.testing.tokenC.address,
            parC.times('1.01'),
            true,
            INTEGERS.ZERO,
            defaultDeadline,
            BalanceCheckFlag.To, // TO is equal to the `otherAccountNumber` which equals `0`
            { from: owner1 },
          ),
          owner1,
          accountNumber,
          marketC,
        );
        const balanceC = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, marketC);
        expect(balanceC.isGreaterThan(INTEGERS.ZERO)).to.eql(true);

        // open the position
        await dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
          tradeAccountNumber,
          accountNumber,
          parA.div('100'),
          INTEGERS.ONE,
          [dolomiteMargin.testing.tokenA.address, dolomiteMargin.testing.tokenB.address],
          dolomiteMargin.testing.tokenC.address,
          parC.div(10),
          true,
          INTEGERS.ZERO,
          defaultDeadline,
          BalanceCheckFlag.To, // TO is equal to the `otherAccountNumber` which equals `0`
          { from: owner1 },
        );

        // push the price up so the position can be closed for a profit
        await swapExactTokensForTokens(owner1, parA, defaultPath);

        // It should fail when you input `From` or Both
        await expectThrowInvalidBalance(
          dolomiteMargin.dolomiteAmmRouterProxy.swapTokensForExactTokensAndModifyPosition(
            tradeAccountNumber,
            accountNumber,
            INTEGERS.MAX_UINT_128,
            parA.div('100').times('1.01'), // overpay any interest accrued
            [dolomiteMargin.testing.tokenB.address, dolomiteMargin.testing.tokenA.address],
            dolomiteMargin.testing.tokenC.address,
            parC.div(10).times('1.000001'),
            false,
            INTEGERS.ZERO,
            defaultDeadline,
            BalanceCheckFlag.From, // FROM is equal to the `tradeAccountNumber` which equals `0`
            { from: owner1 },
          ),
          owner1,
          tradeAccountNumber,
          marketC,
        );
        await expectThrowInvalidBalance(
          dolomiteMargin.dolomiteAmmRouterProxy.swapTokensForExactTokensAndModifyPosition(
            tradeAccountNumber,
            accountNumber,
            INTEGERS.MAX_UINT_128,
            parA.div('100').times('1.01'), // overpay any interest accrued
            [dolomiteMargin.testing.tokenB.address, dolomiteMargin.testing.tokenA.address],
            dolomiteMargin.testing.tokenC.address,
            parC.div(10).times('1.000001'),
            false,
            INTEGERS.ZERO,
            defaultDeadline,
            BalanceCheckFlag.Both, // TO is equal to the `otherAccountNumber` which equals `0`
            { from: owner1 },
          ),
          owner1,
          tradeAccountNumber,
          marketC,
        );
      });
    });
  });

  describe('#modifyPositions', () => {
    describe('Success cases', () => {
      it('should work for margin position without expiry', async () => {
        await addLiquidity(
          owner1,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = INTEGERS.ZERO;
        const expiryTimeDelta = new BigNumber('0');
        const inputAmount = parA.div(100);
        const amounts = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountsOutWithPath(inputAmount, defaultPath);
        const outputAmount = amounts[amounts.length - 1];
        const depositAmount = parB.div(10);
        const txResult = await dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
          tradeAccountNumber,
          otherAccountNumber,
          inputAmount,
          INTEGERS.ONE,
          defaultPath,
          dolomiteMargin.testing.tokenB.address,
          depositAmount,
          true,
          expiryTimeDelta,
          defaultDeadline,
          defaultBalanceCheckFlagForMarginTrade,
          { from: owner1 },
        );

        await checkNoExpiryLogs(txResult, owner1, tradeAccountNumber, marketIdA);
        await checkSwapLogs(txResult, owner1, defaultPath, amounts);
        await checkModifyPositionLogs(
          txResult,
          true,
          owner1,
          tradeAccountNumber,
          defaultPath,
          inputAmount.negated(),
          outputAmount,
          dolomiteMargin.testing.tokenB.address,
          depositAmount,
        );

        console.log(
          `\t#swapExactTokensForTokensAndModifyPosition gas used ${defaultPath.length}-path with deposit and expiration`,
          txResult.gasUsed.toString(),
        );

        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const reserves = await pair.getReservesWei();

        const marketId0 = await pair.marketId0();
        const balance0 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0);
        expect(reserves.reserve0).to.eql(balance0);

        const marketId1 = await pair.marketId1();
        const balance1 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1);
        expect(reserves.reserve1).to.eql(balance1);
      });

      it('should work for margin position when depositing all held asset', async () => {
        await addLiquidity(
          owner1,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = INTEGERS.ZERO;
        const amountIn = parA.div(100);
        const amounts = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountsOutWithPath(amountIn, defaultPath);
        const txResult = await dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
          tradeAccountNumber,
          otherAccountNumber,
          amountIn,
          INTEGERS.ONE,
          defaultPath,
          dolomiteMargin.testing.tokenB.address,
          INTEGERS.MAX_UINT,
          true,
          INTEGERS.ZERO,
          defaultDeadline,
          defaultBalanceCheckFlagForMarginTrade,
          { from: owner1 },
        );

        await checkSwapLogs(txResult, owner1, defaultPath, amounts);
        await checkNoExpiryLogs(txResult, owner1, tradeAccountNumber, marketIdA);

        console.log(
          `\t#swapExactTokensForTokensAndModifyPosition gas used ${defaultPath.length}-path with deposit and expiration`,
          txResult.gasUsed.toString(),
        );

        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const reserves = await pair.getReservesWei();

        const marketId0 = await pair.marketId0();
        const balance0 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0);
        expect(reserves.reserve0).to.eql(balance0);

        const marketId1 = await pair.marketId1();
        const balance1 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1);
        expect(reserves.reserve1).to.eql(balance1);
      });

      it('should work for margin position with expiry and closing into held asset', async () => {
        await addLiquidity(
          owner1,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = INTEGERS.ZERO;
        const expiryTimeDelta = new BigNumber('3600');
        const amountIn1 = parA.div(100);
        const amounts1 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountsOutWithPath(amountIn1, defaultPath);
        const marginDeposit = parB.div(10);
        const txResult1 = await dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
          tradeAccountNumber,
          otherAccountNumber,
          amountIn1,
          INTEGERS.ONE,
          defaultPath,
          dolomiteMargin.testing.tokenB.address,
          marginDeposit,
          true,
          expiryTimeDelta,
          defaultDeadline,
          defaultBalanceCheckFlagForMarginTrade,
          { from: owner1 },
        );

        await checkSwapLogs(txResult1, owner1, defaultPath, amounts1);
        await checkExpiryLogs(txResult1, owner1, tradeAccountNumber, marketIdA, expiryTimeDelta);
        await checkModifyPositionLogs(
          txResult1,
          true,
          owner1,
          tradeAccountNumber,
          defaultPath,
          amountIn1.negated(),
          amounts1[amounts1.length - 1],
          dolomiteMargin.testing.tokenB.address,
          marginDeposit,
        );
        console.log(
          `\t#swapExactTokensForTokensAndModifyPosition gas used ${defaultPath.length}-path with deposit and expiration`,
          txResult1.gasUsed.toString(),
        );

        const otherPath = [defaultPath[1], defaultPath[0]];
        const owedMarketId = await dolomiteMargin.getters.getMarketIdByTokenAddress(defaultPath[0]);
        const debtAmount = await dolomiteMargin.getters.getAccountWei(owner1, tradeAccountNumber, owedMarketId);
        const amountIn2 = debtAmount.times('1.0001').integerValue().abs();
        const amounts2 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountsInWithPath(amountIn2, otherPath);
        const txResult2 = await dolomiteMargin.dolomiteAmmRouterProxy.swapTokensForExactTokensAndModifyPosition(
          tradeAccountNumber,
          otherAccountNumber,
          parB,
          amountIn2, // The '1.0001' accounts for any interest accrual
          otherPath,
          dolomiteMargin.testing.tokenB.address,
          INTEGERS.MAX_UINT, // withdraw all
          false,
          INTEGERS.ZERO,
          defaultDeadline,
          BalanceCheckFlag.Both,
          { from: owner1 },
        );
        await checkSwapLogs(txResult2, owner1, otherPath, amounts2);
        await checkModifyPositionLogs(
          txResult2,
          false,
          owner1,
          tradeAccountNumber,
          otherPath,
          amounts2[0].negated(),
          amounts2[amounts2.length - 1],
          dolomiteMargin.testing.tokenB.address,
          amounts1[amounts1.length - 1].minus(amounts2[0]).plus(marginDeposit),
        );
        console.log(
          `\t#swapExactTokensForTokensAndModifyPosition gas used ${defaultPath.length}-path with deposit and expiration`,
          txResult2.gasUsed.toString(),
        );
      });

      it('should work for margin position with expiry and closing into borrowed asset', async () => {
        await addLiquidity(
          owner1,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const otherAccountNumber = INTEGERS.ZERO;
        const tradeAccountNumber = new BigNumber('123');
        const expiryTimeDelta = new BigNumber('3600');
        const amountIn1 = parA.div(100);
        const amounts1 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountsOutWithPath(amountIn1, defaultPath);
        const marginDeposit = parB.div(10);
        const txResult1 = await dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
          tradeAccountNumber,
          otherAccountNumber,
          amountIn1,
          INTEGERS.ONE,
          defaultPath,
          dolomiteMargin.testing.tokenB.address,
          marginDeposit,
          true,
          expiryTimeDelta,
          defaultDeadline,
          defaultBalanceCheckFlagForMarginTrade,
          { from: owner1 },
        );

        await checkSwapLogs(txResult1, owner1, defaultPath, amounts1);
        await checkExpiryLogs(txResult1, owner1, tradeAccountNumber, marketIdA, expiryTimeDelta);
        await checkModifyPositionLogs(
          txResult1,
          true,
          owner1,
          tradeAccountNumber,
          defaultPath,
          amountIn1.negated(),
          amounts1[amounts1.length - 1],
          dolomiteMargin.testing.tokenB.address,
          marginDeposit,
        );
        console.log(
          `\t#swapExactTokensForTokensAndModifyPosition gas used ${defaultPath.length}-path with deposit and expiration`,
          txResult1.gasUsed.toString(),
        );

        const otherPath = [defaultPath[1], defaultPath[0]];
        const heldMarketId = await dolomiteMargin.getters.getMarketIdByTokenAddress(defaultPath[1]);
        const owedMarketId = await dolomiteMargin.getters.getMarketIdByTokenAddress(defaultPath[0]);
        const heldAmount = await dolomiteMargin.getters.getAccountWei(owner1, tradeAccountNumber, heldMarketId);
        const owedAmount = await dolomiteMargin.getters.getAccountWei(owner1, tradeAccountNumber, owedMarketId);
        const amounts2 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountsOutWithPath(heldAmount, otherPath);
        const txResult2 = await dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
          tradeAccountNumber,
          otherAccountNumber,
          heldAmount,
          INTEGERS.ZERO,
          otherPath,
          dolomiteMargin.testing.tokenA.address,
          INTEGERS.MAX_UINT, // withdraw all
          false,
          INTEGERS.ZERO,
          defaultDeadline,
          BalanceCheckFlag.Both,
          { from: owner1 },
        );

        await checkSwapLogs(txResult2, owner1, otherPath, amounts2);
        await checkModifyPositionLogs(
          txResult2,
          false,
          owner1,
          tradeAccountNumber,
          otherPath,
          amounts2[0].negated(),
          amounts2[amounts2.length - 1],
          dolomiteMargin.testing.tokenA.address,
          amounts2[amounts2.length - 1].minus(owedAmount.abs()),
        );
        console.log(
          `\t#swapExactTokensForTokensAndModifyPosition gas used ${defaultPath.length}-path with deposit and expiration`,
          txResult2.gasUsed.toString(),
        );
      });

      it('should work for margin position with expiry and closing into a non-related asset', async () => {
        await addLiquidity(
          owner2,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = INTEGERS.ZERO;
        const expiryTimeDelta = new BigNumber('3600');
        const amountIn1 = parA.div(100);
        const amounts1 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountsOutWithPath(amountIn1, defaultPath);
        const marginDeposit = await dolomiteMargin.getters.getAccountWei(owner1, otherAccountNumber, marketIdC);
        const txResult1 = await dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
          tradeAccountNumber,
          otherAccountNumber,
          amountIn1,
          INTEGERS.ONE,
          defaultPath,
          dolomiteMargin.testing.tokenC.address,
          INTEGERS.MAX_UINT,
          true,
          expiryTimeDelta,
          defaultDeadline,
          defaultBalanceCheckFlagForMarginTrade,
          { from: owner1 },
        );

        await checkSwapLogs(txResult1, owner1, defaultPath, amounts1);
        await checkExpiryLogs(txResult1, owner1, tradeAccountNumber, marketIdA, expiryTimeDelta);
        await checkModifyPositionLogs(
          txResult1,
          true,
          owner1,
          tradeAccountNumber,
          defaultPath,
          amountIn1.negated(),
          amounts1[amounts1.length - 1],
          dolomiteMargin.testing.tokenC.address,
          marginDeposit,
        );
        console.log(
          `\t#swapExactTokensForTokensAndModifyPosition gas used ${defaultPath.length}-path with deposit and expiration`,
          txResult1.gasUsed.toString(),
        );

        // push the price up so the position can be closed for a profit
        await swapExactTokensForTokens(owner1, parA.div(10), defaultPath);

        const otherPath = [defaultPath[1], defaultPath[0]];
        const heldMarketId = await dolomiteMargin.getters.getMarketIdByTokenAddress(defaultPath[1]);
        const heldAmount = await dolomiteMargin.getters.getAccountWei(owner1, tradeAccountNumber, heldMarketId);
        const amounts2 = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountsOutWithPath(heldAmount, otherPath);
        const txResult2 = await dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
          tradeAccountNumber, // close by switching the from and to accounts
          otherAccountNumber,
          heldAmount,
          INTEGERS.ZERO,
          otherPath,
          dolomiteMargin.testing.tokenC.address,
          INTEGERS.MAX_UINT, // withdraw all
          false,
          INTEGERS.ZERO,
          defaultDeadline,
          BalanceCheckFlag.Both,
          { from: owner1 },
        );

        await checkSwapLogs(txResult2, owner1, otherPath, amounts2);
        await checkModifyPositionLogs(
          txResult2,
          false,
          owner1,
          tradeAccountNumber,
          otherPath,
          amounts2[0].negated(),
          amounts2[amounts2.length - 1],
          dolomiteMargin.testing.tokenC.address,
          marginDeposit,
        );
        console.log(
          `\t#swapExactTokensForTokensAndModifyPosition gas used ${defaultPath.length}-path with deposit and expiration`,
          txResult2.gasUsed.toString(),
        );

        const collateralMarketId = await dolomiteMargin.getters.getMarketIdByTokenAddress(
          dolomiteMargin.testing.tokenC.address
        );
        expect(await dolomiteMargin.getters.getAccountWei(owner1, tradeAccountNumber, heldMarketId)).to.eql(INTEGERS.ZERO);
        expect(await dolomiteMargin.getters.getAccountWei(owner1, tradeAccountNumber, collateralMarketId))
          .to.eql(INTEGERS.ZERO);
      });
    });

    describe('Failure cases', () => {
      it('should fail when there is no margin deposit and the accounts do not match', async () => {
        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = new BigNumber('456');
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
            tradeAccountNumber,
            otherAccountNumber,
            parA.div(100),
            INTEGERS.ONE,
            defaultPath,
            ADDRESSES.ZERO,
            INTEGERS.ZERO,
            false,
            INTEGERS.ZERO,
            defaultDeadline,
            defaultBalanceCheckFlagForMarginTrade,
            { from: owner1 },
          ),
          'DolomiteAmmRouterProxy: accounts must eq for swaps',
        );
      });

      it('should fail when there is a margin deposit but the accounts match', async () => {
        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = new BigNumber('123');
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
            tradeAccountNumber,
            otherAccountNumber,
            parA.div(100),
            INTEGERS.ONE,
            defaultPath,
            dolomiteMargin.testing.tokenB.address,
            parB.div(10),
            true,
            INTEGERS.ZERO,
            defaultDeadline,
            defaultBalanceCheckFlagForMarginTrade,
            { from: owner1 },
          ),
          'DolomiteAmmRouterProxy: accounts must not eq for margin',
        );
      });

      it('should fail when there is a margin deposit but the deposit token is unset', async () => {
        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = new BigNumber('123');
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
            tradeAccountNumber,
            otherAccountNumber,
            parA.div(100),
            INTEGERS.ONE,
            defaultPath,
            ADDRESSES.ZERO,
            parB.div(10),
            true,
            INTEGERS.ZERO,
            defaultDeadline,
            defaultBalanceCheckFlagForMarginTrade,
            { from: owner1 },
          ),
          'DolomiteAmmRouterProxy: margin deposit must eq 0',
        );
      });

      it('should fail when there is no margin deposit but the deposit token is set', async () => {
        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = new BigNumber('456');
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
            tradeAccountNumber,
            otherAccountNumber,
            parA.div(100),
            INTEGERS.ONE,
            defaultPath,
            dolomiteMargin.testing.tokenB.address,
            INTEGERS.ZERO,
            true,
            INTEGERS.ZERO,
            defaultDeadline,
            defaultBalanceCheckFlagForMarginTrade,
            { from: owner1 },
          ),
          'DolomiteAmmRouterProxy: invalid margin deposit',
        );
      });

      it('should fail when the amount in is invalid', async () => {
        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = new BigNumber('456');
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
            tradeAccountNumber,
            otherAccountNumber,
            INTEGERS.MAX_UINT.minus(1),
            INTEGERS.ONE,
            defaultPath,
            dolomiteMargin.testing.tokenB.address,
            parB.div(100),
            true,
            INTEGERS.ZERO,
            defaultDeadline,
            defaultBalanceCheckFlagForMarginTrade,
            { from: owner1 },
          ),
          'DolomiteAmmRouterProxy: invalid asset amount',
        );
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.swapTokensForExactTokensAndModifyPosition(
            tradeAccountNumber,
            otherAccountNumber,
            INTEGERS.MAX_UINT.minus(1),
            INTEGERS.ONE,
            defaultPath,
            dolomiteMargin.testing.tokenB.address,
            parB.div(100),
            true,
            INTEGERS.ZERO,
            defaultDeadline,
            defaultBalanceCheckFlagForMarginTrade,
            { from: owner1 },
          ),
          'DolomiteAmmRouterProxy: invalid asset amount',
        );
      });

      it('should fail when the amount out is invalid', async () => {
        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = new BigNumber('456');
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
            tradeAccountNumber,
            otherAccountNumber,
            INTEGERS.ONE,
            INTEGERS.MAX_UINT.minus(1),
            defaultPath,
            dolomiteMargin.testing.tokenB.address,
            parB.div(100),
            true,
            INTEGERS.ZERO,
            defaultDeadline,
            defaultBalanceCheckFlagForMarginTrade,
            { from: owner1 },
          ),
          'DolomiteAmmRouterProxy: invalid asset amount',
        );
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.swapTokensForExactTokensAndModifyPosition(
            tradeAccountNumber,
            otherAccountNumber,
            INTEGERS.ONE,
            INTEGERS.MAX_UINT.minus(1),
            defaultPath,
            dolomiteMargin.testing.tokenB.address,
            parB.div(100),
            true,
            INTEGERS.ZERO,
            defaultDeadline,
            defaultBalanceCheckFlagForMarginTrade,
            { from: owner1 },
          ),
          'DolomiteAmmRouterProxy: invalid asset amount',
        );
      });

      it('should fail when the asset reference is invalid', async () => {
        const createBadAmount = (value: Integer) => {
          return {
            sign: true,
            denomination: AmountDenomination.Wei,
            ref: AmountReference.Target,
            value: value.toFixed(0),
          };
        };
        const createAmount = (value: Integer) => {
          return {
            sign: true,
            denomination: AmountDenomination.Wei,
            ref: AmountReference.Delta,
            value: value.toFixed(0),
          };
        };

        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = new BigNumber('456');
        await expectThrow(
          dolomiteMargin.contracts.callContractFunction(
            dolomiteMargin.contracts.dolomiteAmmRouterProxy.methods.swapExactTokensForTokensAndModifyPosition(
              {
                tokenPath: defaultPath,
                marginTransferToken: ADDRESSES.ZERO,
                isDepositIntoTradeAccount: true,
                balanceCheckFlag: BalanceCheckFlag.None,
                tradeAccountNumber: tradeAccountNumber.toFixed(0),
                otherAccountNumber: otherAccountNumber.toFixed(0),
                amountIn: createBadAmount(parA),
                amountOut: createBadAmount(parB),
                marginTransferWei: INTEGERS.ZERO.toFixed(0),
                expiryTimeDelta: INTEGERS.ZERO.toFixed(0),
              },
              defaultDeadline.toFixed(0),
            ),
            {},
          ),
          'DolomiteAmmRouterProxy: invalid asset reference',
        );
        await expectThrow(
          dolomiteMargin.contracts.callContractFunction(
            dolomiteMargin.contracts.dolomiteAmmRouterProxy.methods.swapExactTokensForTokensAndModifyPosition(
              {
                tokenPath: defaultPath,
                marginTransferToken: ADDRESSES.ZERO,
                isDepositIntoTradeAccount: true,
                balanceCheckFlag: BalanceCheckFlag.None,
                tradeAccountNumber: tradeAccountNumber.toFixed(0),
                otherAccountNumber: otherAccountNumber.toFixed(0),
                amountIn: createAmount(parA),
                amountOut: createBadAmount(parB),
                marginTransferWei: INTEGERS.ZERO.toFixed(0),
                expiryTimeDelta: INTEGERS.ZERO.toFixed(0),
              },
              defaultDeadline.toFixed(0),
            ),
            {},
          ),
          'DolomiteAmmRouterProxy: invalid asset reference',
        );
        await expectThrow(
          dolomiteMargin.contracts.callContractFunction(
            dolomiteMargin.contracts.dolomiteAmmRouterProxy.methods.swapExactTokensForTokensAndModifyPosition(
              {
                tokenPath: defaultPath,
                marginTransferToken: ADDRESSES.ZERO,
                isDepositIntoTradeAccount: true,
                balanceCheckFlag: BalanceCheckFlag.None,
                tradeAccountNumber: tradeAccountNumber.toFixed(0),
                otherAccountNumber: otherAccountNumber.toFixed(0),
                amountIn: createBadAmount(parA),
                amountOut: createAmount(parB),
                marginTransferWei: INTEGERS.ZERO.toFixed(0),
                expiryTimeDelta: INTEGERS.ZERO.toFixed(0),
              },
              defaultDeadline.toFixed(0),
            ),
            {},
          ),
          'DolomiteAmmRouterProxy: invalid asset reference',
        );
      });

      it('should fail when expiry is larger than max uint32', async () => {
        await addLiquidity(
          owner1,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const tradeAccountNumber = new BigNumber('123');
        const otherAccountNumber = INTEGERS.ZERO;
        const amountIn = parA.div(100);
        await expectThrow(
          dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokensAndModifyPosition(
            tradeAccountNumber,
            otherAccountNumber,
            amountIn,
            INTEGERS.ONE,
            defaultPath,
            dolomiteMargin.testing.tokenB.address,
            INTEGERS.MAX_UINT,
            true,
            INTEGERS.MAX_UINT_128,
            defaultDeadline,
            defaultBalanceCheckFlagForMarginTrade,
            { from: owner1 },
          ),
          'AccountActionLib: invalid expiry time',
        );
      });
    });
  });

  describe('#swapTokensForExactTokens', () => {
    describe('Success cases', () => {
      it('should work for normal case', async () => {
        await addLiquidity(
          owner1,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        await swapTokensForExactTokens(owner1, parB.div(100));

        const pair = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const { reserve0, reserve1 } = await pair.getReservesWei();

        const marketId0 = await pair.marketId0();
        const balance0 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0);
        expect(reserve0).to.eql(balance0);

        const marketId1 = await pair.marketId1();
        const balance1 = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1);
        expect(reserve1).to.eql(balance1);
      });

      it('should work for normal case with a path of more than 2 tokens', async () => {
        await addLiquidity(
          owner2,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        await addLiquidity(
          owner2,
          parB.div(10),
          parC.div(10),
          dolomiteMargin.testing.tokenB.address,
          dolomiteMargin.testing.tokenC.address,
        );

        const _3Path = [
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          dolomiteMargin.testing.tokenC.address,
        ];

        await swapTokensForExactTokens(owner1, parA.div(100), _3Path);
        await swapTokensForExactTokens(owner1, parA.div(100), _3Path);

        const pair_ab = dolomiteMargin.getDolomiteAmmPair(token_ab);
        const reserves_ab = await pair_ab.getReservesWei();

        const marketId0_ab = await pair_ab.marketId0();
        const balance0_ab = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId0_ab);
        expect(reserves_ab.reserve0).to.eql(balance0_ab);

        const marketId1_ab = await pair_ab.marketId1();
        const balance1_ab = await dolomiteMargin.getters.getAccountWei(token_ab, INTEGERS.ZERO, marketId1_ab);
        expect(reserves_ab.reserve1).to.eql(balance1_ab);

        const pair_bc = dolomiteMargin.getDolomiteAmmPair(token_bc);
        const reserves_bc = await pair_bc.getReservesWei();

        const marketId0_bc = await pair_bc.marketId0();
        const balance0_bc = await dolomiteMargin.getters.getAccountWei(token_bc, INTEGERS.ZERO, marketId0_bc);
        expect(reserves_bc.reserve0).to.eql(balance0_bc);

        const marketId1_bc = await pair_bc.marketId1();
        const balance1_bc = await dolomiteMargin.getters.getAccountWei(token_bc, INTEGERS.ZERO, marketId1_bc);
        expect(reserves_bc.reserve1).to.eql(balance1_bc);
      });
    });

    describe('Failure cases', () => {
      it('should not work when trade size is more than available liquidity', async () => {
        const amountInMax = INTEGERS.ONE;
        await expectThrow(
          swapTokensForExactTokens(owner1, parB, defaultPath, amountInMax),
          'DolomiteAmmLibrary: insufficient liquidity',
        );
      });

      it('should not work when trade size is more than available liquidity', async () => {
        await addLiquidity(
          owner1,
          parA.div(10),
          parB.div(10),
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
        );

        const amountInMax = INTEGERS.ONE;
        await expectThrow(
          swapTokensForExactTokens(owner1, parB.div(1000), defaultPath, amountInMax),
          'DolomiteAmmRouterProxy: excessive input amount <1012210944760889, 1>',
        );
      });
    });
  });

  describe('#addLiquidityAndDepositIntoDolomite', () => {
    describe('Success cases', () => {
      it('should work under normal conditions', async () => {
        const token_ab_marketId = await createLpTokenMarket(token_ab);

        const accountNumber = INTEGERS.ZERO;
        const txResult = await dolomiteMargin.dolomiteAmmRouterProxy.addLiquidityAndDepositIntoDolomite(
          accountNumber,
          accountNumber,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          parA,
          parB,
          INTEGERS.ZERO,
          INTEGERS.ZERO,
          defaultDeadline,
          defaultBalanceCheckFlag,
        );

        console.log('\t#addLiquidityAndDepositIntoDolomite gas used: ', txResult.gasUsed);

        expect(await dolomiteMargin.token.getBalance(token_ab, dolomiteMargin.dolomiteAmmRouterProxy.address)).to.eql(INTEGERS.ZERO);
        expect(await dolomiteMargin.token.getBalance(token_ab, owner1)).to.eql(INTEGERS.ZERO);
        expect((await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, token_ab_marketId)).isGreaterThan(INTEGERS.ZERO)).to.eql(true);
      });
    });
  });

  describe('#removeLiquidityFromWithinDolomite', () => {
    describe('Success cases', () => {
      it('should work under normal conditions', async () => {
        const token_ab_marketId = await createLpTokenMarket(token_ab);
        const accountNumber = INTEGERS.ZERO;
        await dolomiteMargin.dolomiteAmmRouterProxy.addLiquidityAndDepositIntoDolomite(
          accountNumber,
          accountNumber,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          parA,
          parB,
          INTEGERS.ZERO,
          INTEGERS.ZERO,
          defaultDeadline,
          defaultBalanceCheckFlag,
        );

        expect(await dolomiteMargin.token.getBalance(token_ab, dolomiteMargin.dolomiteAmmRouterProxy.address)).to.eql(INTEGERS.ZERO);
        expect(await dolomiteMargin.token.getBalance(token_ab, owner1)).to.eql(INTEGERS.ZERO);

        const liquidity = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, token_ab_marketId);
        expect(liquidity.isGreaterThan(INTEGERS.ZERO)).to.eql(true);

        const oldTotalSupply = await dolomiteMargin.token.getTotalSupply(token_ab);
        const txResult = await dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidityFromWithinDolomite(
          accountNumber,
          accountNumber,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          liquidity,
          INTEGERS.ZERO,
          INTEGERS.ZERO,
          defaultDeadline,
          defaultBalanceCheckFlag,
        );
        console.log('\t#removeLiquidityFromWithinDolomite gas used: ', txResult.gasUsed);

        expect(await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, token_ab_marketId)).to.eql(INTEGERS.ZERO);

        const newTotalSupply = await dolomiteMargin.token.getTotalSupply(token_ab);
        expect(oldTotalSupply).to.eql(newTotalSupply.plus(liquidity));
      });

      it('should work for withdraw all', async () => {
        const token_ab_marketId = await createLpTokenMarket(token_ab);
        const accountNumber = INTEGERS.ZERO;
        await dolomiteMargin.dolomiteAmmRouterProxy.addLiquidityAndDepositIntoDolomite(
          accountNumber,
          accountNumber,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          parA,
          parB,
          INTEGERS.ZERO,
          INTEGERS.ZERO,
          defaultDeadline,
          defaultBalanceCheckFlag,
        );

        expect(await dolomiteMargin.token.getBalance(token_ab, dolomiteMargin.dolomiteAmmRouterProxy.address)).to.eql(INTEGERS.ZERO);
        expect(await dolomiteMargin.token.getBalance(token_ab, owner1)).to.eql(INTEGERS.ZERO);

        const liquidity = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, token_ab_marketId);
        expect(liquidity.isGreaterThan(INTEGERS.ZERO)).to.eql(true);

        const oldTotalSupply = await dolomiteMargin.token.getTotalSupply(token_ab);
        const txResult = await dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidityFromWithinDolomite(
          accountNumber,
          accountNumber,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          INTEGERS.MAX_UINT,
          INTEGERS.ZERO,
          INTEGERS.ZERO,
          defaultDeadline,
          defaultBalanceCheckFlag,
        );

        console.log('\t#removeLiquidityFromWithinDolomite gas used: ', txResult.gasUsed);

        expect(await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, token_ab_marketId)).to.eql(INTEGERS.ZERO);

        const newTotalSupply = await dolomiteMargin.token.getTotalSupply(token_ab);
        expect(oldTotalSupply).to.eql(newTotalSupply.plus(liquidity));
      });

      it('should work when account goes negative and checkBalanceFlag is set to None', async () => {
        const token_ab_marketId = await createLpTokenMarket(token_ab);
        const accountNumber = INTEGERS.ZERO;
        await dolomiteMargin.dolomiteAmmRouterProxy.addLiquidityAndDepositIntoDolomite(
          accountNumber,
          accountNumber,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          parA,
          parB,
          INTEGERS.ZERO,
          INTEGERS.ZERO,
          defaultDeadline,
          defaultBalanceCheckFlag,
        );

        expect(await dolomiteMargin.token.getBalance(token_ab, dolomiteMargin.dolomiteAmmRouterProxy.address)).to.eql(INTEGERS.ZERO);
        expect(await dolomiteMargin.token.getBalance(token_ab, owner1)).to.eql(INTEGERS.ZERO);

        const liquidity = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, token_ab_marketId);
        expect(liquidity.isGreaterThan(INTEGERS.ZERO)).to.eql(true);

        const oldTotalSupply = await dolomiteMargin.token.getTotalSupply(token_ab);
        const txResult = await dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidityFromWithinDolomite(
          accountNumber,
          accountNumber,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          liquidity.plus(1),
          INTEGERS.ZERO,
          INTEGERS.ZERO,
          defaultDeadline,
          BalanceCheckFlag.None,
        );

        console.log('\t#removeLiquidityFromWithinDolomite gas used: ', txResult.gasUsed);

        expect(await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, token_ab_marketId)).to.eql(new BigNumber(-1));

        const newTotalSupply = await dolomiteMargin.token.getTotalSupply(token_ab);
        expect(oldTotalSupply).to.eql(newTotalSupply.plus(liquidity.plus(1)));
      });

      it('should work when account goes negative and checkBalanceFlag is set to To', async () => {
        const token_ab_marketId = await createLpTokenMarket(token_ab);
        const accountNumber = INTEGERS.ZERO;
        await dolomiteMargin.dolomiteAmmRouterProxy.addLiquidityAndDepositIntoDolomite(
          accountNumber,
          accountNumber,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          parA,
          parB,
          INTEGERS.ZERO,
          INTEGERS.ZERO,
          defaultDeadline,
          defaultBalanceCheckFlag,
        );

        expect(await dolomiteMargin.token.getBalance(token_ab, dolomiteMargin.dolomiteAmmRouterProxy.address)).to.eql(INTEGERS.ZERO);
        expect(await dolomiteMargin.token.getBalance(token_ab, owner1)).to.eql(INTEGERS.ZERO);

        const liquidity = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, token_ab_marketId);
        expect(liquidity.isGreaterThan(INTEGERS.ZERO)).to.eql(true);

        const oldTotalSupply = await dolomiteMargin.token.getTotalSupply(token_ab);
        const txResult = await dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidityFromWithinDolomite(
          accountNumber,
          accountNumber,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          liquidity.plus(1),
          INTEGERS.ZERO,
          INTEGERS.ZERO,
          defaultDeadline,
          BalanceCheckFlag.To,
        );

        console.log('\t#removeLiquidityFromWithinDolomite gas used: ', txResult.gasUsed);

        expect(await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, token_ab_marketId)).to.eql(new BigNumber(-1));

        const newTotalSupply = await dolomiteMargin.token.getTotalSupply(token_ab);
        expect(oldTotalSupply).to.eql(newTotalSupply.plus(liquidity.plus(1)));
      });
    });

    describe('Failure cases', () => {
      it('should fail when account goes negative and checkBalanceFlag is set to From or Both', async () => {
        const token_ab_marketId = await createLpTokenMarket(token_ab);
        const accountNumber = INTEGERS.ZERO;
        await dolomiteMargin.dolomiteAmmRouterProxy.addLiquidityAndDepositIntoDolomite(
          accountNumber,
          accountNumber,
          dolomiteMargin.testing.tokenA.address,
          dolomiteMargin.testing.tokenB.address,
          parA,
          parB,
          INTEGERS.ZERO,
          INTEGERS.ZERO,
          defaultDeadline,
          defaultBalanceCheckFlag,
        );

        expect(await dolomiteMargin.token.getBalance(token_ab, dolomiteMargin.dolomiteAmmRouterProxy.address)).to.eql(INTEGERS.ZERO);
        expect(await dolomiteMargin.token.getBalance(token_ab, owner1)).to.eql(INTEGERS.ZERO);

        const liquidity = await dolomiteMargin.getters.getAccountWei(owner1, accountNumber, token_ab_marketId);
        expect(liquidity.isGreaterThan(INTEGERS.ZERO)).to.eql(true);

        await expectThrowInvalidBalance(
          dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidityFromWithinDolomite(
            accountNumber,
            accountNumber,
            dolomiteMargin.testing.tokenA.address,
            dolomiteMargin.testing.tokenB.address,
            liquidity.plus(1),
            INTEGERS.ZERO,
            INTEGERS.ZERO,
            defaultDeadline,
            BalanceCheckFlag.From,
          ),
          owner1,
          accountNumber,
          token_ab_marketId,
        );
        await expectThrowInvalidBalance(
          dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidityFromWithinDolomite(
            accountNumber,
            accountNumber,
            dolomiteMargin.testing.tokenA.address,
            dolomiteMargin.testing.tokenB.address,
            liquidity.plus(1),
            INTEGERS.ZERO,
            INTEGERS.ZERO,
            defaultDeadline,
            BalanceCheckFlag.Both,
          ),
          owner1,
          accountNumber,
          token_ab_marketId,
        );
      });
    });
  });
});

// ============ Helper Functions ============

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
  liquidity: Integer,
  amountAMin: Integer = INTEGERS.ZERO,
  amountBMin: Integer = INTEGERS.ZERO,
  permitSignature?: PermitSignature,
  deadline: Integer = defaultDeadline,
) {
  let result: TxResult;
  if (permitSignature) {
    result = await dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidityWithPermit(
      walletAddress,
      INTEGERS.ZERO,
      dolomiteMargin.testing.tokenA.address,
      dolomiteMargin.testing.tokenB.address,
      liquidity,
      amountAMin,
      amountBMin,
      deadline,
      permitSignature,
      { from: walletAddress },
    );
  } else {
    result = await dolomiteMargin.dolomiteAmmRouterProxy.removeLiquidity(
      walletAddress,
      INTEGERS.ZERO,
      dolomiteMargin.testing.tokenA.address,
      dolomiteMargin.testing.tokenB.address,
      liquidity,
      amountAMin,
      amountBMin,
      deadline,
      { from: walletAddress },
    );
  }

  await checkSyncLogs(result, dolomiteMargin.testing.tokenA.address, dolomiteMargin.testing.tokenB.address);

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
  const amounts = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountsOutWithPath(amountIn, path);
  const result = await dolomiteMargin.dolomiteAmmRouterProxy.swapExactTokensForTokens(
    INTEGERS.ZERO,
    amountIn,
    amountOutMin,
    path,
    defaultDeadline,
    defaultBalanceCheckFlag,
    { from: walletAddress },
  );

  await checkSwapLogs(result, walletAddress, path, amounts);

  if (logGasUsage) {
    console.log(`\t#swapExactTokensForTokens gas used ${path.length}-path `, result.gasUsed.toString());
  }

  return result;
}

async function swapTokensForExactTokens(
  walletAddress: address,
  amountOut: Integer,
  path: string[] = defaultPath,
  amountInMax: Integer = INTEGERS.MAX_UINT_128,
) {
  const amounts = await dolomiteMargin.dolomiteAmmRouterProxy.getDolomiteAmmAmountsInWithPath(amountOut, path);
  const result = await dolomiteMargin.dolomiteAmmRouterProxy.swapTokensForExactTokens(
    INTEGERS.ZERO,
    amountInMax,
    amountOut,
    path,
    defaultDeadline,
    defaultBalanceCheckFlag,
    { from: walletAddress },
  );

  await checkSwapLogs(result, walletAddress, path, amounts);

  console.log(`\t#swapTokensForExactTokens gas used ${path.length}-path`, result.gasUsed.toString());

  return result;
}

async function checkModifyPositionLogs(
  result: TxResult,
  isOpen: boolean,
  trader: address,
  traderAccountNumber: Integer,
  path: address[],
  inputDeltaWei: Integer,
  outputDeltaWei: Integer,
  depositOrWithdrawalToken: address,
  depositOrWithdrawalAmount: Integer,
) {
  const positionEventLogs = await dolomiteMargin.contracts.dolomiteAmmRouterProxy.getPastEvents(
    isOpen ? 'MarginPositionOpen' : 'MarginPositionClose',
    { fromBlock: result.blockNumber ?? 'latest' },
  );
  expect(positionEventLogs.length).to.eql(1);

  const positionEvent = dolomiteMargin.logs.parseEventLogWithContract(
    dolomiteMargin.contracts.dolomiteAmmRouterProxy,
    positionEventLogs[0],
  );

  const inputMarket = await dolomiteMargin.getters.getMarketIdByTokenAddress(path[0]);
  const outputMarket = await dolomiteMargin.getters.getMarketIdByTokenAddress(path[path.length - 1]);
  const depositOrWithdrawalMarket = await dolomiteMargin.getters.getMarketIdByTokenAddress(depositOrWithdrawalToken);

  const newInputPar = await dolomiteMargin.getters.getAccountPar(trader, traderAccountNumber, inputMarket);
  const newOutputPar = await dolomiteMargin.getters.getAccountPar(trader, traderAccountNumber, outputMarket);
  const newDepositOrWithdrawalPar = await dolomiteMargin.getters.getAccountPar(
    trader,
    traderAccountNumber,
    depositOrWithdrawalMarket,
  );

  expect(positionEvent.args.account).to.eql(trader);
  expect(positionEvent.args.accountNumber).to.eql(traderAccountNumber);
  expect(positionEvent.args.inputToken).to.eql(path[0]);
  expect(positionEvent.args.outputToken).to.eql(path[path.length - 1]);
  expect(positionEvent.args.inputBalanceUpdate).to.eql({
    deltaWei: inputDeltaWei,
    newPar: newInputPar,
  });
  expect(positionEvent.args.outputBalanceUpdate).to.eql({
    deltaWei: outputDeltaWei,
    newPar: newOutputPar,
  });

  if (isOpen) {
    expect(positionEvent.args.depositToken).to.eql(depositOrWithdrawalToken);
    expect(positionEvent.args.marginDepositUpdate).to.eql({
      deltaWei: depositOrWithdrawalAmount,
      newPar: newDepositOrWithdrawalPar,
    });
  } else {
    expect(positionEvent.args.withdrawalToken).to.eql(depositOrWithdrawalToken);
    expect(positionEvent.args.marginWithdrawalUpdate).to.eql({
      deltaWei: depositOrWithdrawalAmount.eq(INTEGERS.ZERO) ? INTEGERS.ZERO : depositOrWithdrawalAmount.negated(),
      newPar: newDepositOrWithdrawalPar,
    });
  }
}

async function checkSwapLogs(
  result: TxResult,
  traderAddress: address,
  path: address[],
  amounts: Integer[],
) {
  expect(path.length).to.eql(amounts.length);

  for (let i = 0; i < path.length - 1; i += 1) {
    const pairAddress = await dolomiteMargin.dolomiteAmmFactory.getPair(path[i], path[i + 1]);
    const pairContract = dolomiteMargin.contracts.getDolomiteAmmPair(pairAddress);

    const swapEventLogs = await pairContract.getPastEvents(
      'Swap',
      { fromBlock: result.blockNumber ?? 'latest' },
    );
    expect(swapEventLogs.length).to.eql(1);

    swapEventLogs.forEach((eventLog) => {
      const log = dolomiteMargin.logs.parseEventLogWithContract(pairContract, eventLog);
      expect(log.args.sender).to.eql(dolomiteMargin.address);
      expect(log.args.to).to.eql(traderAddress);

      const amountsIn = [log.args.amount0In, log.args.amount1In].filter(a => !a.eq(INTEGERS.ZERO));
      expect(amountsIn.length).to.eql(1);
      expect(amounts[i]).to.eql(amountsIn[0]);

      const amountsOut = [log.args.amount0Out, log.args.amount1Out].filter(a => !a.eq(INTEGERS.ZERO));
      expect(amountsOut.length).to.eql(1);
      expect(amounts[i + 1]).to.eql(amountsOut[0]);
    });

    await checkSyncLogs(result, path[i], path[i + 1]);
  }
}

async function checkNoExpiryLogs(
  result: TxResult,
  trader: address,
  traderAccountNumber: Integer,
  owedMarketId: Integer,
) {
  const logs = dolomiteMargin.logs.parseLogs(result);
  expect(logs.filter(log => log.name === 'ExpirySet').length).to.eql(0);

  const expiry = await dolomiteMargin.expiry.getExpiry(trader, traderAccountNumber, owedMarketId);
  expect(expiry).to.eql(INTEGERS.ZERO);
}

async function checkExpiryLogs(
  result: TxResult,
  trader: address,
  traderAccountNumber: Integer,
  owedMarketId: Integer,
  expiryDelta: number | Integer,
) {
  const block = await dolomiteMargin.web3.eth.getBlock(result.blockNumber ?? 'latest');
  const expiry = block.timestamp + (expiryDelta instanceof BigNumber ? expiryDelta.toNumber() : expiryDelta);

  const logs = dolomiteMargin.logs.parseLogs(result);
  const expiryEventLogs = logs.filter(log => log.name === 'ExpirySet');
  expect(expiryEventLogs.length).to.eql(1);

  const expiryEventLog = expiryEventLogs[0];
  expect(expiryEventLog.args.owner).to.eql(trader);
  expect(expiryEventLog.args.number).to.eql(traderAccountNumber);
  expect(expiryEventLog.args.marketId).to.eql(owedMarketId);
  expect(expiryEventLog.args.time.toNumber()).to.eql(expiry);
  expect((await dolomiteMargin.expiry.getExpiry(trader, traderAccountNumber, owedMarketId)).toNumber()).to.eql(expiry);
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

async function setUpBasicBalances() {
  const marketA = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenA.address);
  const marketB = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenB.address);
  const marketC = await dolomiteMargin.getters.getMarketIdByTokenAddress(dolomiteMargin.testing.tokenC.address);

  return Promise.all([
    dolomiteMargin.testing.setAccountBalance(owner1, INTEGERS.ZERO, marketA, parA),
    dolomiteMargin.testing.setAccountBalance(owner1, INTEGERS.ZERO, marketB, parB),
    dolomiteMargin.testing.setAccountBalance(owner2, INTEGERS.ZERO, marketA, parA),
    dolomiteMargin.testing.setAccountBalance(owner2, INTEGERS.ZERO, marketB, parB),
    dolomiteMargin.testing.setAccountBalance(owner2, INTEGERS.ZERO, marketC, parC),
  ]);
}

async function createLpTokenMarket(lpToken: address): Promise<Integer> {
  await dolomiteMargin.testing.priceOracle.setPrice(lpToken, new BigNumber('1e18'));
  await dolomiteMargin.admin.addMarket(
    lpToken,
    dolomiteMargin.testing.priceOracle.address,
    dolomiteMargin.testing.interestSetter.address,
    INTEGERS.ZERO,
    INTEGERS.ZERO,
    INTEGERS.ZERO,
    INTEGERS.ZERO,
    INTEGERS.ZERO,
    false,
    { from: admin },
  );
  const lpTokenMarketId = await dolomiteMargin.getters.getMarketIdByTokenAddress(lpToken);

  const balance = await dolomiteMargin.token.getBalance(lpToken, owner2);
  await dolomiteMargin.token.setAllowance(lpToken, owner2, dolomiteMargin.address, balance);
  await dolomiteMargin.depositWithdrawalProxy.depositWei(INTEGERS.ZERO, lpTokenMarketId, balance, { from: owner2 });

  // give some extra balance so owner1 can borrow LP tokens without going underwater.
  await dolomiteMargin.testing.setAccountBalance(owner1, INTEGERS.ZERO, marketIdA, parA.times(2));
  await dolomiteMargin.testing.setAccountBalance(owner1, INTEGERS.ZERO, marketIdB, parB.times(2));

  return lpTokenMarketId;
}
