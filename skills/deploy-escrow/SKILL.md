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
   bun install
   ```

   `bun install` also runs the root `postinstall` (`scripts/token.ts`), which compiles the token contract from the `deps/aztec-standards` submodule and drops the artifact + bindings into `packages/contracts/ts/src/artifacts/token/`.

   If the escrow artifact isn't already built (it should be on a fresh checkout), run:
   ```bash
   cd packages/contracts && bun run build && cd ..
   ```

3. **Start the orderflow API** (background):
   ```bash
   cd packages/api && rm -f orders.sqlite && bun run start &
   ```
   Verify: `curl -s http://localhost:3000/health` should return `OK`.

4. **Deploy token contracts:**
   ```bash
   cd ../cli && bun run setup:deploy
   ```
   Deploys ETH and USDC tokens, writes addresses to `packages/cli/scripts/data/deployments.json`.

5. **Mint tokens to test accounts:**
   ```bash
   bun run setup:mint
   ```
   Mints `ETH_MINT_AMOUNT` to the seller and `USDC_MINT_AMOUNT` to the buyer (defaults: 10 ETH and 50,000 USDC, defined in `packages/cli/scripts/utils/index.ts`).

6. **Verify balances:**
   ```bash
   bun run balances
   ```

## Notes

- **Sandbox accounts**: `getOTCAccounts` (in `cli/scripts/utils/index.ts`) uses `getInitialTestAccountsData()` from `@aztec/accounts/testing` to recreate the pre-funded sandbox accounts. No `setup:accounts` step needed for sandbox.
- **Testnet**: Run `bun run setup:accounts` first — it generates persistent seller/buyer accounts and writes them to `packages/cli/scripts/data/accounts.json`. You'll also need `L2_NODE_URL` and `SPONSORED_FPC_ADDRESS` in `.env`.

## Troubleshooting

- **API disk I/O error**: Delete `packages/api/orders.sqlite` and restart API.
- **Token artifact mismatch**: Token must be compiled with the same `aztec` CLI version as the running node. Re-run `bun run scripts/token.ts` from the project root.
- **"No such file: deployments.json"**: You haven't run `bun run setup:deploy` yet, or it errored before writing.
