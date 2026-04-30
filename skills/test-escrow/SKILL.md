---
name: test-escrow
description: Run comprehensive end-to-end test of the private escrow system with step-by-step verification. Tests deploy, mint, order creation, order filling, and balance checks.
allowed-tools: Bash Read Grep
---

# End-to-End Private Escrow Test

Run the complete private escrow flow with detailed verification at each step.

## Prerequisites

- Aztec localnet running on port 8080
- Bun runtime installed
- Project scaffolded (use `/scaffold-escrow-project` if not yet created)

## Test Steps

Run all steps sequentially from `aztec-otc-desk/`. Each step MUST succeed before proceeding.

### 1. Setup

```bash
cd ${CLAUDE_SKILL_DIR}/../../aztec-otc-desk

# Install — postinstall builds the token artifact
bun install

# Build the escrow artifact
cd packages/contracts && bun run build && cd ..

cd packages/api && rm -f orders.sqlite
bun run start &
sleep 2

curl -s http://localhost:8080/status   # Must return: OK
curl -s http://localhost:3000/health   # Must return: OK
```

### 2. Deploy & Mint

```bash
cd packages/cli
bun run setup:deploy
bun run setup:mint
bun run balances
```

**Capture initial values** as `INITIAL_SELLER_SELL`, `INITIAL_SELLER_BUY`, `INITIAL_BUYER_SELL`, `INITIAL_BUYER_BUY` — they depend on `ETH_MINT_AMOUNT` / `USDC_MINT_AMOUNT` in `cli/scripts/utils/index.ts` which the consumer can change.

### 3. Create Escrow Order

```bash
bun run order:create
```

**Assert output contains:**
- "Escrow deployed at"
- "ETH deposited to escrow"
- "Order added to otc order service"

### 4. Fill Escrow Order

```bash
bun run order:fill
```

**Assert output contains:**
- "Found a matching order to fill"
- "Filled OTC order with txHash"
- "Order closed in OTC order service"

### 5. Verify Final Balances

```bash
bun run balances
```

**Assert (relative to initial):**
- Seller's sell-token balance decreased by `ETH_SWAP_AMOUNT`
- Seller's buy-token balance increased by `USDC_SWAP_AMOUNT`
- Buyer's sell-token balance increased by `ETH_SWAP_AMOUNT`
- Buyer's buy-token balance decreased by `USDC_SWAP_AMOUNT`

## Success Criteria

1. All 5 steps complete without errors
2. Net change in token balances matches the swap exactly
3. All transactions were private (no public balance changes)

## What This Tests

- Token contract deployment and initialization
- Private minting via `mint_to_private`
- Escrow contract deployment with custom encryption keys + `additionalScopes` self-registration
- Private token deposit with authorization witnesses (authwit)
- Atomic swap via `fill_order` (3 private transfers in one tx)
- Nullifier emission for replay protection
- Orderflow API integration (create, query, delete)
- PXE contract registration and private state sync via `EmbeddedWallet`

## Cleanup

```bash
pkill -f "bun run src/index.ts"
```

## Troubleshooting

- **"No orders found"**: Create an order first with `bun run order:create`
- **"Balance too low"**: Run `bun run setup:mint` to mint more tokens
- **`additionalScopes`-related read failures**: A custom call site stripped the escrow address from send opts. The defaults in `contract.ts` include it — re-add if you've overridden.
- **Token artifact mismatch**: `bun run scripts/token.ts` from project root to recompile against the running node version.
