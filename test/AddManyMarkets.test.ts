import BigNumber from 'bignumber.js';
import TestTokenJSON from '../build/contracts/TestToken.json';
import { TestToken } from '../build/testing_wrappers/TestToken';
import { address, AmountDenomination, AmountReference, Integer, INTEGERS } from '../src';
import { expectThrow } from './helpers/Expect';
import { deployContract } from './helpers/Deploy';
import { getDolomiteMargin } from './helpers/DolomiteMargin';
import { setupMarkets } from './helpers/DolomiteMarginHelpers';
import { resetEVM, snapshot } from './helpers/EVM';
import { TestDolomiteMargin } from './modules/TestDolomiteMargin';

let owner1: address;
let admin: address;
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
const accountOne = new BigNumber(111);
const accountTwo = new BigNumber(222);
const accounThree = new BigNumber(333);
const amount = new BigNumber(100);

describe('AddManyMarkets', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    admin = accounts[0];
    owner1 = dolomiteMargin.getDefaultAccount();

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);
    await Promise.all([
      dolomiteMargin.testing.tokenA.issueTo(amount, owner1),
      dolomiteMargin.testing.tokenA.setMaximumDolomiteMarginAllowance(owner1),
    ]);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  it('should work for many markets without crazy gas prices and performing a liquidation', async () => {
    console.log('\tNumber of markets before:', (await dolomiteMargin.getters.getNumMarkets()).toFixed());

    const tokens: TestToken[] = [];
    const marketIds: Integer[] = [];

    const numberOfMarketsToAdd = 257;
    for (let i = 0; i < numberOfMarketsToAdd; i += 1) {
      const priceOracle = dolomiteMargin.testing.priceOracle.address;
      const interestSetter = dolomiteMargin.testing.interestSetter.address;
      const price = new BigNumber('1e40'); // large to prevent hitting minBorrowValue check
      const marginPremium = INTEGERS.ZERO;
      const liquidationSpreadPremium = INTEGERS.ZERO;
      const maxSupplyWei = INTEGERS.ZERO;
      const maxBorrowWei = INTEGERS.ZERO;
      const earningsRateOverride = INTEGERS.ZERO;
      const isClosing = false;

      tokens[i] = (await deployContract(dolomiteMargin, TestTokenJSON)) as TestToken;

      await dolomiteMargin.testing.priceOracle.setPrice(tokens[i].options.address, price);
      const txResult = await dolomiteMargin.admin.addMarket(
        tokens[i].options.address,
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
      if (i === numberOfMarketsToAdd - 1) {
        console.log('\tAdd market gas cost for last market:', txResult.gasUsed);
      }
      marketIds[i] = await dolomiteMargin.getters.getMarketIdByTokenAddress(tokens[i].options.address);
    }
    const numberOfMarkets = await dolomiteMargin.getters.getNumMarkets();
    console.log('\tNumber of markets after:', numberOfMarkets.toFixed());

    await performDeposit(accountOne, 0, tokens, marketIds, true);
    await performDeposit(accountOne, 49, tokens, marketIds, true);
    await performDeposit(accountOne, 99, tokens, marketIds, true);
    await performDeposit(accountOne, 149, tokens, marketIds, true);
    await performDeposit(accountOne, 199, tokens, marketIds, true);
    await performDeposit(accountOne, numberOfMarketsToAdd - 1, tokens, marketIds, true);

    let cumulativeGasUsed = 0;
    const numberOfDeposits = 32;
    for (let i = 0; i < numberOfDeposits; i += 1) {
      const logGasUsage = i > numberOfDeposits - 6;
      cumulativeGasUsed += await performDeposit(accountTwo, i * 2, tokens, marketIds, logGasUsage);
    }
    console.log(
      `\tAveraged gas used for deposit into account ${accountTwo.toFixed()}:`,
      cumulativeGasUsed / numberOfDeposits,
    );

    const numberOfMarketsWithBalances = await dolomiteMargin.getters.getAccountNumberOfMarketsWithBalances(
      owner1,
      accountTwo,
    );
    expect(numberOfMarketsWithBalances).to.eql(new BigNumber(numberOfDeposits));

    // The 33rd one should throw
    await expectThrow(
      performDeposit(accountTwo, numberOfMarketsToAdd - 1, tokens, marketIds),
      `OperationImpl: Too many non-zero balances <${owner1.toLowerCase()}, ${accountTwo.toFixed()}>`,
    );

    const heldMarket = numberOfMarkets.minus(1);
    const owedMarket = INTEGERS.ONE;
    await dolomiteMargin.testing.setAccountBalance(owner1, accounThree, heldMarket, amount);
    await dolomiteMargin.testing.setAccountBalance(owner1, accounThree, owedMarket, amount.div('-1.1'));
    await performLiquidation(
      owner1,
      accountOne,
      owner1,
      accounThree,
      owedMarket,
      heldMarket,
    );
  });

  const performDeposit = async (
    primaryAccountId: Integer,
    index: number,
    tokens: TestToken[],
    marketIds: Integer[],
    shouldLogGasUsage: boolean = false,
  ) => {
    await dolomiteMargin.contracts.callContractFunction(tokens[index].methods.issueTo(owner1, amount.toFixed(0)), {
      from: owner1,
    });
    await dolomiteMargin.contracts.callContractFunction(
      tokens[index].methods.approve(dolomiteMargin.address, INTEGERS.ONES_255.toFixed(0)),
      { from: owner1 },
    );
    const txResult = await dolomiteMargin.operation
      .initiate()
      .deposit({
        primaryAccountId,
        primaryAccountOwner: owner1,
        marketId: marketIds[index],
        amount: {
          denomination: AmountDenomination.Wei,
          reference: AmountReference.Delta,
          value: amount,
        },
        from: owner1,
      })
      .commit({ from: owner1 });

    if (shouldLogGasUsage) {
      console.log(`\tGas used for deposit into account ${primaryAccountId.toFixed()}:`, txResult.gasUsed);
    }

    return txResult.gasUsed;
  };

  const performLiquidation = async (
    solidOwner: address,
    solidAccountNumber: Integer,
    liquidOwner: address,
    liquidAccountNumber: Integer,
    owedMarket: Integer,
    heldMarket: Integer,
  ) => {
    await dolomiteMargin.liquidatorProxyV1.liquidate(
      solidOwner,
      solidAccountNumber,
      liquidOwner,
      liquidAccountNumber,
      new BigNumber('1.15'),
      INTEGERS.ZERO,
      [owedMarket],
      [heldMarket],
      { from: solidOwner },
    );
  };
});
