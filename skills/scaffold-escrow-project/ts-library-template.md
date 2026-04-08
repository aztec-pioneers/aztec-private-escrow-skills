# TypeScript Library Templates

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

export const isTestnet = async (node: AztecNode): Promise<boolean> => {
    const chainId = await node.getNodeInfo().then(info => info.l1ChainId);
    return chainId === 11155111; // Sepolia testnet
}
```

## packages/contracts/ts/src/fees.ts

```typescript
import type { InteractionFeeOptions } from "@aztec/aztec.js/contracts";
import type { AztecNode } from "@aztec/aztec.js/node";
import { GasSettings } from "@aztec/stdlib/gas";

export async function getPriorityFeeOptions(
    node: AztecNode,
    feeMultiplier: bigint
): Promise<InteractionFeeOptions> {
    const maxFeesPerGas = await node.getCurrentBaseFees()
        .then(res => res.mul(feeMultiplier));
    return { gasSettings: GasSettings.default({ maxFeesPerGas }) };
}
```

## packages/contracts/ts/src/contract.ts

IMPORTANT: This file uses the correct authwit pattern for v4.0.0-devnet.2-patch.3:
- Use `.getFunctionCall()` to get the call data
- Use `wallet.createAuthWit(from, { caller, call })` — TWO arguments
- Use `.with({ authWitnesses: [authwit] })` to attach authwit to the transaction
- Do NOT use `wallet.addAuthWitness()` separately

```typescript
import { AztecAddress } from "@aztec/aztec.js/addresses";
import type {
    ContractInstanceWithAddress,
    SendInteractionOptions,
    SimulateInteractionOptions,
    WaitOpts,
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
    opts: { send: SendInteractionOptions, wait?: WaitOpts } = { send: { from } }
): Promise<{ contract: OTCEscrowContract, instance: ContractInstanceWithAddress, secretKey: Fr }> {
    const secretKey = Fr.random();
    const contractPublicKeys = (await deriveKeys(secretKey)).publicKeys;
    const contractDeployment = await OTCEscrowContract.deployWithPublicKeys(
        contractPublicKeys, wallet,
        sellTokenAddress, sellTokenAmount,
        buyTokenAddress, buyTokenAmount
    );
    const instance = await contractDeployment.getInstance();
    await wallet.registerContract(instance, OTCEscrowContractArtifact, secretKey);
    const contract = await contractDeployment.send({ ...opts.send, wait: opts.wait });
    return { contract, instance, secretKey };
}

export async function deployTokenContract(
    wallet: Wallet,
    from: AztecAddress,
    tokenMetadata: { name: string; symbol: string; decimals: number },
    opts: { send: SendInteractionOptions, wait?: WaitOpts } = { send: { from } }
): Promise<{ contract: TokenContract, instance: ContractInstanceWithAddress }> {
    const contractDeployment = await TokenContract.deployWithOpts(
        { wallet, method: "constructor_with_minter" },
        tokenMetadata.name, tokenMetadata.symbol, tokenMetadata.decimals,
        from, AztecAddress.ZERO,
    )
    const instance = await contractDeployment.getInstance();
    const contract = await contractDeployment.send({ ...opts.send, wait: opts.wait });
    return { contract, instance };
}

export async function depositToEscrow(
    wallet: Wallet, from: AztecAddress,
    escrow: OTCEscrowContract, token: TokenContract, amount: bigint,
    opts: { send: SendInteractionOptions, wait?: WaitOpts } = { send: { from } }
): Promise<TxHash> {
    escrow = escrow.withWallet(wallet);
    const { nonce, authwit } = await getPrivateTransferAuthwit(
        wallet, from, token, escrow.address, escrow.address, amount,
    );
    const receipt = await escrow.methods.deposit_tokens(nonce)
        .with({ authWitnesses: [authwit] })
        .send({ ...opts.send, wait: opts.wait });
    return receipt.txHash;
}

export async function fillOTCOrder(
    wallet: Wallet, from: AztecAddress,
    escrow: OTCEscrowContract, token: TokenContract, amount: bigint,
    opts: { send: SendInteractionOptions, wait?: WaitOpts } = { send: { from } }
): Promise<TxHash> {
    escrow = escrow.withWallet(wallet);
    const { nonce, authwit } = await getPrivateTransferAuthwit(
        wallet, from, token, escrow.address, escrow.address, amount,
    );
    const receipt = await escrow.methods.fill_order(nonce)
        .with({ authWitnesses: [authwit] })
        .send({ ...opts.send, wait: opts.wait });
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
    return { authwit, nonce }
}

export async function getEscrowConfig(
    wallet: Wallet, from: AztecAddress, escrow: OTCEscrowContract,
    opts: SimulateInteractionOptions = { from }
): Promise<EscrowConfig> {
    return await escrow.withWallet(wallet).methods.get_config().simulate(opts);
}

export async function expectBalancePrivate(
    wallet: Wallet, from: AztecAddress, token: TokenContract,
    expectedBalance: bigint, opts: SimulateInteractionOptions = { from }
): Promise<boolean> {
    const balance = await token.withWallet(wallet).methods
        .balance_of_private(from).simulate(opts);
    return balance === expectedBalance;
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
export { getPriorityFeeOptions } from "./fees.js";
```
