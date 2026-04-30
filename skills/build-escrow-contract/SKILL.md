---
name: build-escrow-contract
description: Compile Aztec Noir escrow contracts from source and generate TypeScript bindings. Use after modifying contract source code.
disable-model-invocation: true
allowed-tools: Bash Read Grep
---

# Build Escrow Contracts from Source

Compile the Aztec Noir smart contracts and generate TypeScript bindings.

## Prerequisites

- Aztec CLI v4.2.0-aztecnr-rc.2 (`aztec` in PATH)
- Bun runtime installed

## How the build is wired

Two artifacts: the **token** (built once on `bun install`) and the **escrow** (built whenever you change `.nr` sources).

| Artifact | Trigger | What runs | Where it lands |
|---|---|---|---|
| Token | `bun install` (root `postinstall`) | `scripts/token.ts` | `packages/contracts/ts/src/artifacts/token/{Token.json,Token.ts}` (and `packages/contracts/target/otc_escrow-Token.json` for TXE) |
| Escrow | `cd packages/contracts && bun run build` | `aztec compile && aztec codegen && bun run scripts/add_artifacts.ts` | `packages/contracts/ts/src/artifacts/escrow/{OTCEscrow.json,OTCEscrow.ts}` |

You almost never need to invoke the token build manually. If you do (e.g., the submodule was just updated), run:

```bash
bun run scripts/token.ts                # also updates submodule
bun run scripts/token.ts --skip-submodules   # uses what's already on disk
```

## Steps

### 1. Build the escrow contract

```bash
cd ${CLAUDE_SKILL_DIR}/../../aztec-otc-desk/packages/contracts
bun run build
```

This is `aztec compile && aztec codegen target --outdir ts/src/artifacts/escrow -f && rm ts/src/artifacts/escrow/Token.ts && bun run scripts/add_artifacts.ts`. The codegen step also drops a `Token.ts` next to `OTCEscrow.ts` (because the contract imports the token); we delete it because we have a separately-managed token artifact in `ts/src/artifacts/token/`. `add_artifacts.ts` copies the JSON into place and rewrites the import path inside `OTCEscrow.ts` from `../../../../target/otc_escrow-OTCEscrow.json` → `./OTCEscrow.json`.

### 2. (Re)build the token artifact, if you changed the standard

```bash
cd ${CLAUDE_SKILL_DIR}/../../aztec-otc-desk
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
  src/
    main.nr              # OTCEscrow contract
    types/
      config_note.nr     # ConfigNote (escrow parameters)
    test/
      escrow.nr          # TXE test suite
      utils/             # Test helpers
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
    fees.ts              # Fee payment helpers (SponsoredFPC, priority fees)
    utils.ts             # Utilities (wad, isTestnet)
```

## Noir API Reference

```noir
use aztec::protocol::address::AztecAddress;
use aztec::protocol::traits::{Serialize, Deserialize, Packable};
use aztec::oracle::random::random;
use aztec::state_vars::SinglePrivateImmutable;
use aztec::messages::message_delivery::MessageDelivery;
use aztec::macros::{aztec, notes::note, functions::{initializer, external}, storage::storage};
use aztec::test::helpers::{test_environment::TestEnvironment, authwit, txe_oracles};
```

- `self.msg_sender()` returns `AztecAddress` directly
- `MessageDelivery.ONCHAIN_CONSTRAINED` for guaranteed note delivery
- `unsafe` blocks in unconstrained functions are unnecessary
- `unsafe` in constrained code needs `// Safety:` comments

## Running Noir Tests (TXE)

```bash
cd packages/contracts && aztec test
```
