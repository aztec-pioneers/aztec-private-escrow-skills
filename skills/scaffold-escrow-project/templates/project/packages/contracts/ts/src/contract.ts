import { AztecAddress } from "@aztec/aztec.js/addresses";
import type {
    ContractInstanceWithAddress,
    DeployOptions,
    InteractionWaitOptions,
    SendInteractionOptions,
    SimulateInteractionOptions,
} from "@aztec/aztec.js/contracts";
import { Fr } from "@aztec/aztec.js/fields";
import type { AztecNode } from "@aztec/aztec.js/node";
import { TxHash } from "@aztec/aztec.js/tx";
import type { Wallet } from "@aztec/aztec.js/wallet";
import { AuthWitness } from "@aztec/stdlib/auth-witness";
import { deriveKeys } from "@aztec/stdlib/keys";
import {
    OTCEscrowContract,
    OTCEscrowContractArtifact,
    TokenContract,
    TokenContractArtifact
} from "./artifacts/index.js";
import { type EscrowConfig } from "./constants.js";
import { EscrowManifest } from "./manifest.js";

type DeployOpts = DeployOptions;
type SendOpts = SendInteractionOptions<InteractionWaitOptions>;

export async function deployEscrowContract(
    wallet: Wallet,
    from: AztecAddress,
    sellTokenAddress: AztecAddress,
    sellTokenAmount: bigint,
    buyTokenAddress: AztecAddress,
    buyTokenAmount: bigint,
    opts: { send?: DeployOpts } = { send: { from } }
): Promise<{
    contract: OTCEscrowContract,
    instance: ContractInstanceWithAddress,
    contractSecretKey: Fr,
    manifest: EscrowManifest,
}> {
    const contractSecretKey = Fr.random();
    const contractPublicKeys = (await deriveKeys(contractSecretKey)).publicKeys;
    const contractDeployment = await OTCEscrowContract.deployWithPublicKeys(
        contractPublicKeys, wallet,
        sellTokenAddress, sellTokenAmount,
        buyTokenAddress, buyTokenAmount,
    );
    const deployOpts = {
        from,
        skipClassPublication: true,
        skipInstancePublication: true,
        ...(opts.send ?? {}),
    };
    const instance = await contractDeployment.getInstance(deployOpts);
    await wallet.registerContract(instance, OTCEscrowContractArtifact, contractSecretKey);
    // The deployer needs the escrow's own address scoped in to read the partial-note + config back.
    deployOpts.additionalScopes = [instance.address, ...(deployOpts.additionalScopes ?? [])];
    const { contract, receipt } = await contractDeployment.send(deployOpts);
    if (receipt.blockNumber === undefined) {
        throw new Error("Escrow deployment receipt did not include a block number");
    }
    const manifest = EscrowManifest.create({
        instance,
        createdBlockNumber: receipt.blockNumber,
        contractSecretKey,
        txHash: receipt.txHash.toString(),
    });
    return { contract, instance, contractSecretKey, manifest };
}

export async function deployTokenContract(
    wallet: Wallet,
    from: AztecAddress,
    tokenMetadata: { name: string; symbol: string; decimals: number },
    opts: { send?: SendOpts } = { send: { from } }
): Promise<{ contract: TokenContract, instance: ContractInstanceWithAddress }> {
    const contractDeployment = await TokenContract.deployWithOpts(
        { wallet, method: "constructor_with_minter" },
        tokenMetadata.name, tokenMetadata.symbol, tokenMetadata.decimals,
        from,
    );
    const sendOpts = { from, ...(opts.send ?? {}) };
    const instance = await contractDeployment.getInstance();
    const { contract } = await contractDeployment.send(sendOpts);
    return { contract, instance };
}

export async function depositToEscrow(
    wallet: Wallet, from: AztecAddress,
    escrow: OTCEscrowContract, token: TokenContract, amount: bigint,
    opts: { send?: SendOpts }
        = { send: { from, additionalScopes: [escrow.address] } }
): Promise<TxHash> {
    escrow = escrow.withWallet(wallet);
    const sendOpts = {
        from,
        ...(opts.send ?? {}),
        additionalScopes: [escrow.address, ...(opts.send?.additionalScopes ?? [])],
    };
    const { nonce, authwit } = await getPrivateTransferAuthwit(
        wallet, from, token, escrow.address, escrow.address, amount,
    );
    const { receipt } = await escrow.methods.deposit_tokens(nonce)
        .with({ authWitnesses: [authwit] })
        .send(sendOpts);
    return receipt.txHash;
}

export async function fillOTCOrder(
    wallet: Wallet, from: AztecAddress,
    escrow: OTCEscrowContract, token: TokenContract, amount: bigint,
    opts: { send?: SendOpts }
        = { send: { from, additionalScopes: [escrow.address] } }
): Promise<TxHash> {
    escrow = escrow.withWallet(wallet);
    const sendOpts = {
        from,
        ...(opts.send ?? {}),
        additionalScopes: [escrow.address, ...(opts.send?.additionalScopes ?? [])],
    };
    const { nonce, authwit } = await getPrivateTransferAuthwit(
        wallet, from, token, escrow.address, escrow.address, amount,
    );
    const { receipt } = await escrow.methods.fill_order(nonce)
        .with({ authWitnesses: [authwit] })
        .send(sendOpts);
    return receipt.txHash;
}

export async function getPrivateTransferAuthwit(
    wallet: Wallet, from: AztecAddress,
    token: TokenContract, caller: AztecAddress, to: AztecAddress, amount: bigint,
): Promise<{ authwit: AuthWitness, nonce: Fr }> {
    const nonce = Fr.random();
    const call = await token.withWallet(wallet).methods
        .transfer_private_to_private(from, to, amount, nonce)
        .getFunctionCall();
    const authwit = await wallet.createAuthWit(from, { caller, call });
    return { authwit, nonce };
}

export async function getEscrowConfig(
    wallet: Wallet, escrow: OTCEscrowContract,
): Promise<EscrowConfig> {
    const { result } = await escrow.withWallet(wallet)
        .methods.get_config().simulate({ from: escrow.address });
    return result;
}

export async function expectBalancePrivate(
    wallet: Wallet, from: AztecAddress, token: TokenContract,
    expectedBalance: bigint, opts: SimulateInteractionOptions = { from }
): Promise<boolean> {
    const { result: empiricalBalance } = await token.withWallet(wallet).methods
        .balance_of_private(from).simulate(opts);
    return empiricalBalance === expectedBalance;
}

export const getTokenContract = async (
    wallet: Wallet, from: AztecAddress, node: AztecNode, tokenAddress: AztecAddress,
): Promise<TokenContract> => {
    const contractInstance = await node.getContract(tokenAddress);
    if (!contractInstance)
        throw new Error(`No instance for token contract at ${tokenAddress.toString()} found!`);
    await wallet.registerContract(contractInstance, TokenContractArtifact);
    return await TokenContract.at(tokenAddress, wallet);
};

export const getEscrowContract = async (
    wallet: Wallet, from: AztecAddress,
    escrowAddress: AztecAddress, contractInstance: ContractInstanceWithAddress,
    contractSecretKey: Fr,
): Promise<OTCEscrowContract> => {
    await wallet.registerContract(contractInstance, OTCEscrowContractArtifact, contractSecretKey);
    await wallet.registerSender(escrowAddress);
    return await OTCEscrowContract.at(escrowAddress, wallet);
};
