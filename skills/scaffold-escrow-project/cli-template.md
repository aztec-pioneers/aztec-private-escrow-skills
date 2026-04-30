# CLI Scripts Templates

These templates target Aztec `4.2.0-aztecnr-rc.2`. The wallet API is `EmbeddedWallet` from `@aztec/wallets/embedded`. Sandbox/testnet branching is handled by `getOTCAccounts` + `getTestnetSendWaitOptions`.

## packages/cli/scripts/utils/types.ts

```typescript
import { type Order } from "../../../api/src/types/api";
export type OrderAPIResponse = { success: boolean, message: string, data: Order[] };
```

## packages/cli/scripts/utils/api.ts

```typescript
import {
    ContractInstanceWithAddressSchema,
    type ContractInstanceWithAddress
} from "@aztec/stdlib/contract";
import { OTCEscrowContract } from "@aztec-otc-desk/contracts/artifacts";
import { getEscrowContract } from "@aztec-otc-desk/contracts/contract";
import type { Order } from "../../../api/src/types/api";
import {
    eth as ethDeployment,
    usdc as usdcDeployment
} from "../data/deployments.json";
import type { OrderAPIResponse } from "./types";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Fr } from "@aztec/aztec.js/fields";
import type { Wallet } from "@aztec/aztec.js/wallet";

export const getOrders = async (apiUrl: string): Promise<Order[]> => {
    const fullURL = `${apiUrl}/order`
        + `?buy_token_address=${usdcDeployment.address}`
        + `&sell_token_address=${ethDeployment.address}`;
    const res = await fetch(fullURL, { method: "GET" });
    if (!res.ok) throw new Error("Failed to fetch orders");
    const data: OrderAPIResponse = await res.json() as OrderAPIResponse;
    if (data.data.length === 0) throw new Error("No orders found");
    return data.data;
}

export const createOrder = async (
    escrowAddress: AztecAddress | string,
    contractInstance: ContractInstanceWithAddress,
    secretKey: Fr,
    sellTokenAddress: AztecAddress | string,
    sellTokenAmount: bigint,
    buyTokenAddress: AztecAddress | string,
    buyTokenAmount: bigint,
    apiUrl: string
) => {
    if (typeof escrowAddress === "string") escrowAddress = AztecAddress.fromString(escrowAddress);
    if (typeof sellTokenAddress === "string") sellTokenAddress = AztecAddress.fromString(sellTokenAddress);
    if (typeof buyTokenAddress === "string") buyTokenAddress = AztecAddress.fromString(buyTokenAddress);

    const payload = {
        escrowAddress: escrowAddress.toString(),
        contractInstance: JSON.stringify(contractInstance),
        secretKey: secretKey.toString(),
        sellTokenAddress: sellTokenAddress.toString(),
        sellTokenAmount: sellTokenAmount.toString(),
        buyTokenAddress: buyTokenAddress.toString(),
        buyTokenAmount: buyTokenAmount.toString()
    };
    const res = await fetch(`${apiUrl}/order`, {
        method: "POST",
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to create order");
    console.log("Order added to otc order service");
}

export const closeOrder = async (id: string, apiUrl: string) => {
    const res = await fetch(`${apiUrl}/order?id=${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Unknown error closing filled order");
    console.log("Order closed in OTC order service");
}

export const escrowInstanceFromOrder = async (
    wallet: Wallet, from: AztecAddress, order: Order,
): Promise<OTCEscrowContract> => {
    const escrowContractInstance = ContractInstanceWithAddressSchema.parse(
        JSON.parse(order.contractInstance)
    );
    return await getEscrowContract(
        wallet, from,
        AztecAddress.fromString(order.escrowAddress),
        escrowContractInstance,
        Fr.fromString(order.secretKey),
    );
}
```

## packages/cli/scripts/utils/index.ts

```typescript
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { getInitialTestAccountsData } from "@aztec/accounts/testing";
import { isTestnet, wad } from "@aztec-otc-desk/contracts/utils";
import { getPriorityFeeOptions, getSponsoredPaymentMethod } from "@aztec-otc-desk/contracts/fees";
import readline from "readline";
import accounts from "../data/accounts.json";
import type { SendInteractionOptions, WaitOpts } from "@aztec/aztec.js/contracts";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { AztecNode } from "@aztec/aztec.js/node";
import { Fr } from "@aztec/aztec.js/fields";
import type { PXEConfig } from "@aztec/pxe/config";

export const ETH_MINT_AMOUNT = wad(10n);
export const ETH_SWAP_AMOUNT = ETH_MINT_AMOUNT / 10n;
export const USDC_MINT_AMOUNT = wad(50000n);
export const USDC_SWAP_AMOUNT = USDC_MINT_AMOUNT / 10n;
export const testnetBaseFeePadding = 100;
export const testnetPriorityFee = 10n;
export const testnetTimeout = 3600;
export const testnetInterval = 3;

export const getTestnetSendWaitOptions = async (
    node: AztecNode,
    wallet: EmbeddedWallet,
    from: AztecAddress,
    withFPC: boolean = true,
): Promise<{ send: SendInteractionOptions<WaitOpts> }> => {
    let send: SendInteractionOptions<WaitOpts> = { from };
    if (await isTestnet(node)) {
        let fee = await getPriorityFeeOptions(node, testnetPriorityFee);
        if (withFPC) {
            const { SPONSORED_FPC_ADDRESS } = process.env;
            if (!SPONSORED_FPC_ADDRESS) throw new Error("SPONSORED_FPC_ADDRESS is not defined");
            const paymentMethod = await getSponsoredPaymentMethod(
                node, wallet, AztecAddress.fromString(SPONSORED_FPC_ADDRESS)
            );
            fee = { ...fee, paymentMethod };
        }
        send = { ...send, fee, wait: { timeout: testnetTimeout, interval: testnetInterval } };
    }
    return { send };
}

export const getOTCAccounts = async (
    node: AztecNode,
    pxeConfig: Partial<PXEConfig> = {}
): Promise<{
    wallet: EmbeddedWallet,
    sellerAddress: AztecAddress,
    buyerAddress: AztecAddress,
}> => {
    const wallet = await EmbeddedWallet.create(node, { pxeConfig });
    let sellerAddress: AztecAddress;
    let buyerAddress: AztecAddress;
    if (await isTestnet(node)) {
        sellerAddress = await getAccountFromFs("seller", wallet);
        buyerAddress = await getAccountFromFs("buyer", wallet);
    } else {
        const [sellerAccount, buyerAccount] = await getInitialTestAccountsData();
        if (!sellerAccount) throw new Error("Seller / Minter not found");
        if (!buyerAccount) throw new Error("Buyer not found");
        sellerAddress = (await wallet.createSchnorrAccount(
            sellerAccount.secret, sellerAccount.salt, sellerAccount.signingKey
        )).address;
        buyerAddress = (await wallet.createSchnorrAccount(
            buyerAccount.secret, buyerAccount.salt, buyerAccount.signingKey
        )).address;
    }
    await wallet.registerSender(buyerAddress, "buyer");
    await wallet.registerSender(sellerAddress, "seller");
    return { wallet, sellerAddress, buyerAddress };
}

export const getAccountFromFs = async (
    accountType: "seller" | "buyer",
    wallet: EmbeddedWallet
): Promise<AztecAddress> => {
    const accountSecret = accounts[accountType];
    const secretKey = Fr.fromString(accountSecret.secretKey);
    const salt = Fr.fromString(accountSecret.salt);
    const manager = await wallet.createSchnorrAccount(secretKey, salt);
    return manager.address;
}

export const waitForBlock = async (node: AztecNode, targetBlock: number) => {
    return new Promise((resolve) => {
        let currentBlock = 0;
        let seconds = 0;
        const interval = setInterval(async () => {
            if (seconds % 5 === 0) {
                (async () => { currentBlock = await node.getBlockNumber(); })();
            }
            seconds++;
            const dots = ".".repeat((seconds - 1) % 4);
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`Current block: ${currentBlock} (waiting until ${targetBlock})${dots}`);
            if (currentBlock >= targetBlock) {
                clearInterval(interval);
                process.stdout.write("\n");
                resolve(currentBlock);
            }
        }, 1000);
    });
};

export * from "./api.js";
export * from "./types.js";
```

## packages/cli/scripts/setup_accounts.ts

Creates persistent seller/buyer accounts (used on testnet). Sandbox callers can skip this — `getOTCAccounts` will use `getInitialTestAccountsData()`.

```typescript
import "dotenv/config";
import { writeFileSync } from "fs";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { getTestnetSendWaitOptions } from "./utils";
import { isTestnet } from "@aztec-otc-desk/contracts/utils";
import type { PXEConfig } from "@aztec/pxe/config";
import { Fr } from "@aztec/aztec.js/fields";

const { L2_NODE_URL } = process.env;
if (!L2_NODE_URL) throw new Error("L2_NODE_URL is not defined");

const main = async () => {
    const node = createAztecNodeClient(L2_NODE_URL);
    let pxeConfig: Partial<PXEConfig> = {};
    if (await isTestnet(node)) pxeConfig = { proverEnabled: true };

    const sellerWallet = await EmbeddedWallet.create(node, { pxeConfig });
    const sellerSecret = Fr.random();
    const sellerSalt = Fr.random();
    const sellerManager = await sellerWallet.createSchnorrAccount(sellerSecret, sellerSalt);
    const sellerOpts = await getTestnetSendWaitOptions(node, sellerWallet, sellerManager.address);
    await sellerManager.getDeployMethod()
        .then(deployMethod => deployMethod.send(sellerOpts.send));

    const buyerWallet = await EmbeddedWallet.create(node, { pxeConfig });
    const buyerSecret = Fr.random();
    const buyerSalt = Fr.random();
    const buyerManager = await buyerWallet.createSchnorrAccount(buyerSecret, buyerSalt);
    const buyerOpts = await getTestnetSendWaitOptions(node, buyerWallet, buyerManager.address);
    await buyerManager.getDeployMethod()
        .then(deployMethod => deployMethod.send(buyerOpts.send));

    const accountData = {
        seller: { secretKey: sellerSecret, salt: sellerSalt },
        buyer: { secretKey: buyerSecret, salt: buyerSalt },
    };
    const accountFilePath = `${__dirname}/data/accounts.json`;
    writeFileSync(accountFilePath, JSON.stringify(accountData, null, 2));
    console.log(`Wrote accounts to ${accountFilePath}`);
}

main().then(() => process.exit(0));
```

## packages/cli/scripts/deploy.ts

```typescript
import "dotenv/config";
import { deployTokenContract } from "@aztec-otc-desk/contracts/contract";
import { TOKEN_METADATA } from "@aztec-otc-desk/contracts/constants";
import { writeFileSync } from "node:fs";
import { getTestnetSendWaitOptions, getOTCAccounts } from "./utils";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { isTestnet } from "@aztec-otc-desk/contracts/utils";

const { L2_NODE_URL } = process.env;
if (!L2_NODE_URL) throw new Error("L2_NODE_URL not set in env");

const main = async () => {
    const node = createAztecNodeClient(L2_NODE_URL);
    let pxeConfig = {};
    if (await isTestnet(node)) pxeConfig = { proverEnabled: true };

    const { wallet, sellerAddress: deployerAddress } = await getOTCAccounts(node, pxeConfig);
    const opts = await getTestnetSendWaitOptions(node, wallet, deployerAddress);

    console.log("Deploying Wrapped Ether token contract");
    const { contract: eth } = await deployTokenContract(wallet, deployerAddress, TOKEN_METADATA.eth, opts);
    console.log("Ether token contract deployed, address: ", eth.address);

    console.log("Deploying USD Coin token contract");
    const { contract: usdc } = await deployTokenContract(wallet, deployerAddress, TOKEN_METADATA.usdc, opts);
    console.log("USDC token contract deployed, address: ", usdc.address);

    const filepath = `${__dirname}/data/deployments.json`;
    writeFileSync(filepath, JSON.stringify(
        { eth: { address: eth.address }, usdc: { address: usdc.address } }, null, 2
    ));
    console.log(`Deployments written to ${filepath}`);
}

main().then(() => process.exit(0));
```

## packages/cli/scripts/mint.ts

```typescript
import "dotenv/config";
import {
    ETH_MINT_AMOUNT, getOTCAccounts, USDC_MINT_AMOUNT, getTestnetSendWaitOptions
} from "./utils";
import { eth as ethDeployment, usdc as usdcDeployment } from "./data/deployments.json";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { getTokenContract } from "@aztec-otc-desk/contracts/contract";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { isTestnet } from "@aztec-otc-desk/contracts/utils";

const { L2_NODE_URL } = process.env;
if (!L2_NODE_URL) throw new Error("L2_NODE_URL not set in env");

const main = async () => {
    const node = createAztecNodeClient(L2_NODE_URL);
    let pxeConfig = {};
    if (await isTestnet(node)) pxeConfig = { proverEnabled: true };
    const { wallet, sellerAddress, buyerAddress } = await getOTCAccounts(node, pxeConfig);

    const ethAddress = AztecAddress.fromString(ethDeployment.address);
    const eth = await getTokenContract(wallet, sellerAddress, node, ethAddress);
    const opts = await getTestnetSendWaitOptions(node, wallet, sellerAddress);

    console.log("Minting eth to seller account");
    await eth.withWallet(wallet).methods
        .mint_to_private(sellerAddress, ETH_MINT_AMOUNT).send(opts.send);
    console.log("10 eth minted to seller");

    const usdcAddress = AztecAddress.fromString(usdcDeployment.address);
    const usdc = await getTokenContract(wallet, sellerAddress, node, usdcAddress);
    console.log("Minting USDC to buyer account");
    await usdc.withWallet(wallet).methods
        .mint_to_private(buyerAddress, USDC_MINT_AMOUNT).send(opts.send);
    console.log("50,000 USDC minted to buyer");
}

main().then(() => process.exit(0));
```

## packages/cli/scripts/create_order.ts

```typescript
import "dotenv/config";
import {
    deployEscrowContract, depositToEscrow, getTokenContract
} from "@aztec-otc-desk/contracts/contract";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { eth as ethDeployment, usdc as usdcDeployment } from "./data/deployments.json";
import {
    createOrder, ETH_SWAP_AMOUNT, getOTCAccounts, USDC_SWAP_AMOUNT, getTestnetSendWaitOptions
} from "./utils";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import type { PXEConfig } from "@aztec/pxe/config";
import { isTestnet } from "@aztec-otc-desk/contracts/utils";

const { L2_NODE_URL, API_URL } = process.env;
if (!L2_NODE_URL) throw new Error("L2_NODE_URL is not defined");
if (!API_URL) throw new Error("API_URL is not defined");

const main = async () => {
    const node = await createAztecNodeClient(L2_NODE_URL);
    let pxeConfig: Partial<PXEConfig> = {};
    if (await isTestnet(node)) pxeConfig = { proverEnabled: true };

    const { wallet, sellerAddress } = await getOTCAccounts(node, pxeConfig);

    const ethAddress = AztecAddress.fromString(ethDeployment.address);
    const eth = await getTokenContract(wallet, sellerAddress, node, ethAddress);
    const usdcAddress = AztecAddress.fromString(usdcDeployment.address);
    // register usdc too so PXE knows about it (we don't act on it here)
    await getTokenContract(wallet, sellerAddress, node, usdcAddress);

    const opts = await getTestnetSendWaitOptions(node, wallet, sellerAddress);

    const { contract: escrowContract, instance: escrowContractInstance, secretKey } =
        await deployEscrowContract(
            wallet, sellerAddress, ethAddress, ETH_SWAP_AMOUNT,
            usdcAddress, USDC_SWAP_AMOUNT, opts
        );
    console.log(`Escrow deployed at ${escrowContract.address}, secret key: ${secretKey}`);

    // scope the escrow into the deposit so the seller can read its config note
    const depositOpts = { send: { ...opts.send, additionalScopes: [escrowContract.address] } };
    console.log("Depositing eth to escrow");
    const receipt = await depositToEscrow(
        wallet, sellerAddress, escrowContract, eth, ETH_SWAP_AMOUNT, depositOpts
    );
    console.log("ETH deposited to escrow, tx: ", receipt.hash);

    await createOrder(
        escrowContract.address, escrowContractInstance, secretKey,
        eth.address, ETH_SWAP_AMOUNT,
        AztecAddress.fromString(usdcDeployment.address), USDC_SWAP_AMOUNT,
        API_URL
    );
}

main().then(() => process.exit(0));
```

## packages/cli/scripts/buy_order.ts

```typescript
import "dotenv/config";
import { fillOTCOrder, getTokenContract } from "@aztec-otc-desk/contracts/contract";
import { eth as ethDeployment, usdc as usdcDeployment } from "./data/deployments.json";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import {
    closeOrder, escrowInstanceFromOrder, getOrders, getOTCAccounts,
    getTestnetSendWaitOptions, USDC_SWAP_AMOUNT
} from "./utils";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import type { PXEConfig } from "@aztec/pxe/config";
import { isTestnet } from "@aztec-otc-desk/contracts/utils";

const { L2_NODE_URL, API_URL } = process.env;
if (!L2_NODE_URL) throw new Error("L2_NODE_URL is not defined");
if (!API_URL) throw new Error("API_URL is not defined");

const main = async () => {
    const orders = await getOrders(API_URL);
    const orderToFill = orders[0]!;
    console.log("Found a matching order to fill");

    const node = await createAztecNodeClient(L2_NODE_URL);
    let pxeConfig: Partial<PXEConfig> = {};
    if (await isTestnet(node)) pxeConfig = { proverEnabled: true };
    const { wallet, buyerAddress } = await getOTCAccounts(node, pxeConfig);

    const usdcAddress = AztecAddress.fromString(usdcDeployment.address);
    const usdc = await getTokenContract(wallet, buyerAddress, node, usdcAddress);
    const ethAddress = AztecAddress.fromString(ethDeployment.address);
    await getTokenContract(wallet, buyerAddress, node, ethAddress);

    const escrow = await escrowInstanceFromOrder(wallet, buyerAddress, orderToFill);

    const opts = await getTestnetSendWaitOptions(node, wallet, buyerAddress);
    opts.send = { ...opts.send, additionalScopes: [escrow.address] };
    console.log("Attempting to fill order");
    const txHash = await fillOTCOrder(
        wallet, buyerAddress, escrow, usdc, USDC_SWAP_AMOUNT, opts
    );
    console.log("Filled OTC order with txHash: ", txHash.hash.toString());

    await closeOrder(orderToFill.orderId, API_URL);
}

main().then(() => process.exit(0));
```

## packages/cli/scripts/print_balances.ts

```typescript
import "dotenv/config";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { getTokenContract } from "@aztec-otc-desk/contracts/contract";
import { getOTCAccounts } from "./utils";
import { eth as ethDeployment, usdc as usdcDeployment } from "./data/deployments.json";
import { createAztecNodeClient } from "@aztec/aztec.js/node";

const { L2_NODE_URL } = process.env;
if (!L2_NODE_URL) throw new Error("L2_NODE_URL is not defined");

const main = async () => {
    const node = await createAztecNodeClient(L2_NODE_URL);
    const { wallet, sellerAddress, buyerAddress } = await getOTCAccounts(node);

    const eth = await getTokenContract(wallet, sellerAddress, node, AztecAddress.fromString(ethDeployment.address));
    const usdc = await getTokenContract(wallet, sellerAddress, node, AztecAddress.fromString(usdcDeployment.address));

    const { result: sellerETHBalance } = await eth.methods
        .balance_of_private(sellerAddress).simulate({ from: sellerAddress });
    const { result: sellerUSDCBalance } = await usdc.methods
        .balance_of_private(sellerAddress).simulate({ from: sellerAddress });
    const { result: buyerETHBalance } = await eth.methods
        .balance_of_private(buyerAddress).simulate({ from: buyerAddress });
    const { result: buyerUSDCBalance } = await usdc.methods
        .balance_of_private(buyerAddress).simulate({ from: buyerAddress });

    console.log("==================[Balances]==================");
    console.log(`ETH balance for seller: ${sellerETHBalance}`);
    console.log(`USDC balance for seller: ${sellerUSDCBalance}`);
    console.log(`ETH balance for buyer: ${buyerETHBalance}`);
    console.log(`USDC balance for buyer: ${buyerUSDCBalance}`);
    console.log("==============================================");
}

main().then(() => process.exit(0));
```
