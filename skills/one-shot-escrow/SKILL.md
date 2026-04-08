---
name: one-shot-escrow
description: Execute the entire Aztec private escrow flow in one shot - deploy tokens, mint, create order, fill order, verify swap. Requires localnet on port 8080.
allowed-tools: Bash Read Grep
---

# One-Shot Private Escrow

Execute the entire private escrow flow in a single run - from infrastructure deployment to completed atomic swap on Aztec localnet.

## Prerequisites

- Aztec localnet running on port 8080 (`aztec start --local-network`)
- Bun runtime installed
- Project scaffolded (use `/scaffold-escrow-project` if not yet created)

## Execute

Run every command below sequentially from the project root. Stop immediately if any step fails.

```bash
# ---- SETUP ----
cd ${CLAUDE_SKILL_DIR}/../../aztec-otc-desk

# Install dependencies (CRITICAL: --ignore-scripts flag required)
bun install --ignore-scripts
rm -rf node_modules/@aztec/test-wallet/node_modules/@aztec

# Start orderflow API (fresh database)
cd packages/api
rm -f orders.sqlite
bun run start &
API_PID=$!
cd ../cli
sleep 2

# ---- DEPLOY ----
# Deploy ETH + USDC token contracts
bun run setup:deploy

# Mint tokens: 10 ETH -> seller, 50k USDC -> buyer
bun run setup:mint

# Show initial balances
echo "=== INITIAL BALANCES ==="
bun run balances

# ---- TRADE ----
# Seller creates escrow order (deploys escrow, deposits 1 ETH, posts to API)
bun run order:create

# Buyer fills the order (swaps 5k USDC for 1 ETH atomically)
bun run order:fill

# Show final balances
echo "=== FINAL BALANCES ==="
bun run balances

# ---- CLEANUP ----
kill $API_PID 2>/dev/null
echo "Done! Private escrow completed successfully."
```

## Expected Output

**Initial:**
- Seller: 10 ETH, 0 USDC
- Buyer: 0 ETH, 50,000 USDC

**After swap:**
- Seller: 9 ETH, 0 USDC (sold 1 ETH — USDC received via partial note)
- Buyer: 1 ETH, 45,000 USDC (bought 1 ETH for 5,000 USDC)

## Verification Checklist

- [ ] Token contracts deployed (2 deploy transactions)
- [ ] Tokens minted to correct accounts (2 mint transactions)
- [ ] Escrow contract deployed with unique keys
- [ ] 1 ETH deposited into escrow privately
- [ ] Order posted to orderflow API
- [ ] Buyer filled order with atomic swap (1 fill transaction)
- [ ] Order closed in API
- [ ] Final balances match expected values

## Troubleshooting

- **"Artifact does not match expected class id"**: Missing overrides in root `package.json`. See `/deploy-escrow` skill for required overrides.
- **Localnet not running**: Start with `aztec start --local-network` in another terminal
- **API port in use**: `pkill -f "bun run src/index.ts"` then retry
- **Install errors**: `rm -rf node_modules bun.lockb && bun install --ignore-scripts && rm -rf node_modules/@aztec/test-wallet/node_modules/@aztec`
- **DB errors**: Delete `packages/api/orders.sqlite` and restart API
