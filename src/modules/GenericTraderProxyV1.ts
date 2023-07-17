import { toBytesNoPadding } from '../lib/BytesHelper';
import { Contracts } from '../lib/Contracts';
import { AccountInfo, address, ContractCallOptions, Integer, TxResult } from '../types';

export enum GenericTraderType {
  ExternalLiquidity = 0,
  InternalLiquidity = 1,
  IsolationModeUnwrapper = 2,
  IsolationModeWrapper = 3,
}

export interface GenericTraderParam {
  traderType: GenericTraderType;
  makerAccountIndex: number;
  trader: address;
  tradeData: string;
}

export interface GenericTransferCollateralParam {
  fromAccountNumber: Integer;
  toAccountNumber: Integer;
  transferAmounts: GenericTransferCollateralAmounts[];
}

export interface GenericTransferCollateralAmounts {
  marketId: Integer;
  amountWei: Integer;
}

export interface GenericExpiryParam {
  marketId: Integer;
  expiryTimeDelta: Integer;
}

export interface GenericUserConfig {
  deadline: number | string;
  balanceCheckFlag: number | string;
}

interface GenericTraderCalldata {
  traderType: number | string;
  makerAccountIndex: number;
  trader: string;
  tradeData: (string | number[])[];
}

interface GenericTransferCollateralAmountParamCalldata {
  marketId: number | string;
  amountWei: number | string;
}

interface GenericTransferCollateralParamCalldata {
  fromAccountNumber: number | string;
  toAccountNumber: number | string;
  transferAmounts: GenericTransferCollateralAmountParamCalldata[];
}

interface GenericExpiryParamCalldata {
  marketId: number | string;
  expiryTimeDelta: number | string;
}

export class GenericTraderProxyV1 {
  private contracts: Contracts;

  constructor(contracts: Contracts) {
    this.contracts = contracts;
  }

  public get address(): address {
    return this.contracts.genericTraderProxyV1.options.address;
  }

  public static genericTraderParamsToCalldata(traderParams: GenericTraderParam[]): GenericTraderCalldata[] {
    return traderParams.map(traderParam => ({
      traderType: traderParam.traderType,
      makerAccountIndex: traderParam.makerAccountIndex,
      trader: traderParam.trader,
      tradeData: toBytesNoPadding(traderParam.tradeData),
    }));
  }

  public static genericTransferParamToCalldata(
    transferParam: GenericTransferCollateralParam,
  ): GenericTransferCollateralParamCalldata {
    return {
      fromAccountNumber: transferParam.fromAccountNumber.toFixed(0),
      toAccountNumber: transferParam.toAccountNumber.toFixed(0),
      transferAmounts: transferParam.transferAmounts.map(transferAmount => ({
        marketId: transferAmount.marketId.toFixed(0),
        amountWei: transferAmount.amountWei.toFixed(0),
      })),
    };
  }

  public static genericExpiryToCalldata(expiryParam: GenericExpiryParam): GenericExpiryParamCalldata {
    return {
      marketId: expiryParam.marketId.toFixed(0),
      expiryTimeDelta: expiryParam.expiryTimeDelta.toFixed(0),
    };
  }

  // ============ State-Changing Functions ============

  /**
   * Executes a trade using the path of markets provided and the provided traders.
   *
   * @param tradeAccountNumber  The account number `msg.sender` will trade from
   * @param marketIdsPath       The market IDs that will be traded, in order. The first marketId is the input and the
   *                            last is the output.
   * @param inputAmountWei      The amount of the input token to be traded, in wei.
   * @param minOutputAmountWei  The minimum amount of the output token to be received, in wei.
   * @param traderParams        The traders to be used for each action. The length should be `marketIdsPath.length - 1`.
   * @param makerAccounts       The accounts that will be used as makers for each trade of type
   *                            `TradeType.InternalLiquidity`. The length should be equal to the number of unique maker
   *                            accounts needed to execute the trade with the provided `tradersPath`.
   * @param userConfig          The user config to be used for the trade.
   * @param options             Additional options to be passed through to the web3 call.
   */
  public async swapExactInputForOutput(
    tradeAccountNumber: Integer,
    marketIdsPath: Integer[],
    inputAmountWei: Integer,
    minOutputAmountWei: Integer,
    traderParams: GenericTraderParam[],
    makerAccounts: AccountInfo[],
    userConfig: GenericUserConfig,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.genericTraderProxyV1.methods.swapExactInputForOutput(
        tradeAccountNumber.toFixed(0),
        marketIdsPath.map(marketId => marketId.toFixed(0)),
        inputAmountWei.toFixed(),
        minOutputAmountWei.toFixed(),
        GenericTraderProxyV1.genericTraderParamsToCalldata(traderParams),
        makerAccounts,
        userConfig,
      ),
      options,
    );
  }

  /**
   * Executes a trade using the path of markets provided and the provided traders. After the trades are executed (and
   * within the same operation) the transfers and expirations are executed.
   *
   * @param tradeAccountNumber      The account number msg.sender will trade from
   * @param marketIdsPath           The market IDs that will be traded, in order. The first marketId is the input and
   *                                the last is the output.
   * @param inputAmountWei          The amount of the input token to be traded, in wei.
   * @param minOutputAmountWei      The minimum amount of the output token to be received, in wei.
   * @param traderParams            The traders to be used for each action. The length should be
   *                                `marketIdsPath.length - 1`.
   * @param makerAccounts           The accounts that will be used as makers for each trade of type
   *                                `TradeType.InternalLiquidity`. The length should be equal to the number of unique
   *                                maker accounts needed to execute the trade with the provided `tradersPath`.
   * @param transferCollateralParam The transfers to be executed after the trades. The length of the amounts should be
   *                                non-zero.
   * @param expiryParam             The expirations to be executed after the trades. Expirations can only be set on
   *                                negative amounts (debt).
   * @param userConfig
   * @param options                 Additional options to be passed through to the web3 call.
   */
  public async swapExactInputForOutputAndModifyPosition(
    tradeAccountNumber: Integer,
    marketIdsPath: Integer[],
    inputAmountWei: Integer,
    minOutputAmountWei: Integer,
    traderParams: GenericTraderParam[],
    makerAccounts: AccountInfo[],
    transferCollateralParam: GenericTransferCollateralParam,
    expiryParam: GenericExpiryParam,
    userConfig: GenericUserConfig,
    options: ContractCallOptions = {},
  ): Promise<TxResult> {
    return this.contracts.callContractFunction(
      this.contracts.genericTraderProxyV1.methods.swapExactInputForOutputAndModifyPosition(
        tradeAccountNumber.toFixed(0),
        marketIdsPath.map(marketId => marketId.toFixed(0)),
        inputAmountWei.toFixed(),
        minOutputAmountWei.toFixed(),
        GenericTraderProxyV1.genericTraderParamsToCalldata(traderParams),
        makerAccounts,
        GenericTraderProxyV1.genericTransferParamToCalldata(transferCollateralParam),
        GenericTraderProxyV1.genericExpiryToCalldata(expiryParam),
        userConfig,
      ),
      options,
    );
  }
}
