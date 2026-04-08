---
name: deploy-escrow
description: Deploy Aztec private escrow infrastructure to localnet - token contracts, mint tokens, start orderflow API. Run this before creating escrow orders.
allowed-tools: Bash Read
---

# Deploy Private Escrow Infrastructure

Deploy the full Aztec private escrow infrastructure to the local devnet. Sets up token contracts, mints tokens to test accounts, and verifies readiness for private OTC trading.

## Prerequisites

- Aztec localnet running on port 8080 (`aztec start --local-network`)
- Bun runtime installed

## Steps

1. **Verify localnet is running:**
   ```bash
   curl -s http://localhost:8080/status
   ```
   Must return `OK`. If not, tell the user to start the localnet.

2. **Install dependencies** (from `aztec-otc-desk/`):
   ```bash
   cd ${CLAUDE_SKILL_DIR}/../../aztec-otc-desk
   bun install --ignore-scripts
   rm -rf node_modules/@aztec/test-wallet/node_modules/@aztec
   ```

3. **Start the orderflow API** (background):
   ```bash
   cd packages/api && rm -f orders.sqlite && bun run start &
   ```
   Verify: `curl -s http://localhost:3000/health` should return `OK`.

4. **Deploy token contracts:**
   ```bash
   cd packages/cli && bun run setup:deploy
   ```
   Deploys ETH and USDC tokens, writes addresses to `packages/cli/scripts/data/deployments.json`.

5. **Mint tokens to test accounts:**
   ```bash
   bun run setup:mint
   ```
   Mints 10 ETH to the seller and 50,000 USDC to the buyer.

6. **Verify balances:**
   ```bash
   bun run balances
   ```
   Expected: Seller has 10 ETH, 0 USDC. Buyer has 0 ETH, 50,000 USDC.

## CRITICAL: Dependency Configuration

The root `package.json` MUST include these overrides to prevent version mismatches:

```json
{
  "overrides": {
    "@aztec/foundation": "4.0.0-devnet.2-patch.3",
    "@aztec/wallet-sdk": "4.0.0-devnet.2-patch.3",
    "@aztec/pxe": "4.0.0-devnet.2-patch.3",
    "@aztec/accounts": "4.0.0-devnet.2-patch.3",
    "@aztec/stdlib": "4.0.0-devnet.2-patch.3",
    "@aztec/aztec.js": "4.0.0-devnet.2-patch.3"
  }
}
```

Without these, `@aztec/test-wallet` (only available at `4.0.0-devnet.1-patch.0`) pulls its own transitive deps at the older version, causing "Artifact does not match expected class id" errors when registering SchnorrAccount contracts.

The workspace paths must be `["packages/contracts/ts", "packages/api", "packages/cli"]` — NOT `["packages/*"]` since `packages/contracts/` is a Noir project (not a JS package).

## Troubleshooting

- **"Artifact does not match expected class id"**: Missing overrides in package.json. See CRITICAL section above.
- **BaseField ctor error**: Nested test-wallet deps not cleaned. Run: `rm -rf node_modules/@aztec/test-wallet/node_modules/@aztec`
- **API disk I/O error**: Delete `packages/api/orders.sqlite` and restart API.
- **postinstall fails**: Always use `--ignore-scripts` flag with `bun install`.
- **Token artifact mismatch**: Token artifacts must be compiled with the same `aztec` CLI version as the running node. Recompile from `deps/aztec-standards` if needed.
