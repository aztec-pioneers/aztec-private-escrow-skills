---
name: scaffold-escrow-project
description: Scaffold a complete Aztec private escrow project from scratch - Noir contracts, TypeScript library, orderflow API, CLI scripts. One-shot build with correct deps.
allowed-tools: Bash Read Write Edit Glob Grep Agent
---

# Scaffold Aztec Private Escrow Project

Create a complete private OTC escrow system on Aztec from scratch. This skill produces a working monorepo with Noir contracts, TypeScript interaction library, orderflow API, and CLI scripts.

## Prerequisites

- Aztec CLI v4.2.0-aztecnr-rc.2 (`aztec` in PATH)
- Bun runtime installed
- Aztec localnet running on port 8080 (`aztec start --local-network`)

## What To Build

Create a directory called `aztec-otc-desk/` (or whatever name the user requests) with the structure described below.

## Step-by-step

### 1. Create the directory structure

```
aztec-otc-desk/
├── package.json                  # root: catalog + postinstall token build
├── .gitignore
├── .gitmodules                   # deps/aztec-standards submodule
├── README.md
├── deps/
│   └── aztec-standards/          # git submodule (token contract source)
├── scripts/
│   └── token.ts                  # postinstall: compile + copy token artifact
├── packages/
│   ├── contracts/
│   │   ├── package.json          # JS package (codegen + add-artifacts scripts)
│   │   ├── Nargo.toml
│   │   ├── scripts/
│   │   │   └── add_artifacts.ts  # post-codegen artifact copy + import fix
│   │   ├── src/
│   │   │   ├── main.nr
│   │   │   └── types/
│   │   │       └── config_note.nr
│   │   └── ts/
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
│           ├── setup_accounts.ts
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
- `root-package-json.md` — root `package.json`, sub-package manifests, `Nargo.toml`, `scripts/token.ts`, `.gitmodules`
- `../write-escrow-contract/contract-template.md` — Noir contract source
- `../write-escrow-contract/config-note-template.md` — ConfigNote
- `ts-library-template.md` — All TypeScript library files (uses `EmbeddedWallet`, subpath imports, `additionalScopes`)
- `api-template.md` — Orderflow API (plain Bun + SQLite, no Aztec deps)
- `cli-template.md` — CLI scripts and utils

### 3. Install dependencies (also builds the token artifact)

```bash
cd aztec-otc-desk
bun install
```

The root `postinstall` runs `scripts/token.ts`, which compiles the token contract from the `deps/aztec-standards` submodule (pinned to `dev` via `config.aztecStandardsVersion`) and writes:
- `packages/contracts/ts/src/artifacts/token/Token.json` and `Token.ts` (TS bindings)
- `packages/contracts/target/otc_escrow-Token.json` (for TXE tests if used)

To recompile the token without re-running the submodule update:
```bash
bun run scripts/token.ts --skip-submodules
```

### 4. Build the escrow contract

```bash
cd packages/contracts
bun run build
```

Runs `aztec compile && aztec codegen && bun run scripts/add_artifacts.ts` — the codegen drops bindings into `ts/src/artifacts/escrow/` and `add_artifacts.ts` rewrites the JSON import path.

### 5. Run the flow

```bash
# Start API
cd packages/api && rm -f orders.sqlite && bun run start &
sleep 2

# Deploy, mint, trade
cd ../cli
bun run setup:deploy
bun run setup:mint
bun run balances
bun run order:create
bun run order:fill
bun run balances
```

(Sandbox uses pre-funded test accounts from `getInitialTestAccountsData()`. For testnet, run `bun run setup:accounts` first to mint persistent seller/buyer accounts to `data/accounts.json`.)

## Key version + dependency notes (4.2.0-aztecnr-rc.2)

1. **Workspaces**: `["packages/*"]`. Every directory under `packages/` is a JS package, including `packages/contracts/` (which owns the codegen + artifact-copy scripts).

2. **Catalog**: All `@aztec/*` packages live at the same version (`4.2.0-aztecnr-rc.2`), pinned via root `workspaces.catalog`.

3. **EmbeddedWallet**: `import { EmbeddedWallet } from "@aztec/wallets/embedded"`. Created via `EmbeddedWallet.create(node, { pxeConfig })`. Schnorr accounts come from `wallet.createSchnorrAccount(secret, salt, signingKey?)` and expose `.address`.

4. **`additionalScopes` is mandatory** for any private function that reads another contract's notes — escrow deploy (so the deployer can read its own newly-written config note), `deposit_tokens`, and `fill_order` all need it. The TS library defaults handle this; just don't strip `additionalScopes` if you customize.

5. **Subpath imports**: import from sub-paths, e.g. `@aztec/aztec.js/addresses`, `/fields`, `/contracts`, `/wallet`, `/node`, `/abi`, `/tx`, `/fee`; `@aztec/stdlib/{aztec-address,contract,auth-witness,keys,gas}`; `@aztec/wallets/embedded`; `@aztec/pxe/config`; `@aztec/noir-contracts.js/SponsoredFPC`.

6. **Authwit pattern**: `getFunctionCall()` → `wallet.createAuthWit(from, { caller, call })` → `.with({ authWitnesses: [authwit] })`.
