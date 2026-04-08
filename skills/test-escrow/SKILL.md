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

bun install --ignore-scripts
rm -rf node_modules/@aztec/test-wallet/node_modules/@aztec

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

**Assert:**
```
ETH balance for seller: 10000000000000000000    (10 ETH)
USDC balance for seller: 0
ETH balance for buyer: 0
USDC balance for buyer: 50000000000000000000000 (50,000 USDC)
```

### 3. Create Escrow Order

```bash
bun run order:create
```

**Assert output contains:**
- "Escrow contract deployed"
- "1 ETH deposited to escrow"
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

**Assert:**
```
ETH balance for seller: 9000000000000000000     (9 ETH)
USDC balance for seller: 0
ETH balance for buyer: 1000000000000000000      (1 ETH)
USDC balance for buyer: 45000000000000000000000 (45,000 USDC)
```

## Success Criteria

1. All 5 steps complete without errors
2. Seller's ETH decreased by exactly 1 ETH (10 -> 9)
3. Buyer's ETH increased by exactly 1 ETH (0 -> 1)
4. Buyer's USDC decreased by exactly 5,000 USDC (50,000 -> 45,000)
5. All transactions were private (no public balance changes)

## What This Tests

- Token contract deployment and initialization
- Private minting via `mint_to_private`
- Escrow contract deployment with custom encryption keys
- Private token deposit with authorization witnesses (authwit)
- Atomic swap via `fill_order` (3 private transfers in one tx)
- Nullifier emission for replay protection
- Orderflow API integration (create, query, delete)
- PXE contract registration and private state sync

## Cleanup

```bash
pkill -f "bun run src/index.ts"
```

## Troubleshooting

- **"Artifact does not match expected class id"**: Missing overrides in root `package.json`. The root package.json MUST include overrides for `@aztec/foundation`, `@aztec/wallet-sdk`, `@aztec/pxe`, `@aztec/accounts`, `@aztec/stdlib`, `@aztec/aztec.js` all at `4.0.0-devnet.2-patch.3`.
- **"No orders found"**: Create an order first with `bun run order:create`
- **"Balance too low"**: Run `bun run setup:mint` to mint more tokens
