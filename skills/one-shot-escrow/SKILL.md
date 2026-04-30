---
name: one-shot-escrow
description: Execute the entire Aztec private escrow flow in one shot - deploy tokens, mint, create order, fill order, verify swap. Requires localnet on port 8080.
allowed-tools: Bash Read Grep
---

# One-Shot Private Escrow

Execute the entire private escrow flow in a single run — from infrastructure deployment to completed atomic swap on Aztec localnet.

## Prerequisites

- Aztec localnet running on port 8080 (`aztec start --local-network`)
- Bun runtime installed
- Project scaffolded (use `/scaffold-escrow-project` if not yet created)

## Execute

Run every command below sequentially from the project root. Stop immediately if any step fails.

```bash
# ---- SETUP ----
cd ${CLAUDE_SKILL_DIR}/../../aztec-otc-desk

# Install — postinstall builds the token artifact via scripts/token.ts
bun install

# Build escrow artifact (only needed once per .nr change)
cd packages/contracts && bun run build && cd ..

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

# Mint tokens to seller (ETH) and buyer (USDC)
bun run setup:mint

# Show initial balances
echo "=== INITIAL BALANCES ==="
bun run balances

# ---- TRADE ----
# Seller creates escrow order (deploys escrow, deposits sell tokens, posts to API)
bun run order:create

# Buyer fills the order (atomic swap)
bun run order:fill

# Show final balances
echo "=== FINAL BALANCES ==="
bun run balances

# ---- CLEANUP ----
kill $API_PID 2>/dev/null
echo "Done! Private escrow completed successfully."
```

## Expected Behavior

After the swap:
- Seller's `sell_token` balance decreased by `ETH_SWAP_AMOUNT`
- Seller's `buy_token` balance increased by `USDC_SWAP_AMOUNT`
- Buyer's `sell_token` balance increased by `ETH_SWAP_AMOUNT`
- Buyer's `buy_token` balance decreased by `USDC_SWAP_AMOUNT`

Exact numbers depend on the constants in `packages/cli/scripts/utils/index.ts` — they're consumer-defined.

## Verification Checklist

- [ ] Token contracts deployed (2 deploy transactions)
- [ ] Tokens minted to correct accounts (2 mint transactions)
- [ ] Escrow contract deployed with unique keys
- [ ] Sell tokens deposited into escrow privately
- [ ] Order posted to orderflow API
- [ ] Buyer filled order with atomic swap (1 fill transaction)
- [ ] Order closed in API
- [ ] Final balances reflect the swap

## Troubleshooting

- **Localnet not running**: Start with `aztec start --local-network` in another terminal
- **API port in use**: `pkill -f "bun run src/index.ts"` then retry
- **DB errors**: Delete `packages/api/orders.sqlite` and restart API
- **`additionalScopes` errors / "cannot read note"**: The send opts probably dropped the escrow address. The TS helpers default to including it; check any custom call sites.
- **Token artifact mismatch**: `bun run scripts/token.ts` from the project root to recompile against the running node version.
