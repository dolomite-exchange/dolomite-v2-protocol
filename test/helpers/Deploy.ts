import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import Contract from 'web3/eth/contract';
import Web3 from 'web3';
import { TestContracts } from '../modules/TestContracts';

// eslint-disable-next-line import/prefer-default-export
export async function deployContract<T extends Contract>(dolomiteMargin: TestDolomiteMargin, json: any, args?: any[]) {
  return deployContractWithoutDolomiteMargin<T>(dolomiteMargin.web3, dolomiteMargin.contracts, json, args);
}

export async function deployContractWithoutDolomiteMargin<T extends Contract>(
  web3: Web3,
  contracts: TestContracts,
  json: any,
  args?: any[],
) {
  const contract = new web3.eth.Contract(json.abi) as T;
  const receipt = await contract
    .deploy({
      arguments: args,
      data: json.bytecode,
    })
    .send({
      from: web3.eth.defaultAccount,
      gas: contracts.getDefaultGasLimit(),
      gasPrice: contracts.getDefaultGasPrice(),
    });
  contract.options.address = (receipt as any)._address;
  contract.options.from = web3.eth.defaultAccount;
  return contract;
}
