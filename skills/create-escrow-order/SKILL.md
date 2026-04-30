---
name: create-escrow-order
description: Create a new private OTC escrow order on Aztec - deploys escrow contract, deposits seller tokens, posts order to API. Requires /deploy-escrow first.
allowed-tools: Bash Read
---

# Create a Private Escrow Order

Create a new private OTC escrow order. The seller deploys an escrow contract, deposits tokens, and posts the order to the orderflow API for buyer discovery.

## Prerequisites

- Localnet running on port 8080
- Orderflow API running on port 3000
- Token contracts deployed and tokens minted (`/deploy-escrow`)

## Steps

1. **Verify services:**
   ```bash
   curl -s http://localhost:8080/status && curl -s http://localhost:3000/health
   ```

2. **Create the order:**
   ```bash
   cd ${CLAUDE_SKILL_DIR}/../../aztec-otc-desk/packages/cli
   bun run order:create
   ```

3. **Verify the order was created:**
   ```bash
   curl -s http://localhost:3000/order | python3 -m json.tool
   ```

## What Happens

1. **Escrow Contract Deployment**: A new `OTCEscrowContract` is deployed with unique encryption keys storing:
   - `sell_token_address` / `sell_token_amount` (what the seller offers)
   - `buy_token_address` / `buy_token_amount` (what the seller wants)
   - A `partial_note` for the private transfer commitment

   The send opts include `additionalScopes: [escrow.address]` so the seller's PXE can read the config note that the deploy tx writes.

2. **Token Deposit**: Seller's tokens transferred privately into escrow via `transfer_private_to_private` with an authorization witness. The deposit also runs with `additionalScopes: [escrow.address]`. A nullifier prevents double-deposits.

3. **Order Registration**: Order posted to API with escrow contract instance and secret key for buyer discovery.

## Custom Trade Parameters

Edit `ETH_SWAP_AMOUNT` and `USDC_SWAP_AMOUNT` in `packages/cli/scripts/utils/index.ts`, or call the contract API directly:

```typescript
import { deployEscrowContract, depositToEscrow } from "@aztec-otc-desk/contracts/contract";

const { contract, instance, secretKey } = await deployEscrowContract(
    wallet, sellerAddress,
    sellTokenAddress, customSellAmount,
    buyTokenAddress, customBuyAmount,
    { send: { from: sellerAddress, additionalScopes: [/* will be filled by helper */] } }
);
await depositToEscrow(
    wallet, sellerAddress, contract, sellToken, customSellAmount,
    { send: { from: sellerAddress, additionalScopes: [contract.address] } }
);
```
