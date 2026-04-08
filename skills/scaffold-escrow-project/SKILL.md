---
name: scaffold-escrow-project
description: Scaffold a complete Aztec private escrow project from scratch - Noir contracts, TypeScript library, orderflow API, CLI scripts. One-shot build with correct deps.
allowed-tools: Bash Read Write Edit Glob Grep Agent
---

# Scaffold Aztec Private Escrow Project

Create a complete private OTC escrow system on Aztec from scratch. This skill produces a working monorepo with Noir contracts, TypeScript interaction library, orderflow API, and CLI scripts.

## Prerequisites

- Aztec CLI v4.0.0-devnet.2-patch.3 (`aztec` in PATH)
- Bun runtime installed
- Aztec localnet running on port 8080 (`aztec start --local-network`)

## What To Build

Create a directory called `aztec-otc-desk/` (or whatever name the user requests) with the structure described in `project-structure.md`.

## Step-by-step

### 1. Create the directory structure

```
aztec-otc-desk/
├── package.json
├── .gitignore
├── README.md
├── deps/
│   └── aztec-standards/          # git submodule (or symlink)
├── packages/
│   ├── contracts/
│   │   ├── Nargo.toml
│   │   ├── src/
│   │   │   ├── main.nr
│   │   │   └── types/
│   │   │       └── config_note.nr
│   │   └── ts/
│   │       ├── package.json
│   │       └── src/
│   │           ├── index.ts
│   │           ├── contract.ts
│   │           ├── constants.ts
│   │           ├── utils.ts
│   │           ├── fees.ts
│   │           └── artifacts/
│   │               ├── index.ts
│   │               ├── escrow/
│   │               │   ├── OTCEscrow.ts
│   │               │   └── OTCEscrow.json
│   │               └── token/
│   │                   ├── Token.ts
│   │                   └── Token.json
│   ├── api/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── db/
│   │       ├── handlers/
│   │       ├── types/
│   │       └── utils/
│   └── cli/
│       ├── package.json
│       ├── .env
│       └── scripts/
│           ├── deploy.ts
│           ├── mint.ts
│           ├── create_order.ts
│           ├── buy_order.ts
│           ├── print_balances.ts
│           ├── data/
│           └── utils/
│               ├── index.ts
│               ├── api.ts
│               └── types.ts
```

### 2. Write all files

Use the templates in this skill directory:
- `root-package-json.md` — root package.json (CRITICAL: correct workspaces + overrides)
- `contract-template.md` — Noir contract source (from write-escrow-contract skill)
- `config-note-template.md` — ConfigNote (from write-escrow-contract skill)
- `ts-library-template.md` — All TypeScript library files
- `api-template.md` — Orderflow API files
- `cli-template.md` — CLI scripts and utils

### 3. Get token artifacts

The Token contract artifact MUST match the running aztec version. Two options:

**Option A: Compile from aztec-standards (recommended)**
```bash
# Clone or symlink aztec-standards at deps/aztec-standards
git clone https://github.com/defi-wonderland/aztec-standards.git deps/aztec-standards
cd deps/aztec-standards && git checkout v4.0.0-devnet.2-patch.1

# Compile
aztec compile --package token_contract

# Generate TS bindings
aztec codegen ./target/token_contract-Token.json -o ./target -f

# Copy to project
cp ./target/token_contract-Token.json ../../packages/contracts/ts/src/artifacts/token/Token.json
cp ./target/Token.ts ../../packages/contracts/ts/src/artifacts/token/Token.ts

# Fix import path in Token.ts
sed -i '' 's|./token_contract-Token.json|./Token.json|g' ../../packages/contracts/ts/src/artifacts/token/Token.ts
```

**Option B: Copy from existing project**
If a compiled artifact already exists at another path, copy Token.ts and Token.json directly.

### 4. Get escrow artifacts

Compile the OTCEscrow contract:
```bash
cd packages/contracts
aztec compile
aztec codegen target/otc_escrow-OTCEscrow.json --outdir artifacts -f
cp artifacts/OTCEscrow.ts ts/src/artifacts/escrow/OTCEscrow.ts

# Fix import path
sed -i '' 's|./otc_escrow-OTCEscrow.json|./OTCEscrow.json|g' ts/src/artifacts/escrow/OTCEscrow.ts
cp target/otc_escrow-OTCEscrow.json ts/src/artifacts/escrow/OTCEscrow.json
```

Or copy from an existing compiled project if available.

### 5. Install dependencies

```bash
cd aztec-otc-desk
bun install --ignore-scripts
rm -rf node_modules/@aztec/test-wallet/node_modules/@aztec
```

### 6. Run the flow

```bash
# Start API
cd packages/api && rm -f orders.sqlite && bun run start &
sleep 2

# Deploy, mint, trade
cd ../cli
bun run setup:deploy
bun run setup:mint
bun run balances          # Seller: 10 ETH, Buyer: 50k USDC
bun run order:create
bun run order:fill
bun run balances          # Seller: 9 ETH, Buyer: 1 ETH + 45k USDC
```

## CRITICAL Dependency Notes

These are the hard-won lessons from debugging — do NOT skip:

1. **Workspace paths**: Use `["packages/contracts/ts", "packages/api", "packages/cli"]` NOT `["packages/*"]`. The Noir project at `packages/contracts/` is NOT a JS package.

2. **@aztec/test-wallet version**: Only `4.0.0-devnet.1-patch.0` exists on npm. All other `@aztec/*` packages are `4.0.0-devnet.2-patch.3`.

3. **overrides are MANDATORY**: Without overrides, test-wallet pulls its own transitive deps at `4.0.0-devnet.1-patch.0` which causes class ID mismatches (SchnorrAccount artifact won't match the node). You MUST include:
   ```json
   "overrides": {
     "@aztec/foundation": "4.0.0-devnet.2-patch.3",
     "@aztec/wallet-sdk": "4.0.0-devnet.2-patch.3",
     "@aztec/pxe": "4.0.0-devnet.2-patch.3",
     "@aztec/accounts": "4.0.0-devnet.2-patch.3",
     "@aztec/stdlib": "4.0.0-devnet.2-patch.3",
     "@aztec/aztec.js": "4.0.0-devnet.2-patch.3"
   }
   ```

4. **Nested dep cleanup**: Always run `rm -rf node_modules/@aztec/test-wallet/node_modules/@aztec` after install.

5. **Token artifact must match node version**: Compiling from aztec-standards with the matching `aztec` CLI version ensures the contract class IDs match. Copying artifacts compiled with a different version will fail with "Artifact does not match expected class id".

6. **Install flag**: Always use `bun install --ignore-scripts` to avoid postinstall failures.
