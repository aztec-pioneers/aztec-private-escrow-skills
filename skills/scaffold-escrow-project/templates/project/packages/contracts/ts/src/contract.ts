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
import type { PrivateEvent, Wallet } from "@aztec/aztec.js/wallet";
import { BlockNumber } from "@aztec/foundation/branded-types";
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
export type OrderFilledEvent = { filled: boolean };
export type RoleAddedEvent = { secret: bigint };

export async function deployEscrowContract(
    wallet: Wallet,
    from: AztecAddress,
    sellTokenAddress: AztecAddress,
    sellTokenAmount: bigint,
    buyTokenAddress: AztecAddress,
    buyTokenAmount: bigint,
    opts: { send?: DeployOpts, creatorRoleSecret?: Fr } = { send: { from } }
): Promise<{
    contract: OTCEscrowContract,
    instance: ContractInstanceWithAddress,
    contractSecretKey: Fr,
    creatorRoleSecret: Fr,
    manifest: EscrowManifest,
}> {
    const creatorRoleSecret = opts.creatorRoleSecret ?? Fr.random();
    const fundingNonce = Fr.random();
    const contractSecretKey = Fr.random();
    const contractPublicKeys = (await deriveKeys(contractSecretKey)).publicKeys;
    const contractDeployment = await OTCEscrowContract.deployWithPublicKeys(
        contractPublicKeys, wallet,
        sellTokenAddress, sellTokenAmount,
        buyTokenAddress, buyTokenAmount,
        creatorRoleSecret,
        fundingNonce,
    );
    const deployOpts: DeployOpts = {
        from,
        skipClassPublication: true,
        skipInstancePublication: true,
        universalDeploy: true,
        contractAddressSalt: Fr.random(),
        ...(opts.send ?? {}),
    };
    const instance = await contractDeployment.getInstance(deployOpts);
    await wallet.registerContract(instance, OTCEscrowContractArtifact, contractSecretKey);
    await wallet.registerSender(instance.address);
    const sellToken = TokenContract.at(sellTokenAddress, wallet);
    const { authwit } = await getPrivateTransferAuthwit(
        wallet, from, sellToken, instance.address, instance.address, sellTokenAmount, fundingNonce,
    );
    const sendOpts = {
        ...deployOpts,
        // The deployer needs the escrow's own address scoped in to read escrow-owned notes back.
        additionalScopes: [instance.address, ...(deployOpts.additionalScopes ?? [])],
        authWitnesses: [authwit, ...(deployOpts.authWitnesses ?? [])],
    };
    const { contract, receipt } = await contractDeployment.send(sendOpts);
    if (receipt.blockNumber === undefined) {
        throw new Error("Escrow deployment receipt did not include a block number");
    }
    const manifest = EscrowManifest.create({
        instance,
        createdBlockNumber: receipt.blockNumber,
        contractSecretKey,
        txHash: receipt.txHash.toString(),
    });
    return { contract, instance, contractSecretKey, creatorRoleSecret, manifest };
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

export async function voidEscrow(
    wallet: Wallet, from: AztecAddress,
    escrow: OTCEscrowContract, creatorRoleSecret: Fr,
    opts: { send?: SendOpts }
        = { send: { from, additionalScopes: [escrow.address] } }
): Promise<TxHash> {
    escrow = escrow.withWallet(wallet);
    const sendOpts = {
        from,
        ...(opts.send ?? {}),
        additionalScopes: [escrow.address, ...(opts.send?.additionalScopes ?? [])],
    };
    const refundNonce = Fr.random();
    const { receipt } = await escrow.methods.void_order(refundNonce, creatorRoleSecret)
        .send(sendOpts);
    return receipt.txHash;
}

export async function getPrivateTransferAuthwit(
    wallet: Wallet, from: AztecAddress,
    token: TokenContract, caller: AztecAddress, to: AztecAddress, amount: bigint,
    nonce: Fr = Fr.random(),
): Promise<{ authwit: AuthWitness, nonce: Fr }> {
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

export async function getOrderFilledEvent(
    wallet: Wallet,
    node: AztecNode,
    escrow: OTCEscrowContract,
    createdBlockNumber: number,
): Promise<PrivateEvent<OrderFilledEvent> | undefined> {
    const currentBlockNumber = await node.getBlockNumber();
    const events = await wallet.getPrivateEvents<OrderFilledEvent>(
        OTCEscrowContract.events.OrderFilled,
        {
            contractAddress: escrow.address,
            fromBlock: BlockNumber(createdBlockNumber),
            toBlock: BlockNumber(currentBlockNumber + 1),
            scopes: [escrow.address],
        },
    );
    return events[0];
}

export async function retrieveRoleSecret(
    wallet: Wallet,
    node: AztecNode,
    escrow: OTCEscrowContract,
    recipient: AztecAddress,
    fromBlock: number,
): Promise<bigint> {
    const currentBlockNumber = await node.getBlockNumber();
    const events = await wallet.getPrivateEvents<RoleAddedEvent>(
        OTCEscrowContract.events.RoleAdded,
        {
            contractAddress: escrow.address,
            fromBlock: BlockNumber(fromBlock),
            toBlock: BlockNumber(currentBlockNumber + 1),
            scopes: [recipient],
        },
    );
    const event = events[0];
    if (!event) {
        throw new Error(`RoleAdded event not found for ${recipient.toString()}`);
    }
    return event.event.secret;
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
    wallet: Wallet, node: AztecNode, tokenAddress: AztecAddress,
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
