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

```typescript
import { AztecAddress } from "@aztec/aztec.js/addresses";
import type {
    ContractInstanceWithAddress,
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

export async function deployEscrowContract(
    wallet: Wallet,
    from: AztecAddress,
    sellTokenAddress: AztecAddress,
    sellTokenAmount: bigint,
    buyTokenAddress: AztecAddress,
    buyTokenAmount: bigint,
    opts: { send: SendInteractionOptions<InteractionWaitOptions> } = { send: { from } }
): Promise<{ contract: OTCEscrowContract, instance: ContractInstanceWithAddress, secretKey: Fr }> {
    const secretKey = Fr.random();
    const contractPublicKeys = (await deriveKeys(secretKey)).publicKeys;
    const contractDeployment = await OTCEscrowContract.deployWithPublicKeys(
        contractPublicKeys, wallet,
        sellTokenAddress, sellTokenAmount,
        buyTokenAddress, buyTokenAmount,
    );
    const instance = await contractDeployment.getInstance();
    await wallet.registerContract(instance, OTCEscrowContractArtifact, secretKey);
    // The deployer needs the escrow's own address scoped in to read the partial-note + config back.
    opts.send = { additionalScopes: [instance.address], ...opts.send };
    const { contract } = await contractDeployment.send(opts.send);
    return { contract, instance, secretKey };
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
    escrowSecretKey: Fr,
): Promise<OTCEscrowContract> => {
    await wallet.registerContract(contractInstance, OTCEscrowContractArtifact, escrowSecretKey);
    await wallet.registerSender(escrowAddress);
    return await OTCEscrowContract.at(escrowAddress, wallet);
};
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
export { wad, isTestnet } from "./utils.js";
export { getPriorityFeeOptions, getSponsoredPaymentMethod } from "./fees.js";
```
