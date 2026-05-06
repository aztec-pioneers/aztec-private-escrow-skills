# TypeScript Library Templates

These templates target Aztec `4.2.0-aztecnr-rc.2`. The wallet API is `EmbeddedWallet` from `@aztec/wallets/embedded`. Cross-contract reads use `additionalScopes` in send opts.

## packages/contracts/ts/src/artifacts/index.ts

```typescript
export { TokenContract, TokenContractArtifact } from "./token/Token";
export { OTCEscrowContract, OTCEscrowContractArtifact } from "./escrow/OTCEscrow";
```

## packages/contracts/ts/src/constants.ts

```typescript
import { AztecAddress } from "@aztec/aztec.js/addresses";

export const TOKEN_METADATA = {
    usdc: { name: "USD Coin", symbol: "USDC", decimals: 6 },
    eth: { name: "Ether", symbol: "ETH", decimals: 18 }
}

export type EscrowConfig = {
    owner: AztecAddress,
    partial_node: bigint,
    sell_token_address: AztecAddress,
    sell_token_amount: bigint,
    buy_token_address: AztecAddress,
    buy_token_amount: bigint,
    randomness: bigint,
};
```

## packages/contracts/ts/src/utils.ts

```typescript
import type { AztecNode } from "@aztec/aztec.js/node";

export const wad = (n: bigint = 1n, decimals: bigint = 18n) =>
    n * 10n ** decimals;
export const precision = wad;

export const isTestnet = async (node: AztecNode): Promise<boolean> => {
    const chainId = await node.getNodeInfo().then(info => info.l1ChainId);
    return chainId === 11155111; // Sepolia testnet
}
```

## packages/contracts/ts/src/fees.ts

```typescript
import { AztecAddress } from "@aztec/aztec.js/addresses";
import type { InteractionFeeOptions } from "@aztec/aztec.js/contracts";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import type { AztecNode } from "@aztec/aztec.js/node";
import type { Wallet } from "@aztec/aztec.js/wallet";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { GasSettings } from "@aztec/stdlib/gas";

export async function getSponsoredPaymentMethod(
    node: AztecNode, wallet: Wallet, fpcAddress: AztecAddress
) {
    const instance = await node.getContract(fpcAddress);
    if (!instance) throw new Error(`SponsoredFPC not found on-chain at ${fpcAddress}`);
    await wallet.registerContract(instance, SponsoredFPCContractArtifact);
    return new SponsoredFeePaymentMethod(fpcAddress);
}

export async function getPriorityFeeOptions(
    node: AztecNode, feeMultiplier: bigint
): Promise<InteractionFeeOptions> {
    const maxFeesPerGas = (await node.getCurrentMinFees()).mul(feeMultiplier);
    return { gasSettings: GasSettings.default({ maxFeesPerGas }) };
}
```

## packages/contracts/ts/src/contract.ts

Patterns:

- **Authwit:** `.getFunctionCall()` → `wallet.createAuthWit(from, { caller, call })` → `.with({ authWitnesses: [authwit] })`.
- **`additionalScopes` is required** when an account needs to read another contract's notes inside a private function. Deploying an escrow that immediately writes a note about itself, depositing into the escrow, and filling it all need the escrow address scoped in.
- **Token APIs are adapter-specific:** helper names should describe escrow capabilities. The concrete token method names below are only valid if they match the selected token binding.
- **Fill receipts:** `fill_order` emits an escrow-addressed `OrderFilled` private event with constrained onchain delivery. The SDK can return the tx hash and leave event decoding to the consuming app/test harness.
- **No custom order-level fill/deposit nullifiers:** one-shot fills are asset-gated and can replay if the maker funds the escrow again. Document this in generated app/test code instead of adding a default replay guard.

```typescript
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
} from "./artifacts";
import { type EscrowConfig } from "./constants";
import { createEscrowManifest, type EscrowManifest } from "./manifest";

export async function deployEscrowContract(
    wallet: Wallet,
    from: AztecAddress,
    sellTokenAddress: AztecAddress,
    sellTokenAmount: bigint,
    buyTokenAddress: AztecAddress,
    buyTokenAmount: bigint,
    opts: { send: DeployOptions } = { send: { from } }
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
        ...opts.send,
    };
    const instance = await contractDeployment.getInstance(deployOpts);
    await wallet.registerContract(instance, OTCEscrowContractArtifact, contractSecretKey);
    // The deployer needs the escrow's own address scoped in to read the partial-note + config back.
    deployOpts.additionalScopes = [instance.address, ...(deployOpts.additionalScopes ?? [])];
    const { contract, receipt } = await contractDeployment.send(deployOpts);
    const manifest = createEscrowManifest({
        instance,
        contractSecretKey,
        sellTokenAddress,
        sellTokenAmount,
        buyTokenAddress,
        buyTokenAmount,
        txHash: receipt.txHash.toString(),
    });
    return { contract, instance, contractSecretKey, manifest };
}

export async function deployTokenContract(
    wallet: Wallet,
    from: AztecAddress,
    tokenMetadata: { name: string; symbol: string; decimals: number },
    opts: { send: SendInteractionOptions<InteractionWaitOptions> } = { send: { from } }
): Promise<{ contract: TokenContract, instance: ContractInstanceWithAddress }> {
    const contractDeployment = await TokenContract.deployWithOpts(
        { wallet, method: "constructor_with_minter" },
        tokenMetadata.name, tokenMetadata.symbol, tokenMetadata.decimals,
        from,
    );
    const instance = await contractDeployment.getInstance();
    const { contract } = await contractDeployment.send(opts.send);
    return { contract, instance };
}

export async function depositToEscrow(
    wallet: Wallet, from: AztecAddress,
    escrow: OTCEscrowContract, token: TokenContract, amount: bigint,
    opts: { send: SendInteractionOptions<InteractionWaitOptions> }
        = { send: { from, additionalScopes: [escrow.address] } }
): Promise<TxHash> {
    escrow = escrow.withWallet(wallet);
    const { nonce, authwit } = await getPrivateTransferAuthwit(
        wallet, from, token, escrow.address, escrow.address, amount,
    );
    const { receipt } = await escrow.methods.deposit_tokens(nonce)
        .with({ authWitnesses: [authwit] })
        .send(opts.send);
    return receipt.txHash;
}

export async function fillOTCOrder(
    wallet: Wallet, from: AztecAddress,
    escrow: OTCEscrowContract, token: TokenContract, amount: bigint,
    opts: { send: SendInteractionOptions<InteractionWaitOptions> }
        = { send: { from, additionalScopes: [escrow.address] } }
): Promise<TxHash> {
    escrow = escrow.withWallet(wallet);
    const { nonce, authwit } = await getPrivateTransferAuthwit(
        wallet, from, token, escrow.address, escrow.address, amount,
    );
    const { receipt } = await escrow.methods.fill_order(nonce)
        .with({ authWitnesses: [authwit] })
        .send(opts.send);
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
```

## packages/contracts/ts/src/manifest.ts

```typescript
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/aztec.js/fields";
import type { Wallet } from "@aztec/aztec.js/wallet";
import {
    ContractInstanceWithAddressSchema,
    type ContractInstanceWithAddress,
} from "@aztec/stdlib/contract";
import {
    OTCEscrowContract,
    OTCEscrowContractArtifact,
} from "./artifacts";

export type EscrowManifest = {
    version: 1;
    kind: string;
    aztecVersion: string;
    deployment: {
        address: string;
        contractInstance: unknown;
        artifactName: string;
        constructorArgs: {
            sellTokenAddress: string;
            sellTokenAmount: string;
            buyTokenAddress: string;
            buyTokenAmount: string;
        };
        publicKeys?: unknown;
        skipClassPublication?: boolean;
        skipInstancePublication?: boolean;
        txHash?: string;
    };
    access?: {
        contractSecretKey?: string;
        encryptedContractSecretKey?: string;
        encryptionScheme?: string;
        visibleCapabilities: Array<"instantiate" | "read-shared-private-state" | "execute-private-calls">;
    };
    roles?: Array<{
        name: string;
        address?: string;
        pseudonym?: string;
        commitment?: string;
        capabilities: string[];
    }>;
    lifecycle?: {
        phases: string[];
        initialPhase: string;
        terminalPhases: string[];
        immutableWindows?: Record<string, string>;
    };
    sensitiveTerms?: Array<{
        key: string;
        commitment: string;
        encryptedPlaintext?: string;
        encryptionScheme?: string;
    }>;
    metadata?: Record<string, unknown>;
};

export function createEscrowManifest(args: {
    instance: ContractInstanceWithAddress;
    contractSecretKey?: Fr;
    sellTokenAddress: AztecAddress;
    sellTokenAmount: bigint;
    buyTokenAddress: AztecAddress;
    buyTokenAmount: bigint;
    txHash?: string;
    kind?: string;
}): EscrowManifest {
    return {
        version: 1,
        kind: args.kind ?? "otc-atomic-swap",
        aztecVersion: "4.2.0-aztecnr-rc.2",
        deployment: {
            address: args.instance.address.toString(),
            contractInstance: JSON.parse(JSON.stringify(args.instance)),
            artifactName: "OTCEscrow",
            constructorArgs: {
                sellTokenAddress: args.sellTokenAddress.toString(),
                sellTokenAmount: args.sellTokenAmount.toString(),
                buyTokenAddress: args.buyTokenAddress.toString(),
                buyTokenAmount: args.buyTokenAmount.toString(),
            },
            skipClassPublication: true,
            skipInstancePublication: true,
            txHash: args.txHash,
        },
        access: args.contractSecretKey
            ? {
                contractSecretKey: args.contractSecretKey.toString(),
                visibleCapabilities: [
                    "instantiate",
                    "read-shared-private-state",
                    "execute-private-calls",
                ],
            }
            : { visibleCapabilities: ["instantiate"] },
    };
}

export function getEscrowInstanceFromManifest(
    manifest: EscrowManifest,
): ContractInstanceWithAddress {
    return ContractInstanceWithAddressSchema.parse(manifest.deployment.contractInstance);
}

export function getContractSecretKeyFromManifest(
    manifest: EscrowManifest,
): Fr | undefined {
    const raw = manifest.access?.contractSecretKey;
    return raw ? Fr.fromString(raw) : undefined;
}

export async function registerEscrowFromManifest(
    wallet: Wallet,
    manifest: EscrowManifest,
): Promise<OTCEscrowContract> {
    const instance = getEscrowInstanceFromManifest(manifest);
    const contractSecretKey = getContractSecretKeyFromManifest(manifest);
    await wallet.registerContract(instance, OTCEscrowContractArtifact, contractSecretKey);
    await wallet.registerSender(instance.address);
    return OTCEscrowContract.at(AztecAddress.fromString(manifest.deployment.address), wallet);
}
```

## packages/contracts/ts/src/index.ts

```typescript
export {
    deployEscrowContract, deployTokenContract,
    depositToEscrow, fillOTCOrder,
    getPrivateTransferAuthwit, getEscrowConfig,
    expectBalancePrivate, getTokenContract, getEscrowContract,
} from "./contract.js";

export { TOKEN_METADATA, type EscrowConfig } from "./constants.js";
export {
    createEscrowManifest,
    getContractSecretKeyFromManifest,
    getEscrowInstanceFromManifest,
    registerEscrowFromManifest,
    type EscrowManifest,
} from "./manifest.js";
export { wad, isTestnet } from "./utils.js";
export { getPriorityFeeOptions, getSponsoredPaymentMethod } from "./fees.js";
```
