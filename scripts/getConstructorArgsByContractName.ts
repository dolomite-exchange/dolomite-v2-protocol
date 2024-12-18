/* eslint-disable */
import path from 'path';
import { Provider } from 'web3/providers';
import { DolomiteMargin } from '../src';
import DeployedContracts from '../migrations/deployed.json';
import { readFileSync } from 'fs';

const DEPLOY_FUNCTION_PARAMS_LENGTH = 200;

export async function getConstructorArgsByContractName(
  contractName: string,
  provider: Provider | string,
  networkId: number,
): Promise<string> {
  const dolomiteMargin = new DolomiteMargin(provider, networkId);

  const transactionHash = DeployedContracts[contractName]?.[networkId]?.transactionHash;
  const input = (await dolomiteMargin.web3.eth.getTransaction(transactionHash)).input;
  const artifactPath = path.resolve('build', 'contracts', `${contractName}.json`);
  const artifact = JSON.parse(JSON.stringify(readFileSync(artifactPath)));
  const constructorArgs = input.substring(DEPLOY_FUNCTION_PARAMS_LENGTH + artifact.bytecode.length);
  return constructorArgs.substring(0, Math.floor(constructorArgs.length / 64) * 64);
}
