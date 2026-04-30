---
name: fill-escrow-order
description: Fill an existing private escrow order as the buyer - performs atomic swap of tokens via zero-knowledge proofs. Requires an open order from /create-escrow-order.
allowed-tools: Bash Read
---

# Fill a Private Escrow Order

Fill an existing private OTC escrow order as the buyer. Fetches orders from the API, transfers buyer's tokens into escrow, and triggers the atomic swap.

## Prerequisites

- Localnet running on port 8080
- Orderflow API running on port 3000
- An open escrow order exists (`/create-escrow-order`)
- Buyer has sufficient token balance

## Steps

1. **Verify an order exists:**
   ```bash
   curl -s http://localhost:3000/order | python3 -m json.tool
   ```

2. **Fill the order:**
   ```bash
   cd ${CLAUDE_SKILL_DIR}/../../aztec-otc-desk/packages/cli
   bun run order:fill
   ```

3. **Verify the swap:**
   ```bash
   bun run balances
   ```

## Atomic Swap Mechanics

The `fill_order` function performs three private operations in a single transaction:

1. Buyer's "buy" tokens transferred privately into escrow via `transfer_private_to_private`
2. Those tokens sent to the seller via `transfer_private_to_commitment` (using the partial note created at escrow deploy time)
3. Seller's "sell" tokens transferred privately from escrow to buyer via `transfer_private_to_private`
4. Nullifier emitted to prevent double-fill

All operations succeed or fail atomically. Zero-knowledge proofs ensure no party learns the other's balance or identity.

The fill tx must be sent with `additionalScopes: [escrow.address]` so the buyer's PXE can read the escrow's config note. `fillOTCOrder` sets this by default.

## Troubleshooting

- **"No orders found"**: Create an order first with `/create-escrow-order`
- **"Balance too low"**: Run `bun run setup:mint` to mint more tokens
- **"Unknown auth witness"**: Escrow contract instance reconstruction failed — check API response integrity, and that the order's `contractInstance` JSON wasn't corrupted in transit
