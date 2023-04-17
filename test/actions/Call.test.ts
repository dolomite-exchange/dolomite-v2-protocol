import BigNumber from 'bignumber.js';
import { toBytes } from '../../src/lib/BytesHelper';
import { expectThrow } from '../helpers/Expect';
import {
  AccountStatus,
  address,
  Call,
  TxResult,
  INTEGERS,
} from '../../src';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { setupMarkets } from '../helpers/DolomiteMarginHelpers';
import {
  resetEVM,
  snapshot,
} from '../helpers/EVM';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';

let who: address;
let operator: address;
let dolomiteMargin: TestDolomiteMargin;
let accounts: address[];
const accountNumber = INTEGERS.ZERO;
const accountData = new BigNumber(100);
const senderData = new BigNumber(50);
let defaultGlob: Call;

describe('Call', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;
    accounts = r.accounts;
    who = dolomiteMargin.getDefaultAccount();
    operator = accounts[5];
    defaultGlob = {
      primaryAccountOwner: who,
      primaryAccountId: accountNumber,
      callee: dolomiteMargin.testing.callee.address,
      data: [],
    };

    await resetEVM();
    await setupMarkets(dolomiteMargin, accounts);
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  it('Basic call test', async () => {
    const txResult = await expectCallOkay({
      data: toBytes(accountData, senderData),
    });
    await verifyDataIntegrity(who);
    console.log(`\tCall gas used: ${txResult.gasUsed}`);
  });

  it('Succeeds for events', async () => {
    await dolomiteMargin.permissions.approveOperator(operator, { from: who });
    const txResult = await expectCallOkay(
      { data: toBytes(accountData, senderData) },
      { from: operator },
    );
    await verifyDataIntegrity(operator);

    const logs = dolomiteMargin.logs.parseLogs(txResult);
    expect(logs.length)
      .to.eql(2);

    const operationLog = logs[0];
    expect(operationLog.name)
      .to.eql('LogOperation');
    expect(operationLog.args.sender)
      .to.eql(operator);

    const callLog = logs[1];
    expect(callLog.name)
      .to.eql('LogCall');
    expect(callLog.args.accountOwner)
      .to.eql(who);
    expect(callLog.args.accountNumber)
      .to.eql(accountNumber);
    expect(callLog.args.callee)
      .to.eql(dolomiteMargin.testing.callee.address);
  });

  it('Succeeds and sets status to Normal', async () => {
    await dolomiteMargin.testing.setAccountStatus(
      who,
      accountNumber,
      AccountStatus.Liquidating,
    );
    await expectCallOkay({
      data: toBytes(accountData, senderData),
    });
    await verifyDataIntegrity(who);
    const status = await dolomiteMargin.getters.getAccountStatus(who, accountNumber);
    expect(status)
      .to.eql(AccountStatus.Normal);
  });

  it('Succeeds for local operator', async () => {
    await dolomiteMargin.permissions.approveOperator(operator, { from: who });
    await expectCallOkay(
      {
        data: toBytes(accountData, senderData),
      },
      { from: operator },
    );
    await verifyDataIntegrity(operator);
  });

  it('Succeeds for global operator', async () => {
    await dolomiteMargin.admin.setGlobalOperator(operator, true, { from: accounts[0] });
    await expectCallOkay(
      {
        data: toBytes(accountData, senderData),
      },
      { from: operator },
    );
    await verifyDataIntegrity(operator);
  });

  it('Fails for non-operator', async () => {
    await expectCallRevert(
      {
        data: toBytes(accountData, senderData),
      },
      'Storage: Unpermissioned operator',
      { from: operator },
    );
  });

  it('Fails for non-ICallee contract', async () => {
    await expectCallRevert({
      data: toBytes(accountData, senderData),
      callee: dolomiteMargin.testing.priceOracle.address,
    });
  });
});

// ============ Helper Functions ============

async function expectCallOkay(glob: Object, options?: Object): Promise<TxResult> {
  const combinedGlob = { ...defaultGlob, ...glob };
  return dolomiteMargin.operation
    .initiate()
    .call(combinedGlob)
    .commit(options);
}

async function expectCallRevert(
  glob: Object,
  reason?: string,
  options?: Object,
) {
  await expectThrow(expectCallOkay(glob, options), reason);
}

async function verifyDataIntegrity(sender: address) {
  const [foundAccountData, foundSenderData] = await Promise.all([
    dolomiteMargin.testing.callee.getAccountData(who, accountNumber),
    dolomiteMargin.testing.callee.getSenderData(sender),
  ]);

  expect(foundAccountData)
    .to.eql(accountData.toFixed(0));
  expect(foundSenderData)
    .to.eql(senderData.toFixed(0));
}
