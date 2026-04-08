# CLI Scripts Templates

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
import type { OrderAPIResponse } from "./types";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Fr } from "@aztec/aztec.js/fields";
import type { Wallet } from "@aztec/aztec.js/wallet";

export const getOrders = async (apiUrl: string): Promise<Order[]> => {
    const res = await fetch(`${apiUrl}/order`, { method: "GET" });
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
        headers: { "Content-Type": "application/json" },
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
import { TestWallet } from "@aztec/test-wallet/server";
import { getInitialTestAccountsData } from "@aztec/accounts/testing";
import { wad } from "@aztec-otc-desk/contracts/utils";
import type { SendInteractionOptions, WaitOpts } from "@aztec/aztec.js/contracts";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { AztecNode } from "@aztec/aztec.js/node";

export const ETH_MINT_AMOUNT = wad(10n);
export const ETH_SWAP_AMOUNT = ETH_MINT_AMOUNT / 10n;
export const USDC_MINT_AMOUNT = wad(50000n);
export const USDC_SWAP_AMOUNT = USDC_MINT_AMOUNT / 10n;

export const getTestnetSendWaitOptions = async (
    node: AztecNode, wallet: TestWallet, from: AztecAddress,
): Promise<{ send: SendInteractionOptions, wait: WaitOpts }> => {
    return { send: { from }, wait: {} };
}

export const getOTCAccounts = async (
    node: AztecNode, pxeConfig: Record<string, any> = {}
): Promise<{ wallet: TestWallet, sellerAddress: AztecAddress, buyerAddress: AztecAddress }> => {
    let wallet = await TestWallet.create(node, pxeConfig);
    const [sellerAccount, buyerAccount] = await getInitialTestAccountsData();
    if (!sellerAccount) throw new Error("Seller/ Minter not found");
    if (!buyerAccount) throw new Error("Buyer not found");
    await wallet.createSchnorrAccount(sellerAccount.secret, sellerAccount.salt);
    const sellerAddress = sellerAccount.address;
    await wallet.createSchnorrAccount(buyerAccount.secret, buyerAccount.salt);
    const buyerAddress = buyerAccount.address;
    await wallet.registerSender(buyerAddress);
    await wallet.registerSender(sellerAddress);
    return { wallet, sellerAddress, buyerAddress };
}

export * from "./api.js";
export * from "./types.js";
```

## packages/cli/scripts/deploy.ts

```typescript
import "dotenv/config";
import { deployTokenContract } from "@aztec-otc-desk/contracts/contract";
import { TOKEN_METADATA } from "@aztec-otc-desk/contracts/constants";
import { writeFileSync } from "node:fs"
import { getTestnetSendWaitOptions, getOTCAccounts } from "./utils";
import { createAztecNodeClient } from "@aztec/aztec.js/node";

const { L2_NODE_URL } = process.env;
if (!L2_NODE_URL) throw new Error("L2_NODE_URL not set in env");

const main = async () => {
    const node = createAztecNodeClient(L2_NODE_URL);
    console.log("Connected to Aztec node at ", L2_NODE_URL);
    const { wallet, sellerAddress: deployerAddress } = await getOTCAccounts(node);
    const opts = await getTestnetSendWaitOptions(node, wallet, deployerAddress);

    console.log("Deploying Wrapped Ether token contract");
    const { contract: eth } = await deployTokenContract(wallet, deployerAddress, TOKEN_METADATA.eth, opts);
    console.log("Ether token contract deployed, address: ", eth.address);

    console.log("Deploying USD Coin token contract");
    const { contract: usdc } = await deployTokenContract(wallet, deployerAddress, TOKEN_METADATA.usdc, opts);
    console.log("USDC token contract deployed, address: ", usdc.address);

    const filepath = `${__dirname}/data/deployments.json`;
    writeFileSync(filepath, JSON.stringify({ eth: { address: eth.address }, usdc: { address: usdc.address } }, null, 2));
    console.log(`Deployments written to ${filepath}`);
}
main().then(() => process.exit(0));
```

## packages/cli/scripts/mint.ts

```typescript
import "dotenv/config";
import { ETH_MINT_AMOUNT, getOTCAccounts, USDC_MINT_AMOUNT, getTestnetSendWaitOptions } from "./utils";
import { eth as ethDeployment, usdc as usdcDeployment } from "./data/deployments.json"
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { getTokenContract } from "@aztec-otc-desk/contracts/contract";
import { createAztecNodeClient } from "@aztec/aztec.js/node";

const { L2_NODE_URL } = process.env;
if (!L2_NODE_URL) throw new Error("L2_NODE_URL not set in env");

const main = async () => {
    const node = createAztecNodeClient(L2_NODE_URL);
    const { wallet, sellerAddress, buyerAddress } = await getOTCAccounts(node);
    const opts = await getTestnetSendWaitOptions(node, wallet, sellerAddress);

    const eth = await getTokenContract(wallet, sellerAddress, node, AztecAddress.fromString(ethDeployment.address));
    console.log("Minting eth to seller account");
    await eth.withWallet(wallet).methods.mint_to_private(sellerAddress, ETH_MINT_AMOUNT).send({ ...opts.send, wait: opts.wait });
    console.log("10 eth minted to seller");

    const usdc = await getTokenContract(wallet, sellerAddress, node, AztecAddress.fromString(usdcDeployment.address));
    console.log("Minting USDC to buyer account");
    await usdc.withWallet(wallet).methods.mint_to_private(buyerAddress, USDC_MINT_AMOUNT).send({ ...opts.send, wait: opts.wait });
    console.log("50,000 USDC minted to buyer");
}
main().then(() => process.exit(0));
```

## packages/cli/scripts/create_order.ts

```typescript
import "dotenv/config";
import { deployEscrowContract, depositToEscrow, getTokenContract } from "@aztec-otc-desk/contracts/contract";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { eth as ethDeployment, usdc as usdcDeployment } from "./data/deployments.json"
import { createOrder, ETH_SWAP_AMOUNT, getOTCAccounts, USDC_SWAP_AMOUNT, getTestnetSendWaitOptions } from "./utils";
import { createAztecNodeClient } from "@aztec/aztec.js/node";

const { L2_NODE_URL, API_URL } = process.env;
if (!L2_NODE_URL) throw new Error("L2_NODE_URL is not defined");
if (!API_URL) throw new Error("API_URL is not defined");

const main = async () => {
    const node = await createAztecNodeClient(L2_NODE_URL);
    const { wallet, sellerAddress } = await getOTCAccounts(node);

    const ethAddress = AztecAddress.fromString(ethDeployment.address);
    const eth = await getTokenContract(wallet, sellerAddress, node, ethAddress);
    const usdcAddress = AztecAddress.fromString(usdcDeployment.address);
    await getTokenContract(wallet, sellerAddress, node, usdcAddress);

    const opts = await getTestnetSendWaitOptions(node, wallet, sellerAddress);
    const { contract: escrowContract, instance: escrowContractInstance, secretKey } =
        await deployEscrowContract(wallet, sellerAddress, ethAddress, ETH_SWAP_AMOUNT, usdcAddress, USDC_SWAP_AMOUNT, opts);
    console.log(`Escrow contract deployed, address: ${escrowContract.address}, secret key: ${secretKey}`);

    console.log("Depositing eth to escrow");
    const receipt = await depositToEscrow(wallet, sellerAddress, escrowContract, eth, ETH_SWAP_AMOUNT, opts);
    console.log("1 ETH deposited to escrow, transaction hash: ", receipt.hash);

    await createOrder(escrowContract.address, escrowContractInstance, secretKey,
        eth.address, ETH_SWAP_AMOUNT, AztecAddress.fromString(usdcDeployment.address), USDC_SWAP_AMOUNT, API_URL);
}
main().then(() => process.exit(0));
```

## packages/cli/scripts/buy_order.ts

```typescript
import "dotenv/config";
import { fillOTCOrder, getTokenContract } from "@aztec-otc-desk/contracts/contract";
import { eth as ethDeployment, usdc as usdcDeployment } from "./data/deployments.json"
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { closeOrder, escrowInstanceFromOrder, getOrders, getOTCAccounts, getTestnetSendWaitOptions, USDC_SWAP_AMOUNT } from "./utils";
import { createAztecNodeClient } from "@aztec/aztec.js/node";

const { L2_NODE_URL, API_URL } = process.env;
if (!L2_NODE_URL) throw new Error("L2_NODE_URL is not defined");
if (!API_URL) throw new Error("API_URL is not defined");

const main = async () => {
    const orders = await getOrders(API_URL);
    const orderToFill = orders[0]!;
    console.log("Found a matching order to fill");

    const node = await createAztecNodeClient(L2_NODE_URL);
    const { wallet, buyerAddress } = await getOTCAccounts(node);

    const usdc = await getTokenContract(wallet, buyerAddress, node, AztecAddress.fromString(usdcDeployment.address));
    await getTokenContract(wallet, buyerAddress, node, AztecAddress.fromString(ethDeployment.address));
    const escrow = await escrowInstanceFromOrder(wallet, buyerAddress, orderToFill);

    const opts = await getTestnetSendWaitOptions(node, wallet, buyerAddress);
    console.log("Attempting to fill order");
    const txHash = await fillOTCOrder(wallet, buyerAddress, escrow, usdc, USDC_SWAP_AMOUNT, opts);
    console.log("Filled OTC order with txHash: ", txHash.hash.toString());

    await closeOrder(orderToFill.orderId, API_URL);
}
main().then(() => process.exit(0));
```

## packages/cli/scripts/print_balances.ts

```typescript
import "dotenv/config";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { getTokenContract } from "@aztec-otc-desk/contracts/contract"
import { getOTCAccounts } from "./utils";
import { eth as ethDeployment, usdc as usdcDeployment } from "./data/deployments.json"
import { createAztecNodeClient } from "@aztec/aztec.js/node";

const { L2_NODE_URL } = process.env;
if (!L2_NODE_URL) throw new Error("L2_NODE_URL is not defined");

const main = async () => {
    const node = await createAztecNodeClient(L2_NODE_URL);
    const { wallet, sellerAddress, buyerAddress } = await getOTCAccounts(node);

    const eth = await getTokenContract(wallet, sellerAddress, node, AztecAddress.fromString(ethDeployment.address));
    const usdc = await getTokenContract(wallet, sellerAddress, node, AztecAddress.fromString(usdcDeployment.address));

    const sellerETHBalance = await eth.methods.balance_of_private(sellerAddress).simulate({ from: sellerAddress });
    const sellerUSDCBalance = await usdc.methods.balance_of_private(sellerAddress).simulate({ from: sellerAddress });
    const buyerETHBalance = await eth.methods.balance_of_private(buyerAddress).simulate({ from: buyerAddress });
    const buyerUSDCBalance = await usdc.methods.balance_of_private(buyerAddress).simulate({ from: buyerAddress });

    console.log("==================[Balances]==================");
    console.log(`ETH balance for seller: ${sellerETHBalance}`);
    console.log(`USDC balance for seller: ${sellerUSDCBalance}`);
    console.log(`ETH balance for buyer: ${buyerETHBalance}`);
    console.log(`USDC balance for buyer: ${buyerUSDCBalance}`);
    console.log("==============================================");
}
main().then(() => process.exit(0));
```
