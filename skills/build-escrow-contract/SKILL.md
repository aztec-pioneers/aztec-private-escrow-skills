---
name: build-escrow-contract
description: Compile Aztec Noir escrow contracts from source and generate TypeScript bindings. Use when the user asks to build, verify compilation, or after modifying contract source code.
allowed-tools: Bash Read Grep
---

# Build Escrow Contracts from Source

Compile the Aztec Noir smart contracts and generate TypeScript bindings.

## Prerequisites

- Aztec CLI v4.2.0 (`aztec` in PATH)
- Bun runtime installed

Commands assume the generated project is `aztec-otc-desk` under the current directory. Set `PROJECT_DIR` for a custom name, or use `PROJECT_DIR=.` when already inside the generated project.

## How the build is wired

Two artifacts: the **token** (built once on `bun install`) and the **escrow** (built whenever you change `.nr` sources).

| Artifact | Trigger | What runs | Where it lands |
|---|---|---|---|
| Token | `bun install` (root `postinstall`) | `scripts/token.ts` | `packages/contracts/ts/src/artifacts/token/{Token.json,Token.ts}` |
| Escrow | `cd packages/contracts && bun run build` | `aztec compile && aztec codegen && bun run scripts/add_artifacts.ts` | `packages/contracts/ts/src/artifacts/escrow/{OTCEscrow.json,OTCEscrow.ts}` |

You almost never need to invoke the token build manually. If you do (e.g., the submodule was just updated), run:

```bash
bun run scripts/token.ts                # also updates submodule
bun run scripts/token.ts --skip-submodules   # uses what's already on disk
```

## Steps

### 1. Build the escrow contract

```bash
cd "${PROJECT_DIR:-aztec-otc-desk}/packages/contracts"
bun run build
```

This is `aztec compile && aztec codegen target --outdir ts/src/artifacts/escrow -f && rm ts/src/artifacts/escrow/Token.ts && bun run scripts/add_artifacts.ts`. The codegen step also drops a `Token.ts` next to `OTCEscrow.ts` (because the contract imports the token); we delete it because we have a separately-managed token artifact in `ts/src/artifacts/token/`. `add_artifacts.ts` copies the JSON into place and rewrites the import path inside `OTCEscrow.ts` from `../../../../target/otc_escrow-OTCEscrow.json` → `./OTCEscrow.json`.

### 2. (Re)build the token artifact, if you changed the standard

```bash
cd "${PROJECT_DIR:-aztec-otc-desk}"
bun run scripts/token.ts
```

Or just `bun install` again — postinstall re-runs.

## Source Structure

```
packages/contracts/
  Nargo.toml             # Noir dependencies (aztec, token_contract, poseidon)
  package.json           # build/compile/codegen/copy-artifacts scripts
  scripts/
    add_artifacts.ts     # post-codegen artifact copy + import path fix
  tsconfig.json          # TypeScript NodeNext config
  src/
    main.nr              # OTCEscrow contract
    types/
      config_note.nr     # ConfigNote (escrow parameters)
      state_note.nr      # required mutable lifecycle phase/timer/cancellation state
      role_secret_note.nr # caller-owned role-secret pseudonym note
  ts/src/                # TypeScript library
    artifacts/           # Compiled artifacts + TS bindings
      index.ts           # Re-exports TokenContract + OTCEscrowContract
      escrow/
        OTCEscrow.ts     # Generated TS binding
        OTCEscrow.json   # Compiled artifact
      token/
        Token.ts         # Generated TS binding
        Token.json       # Compiled artifact
    contract.ts          # Contract interaction functions
    constants.ts         # Token metadata, EscrowConfig type
    manifest.ts          # Secret escrow instance manifest helpers
    fees.ts              # Fee payment helpers (SponsoredFPC, priority fees)
    utils.ts             # Utilities (precision, isTestnet)
```

## Contract Changes

This skill is only for compile/codegen wiring. If a build failure requires Noir, note, event, token, lifecycle, or SDK behavior changes, switch to `write-escrow-contract` and use the Aztec + Noir companion guidance there.

## Testing Scope

Generated projects should use TypeScript/Bun tests around the SDK, deployment, authwit flow, private token operations, and contract interactions. Do not add contract-package test scripts to `package.json`; the build skill only compiles contracts and generates TS bindings.
