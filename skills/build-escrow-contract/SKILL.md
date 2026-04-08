---
name: build-escrow-contract
description: Compile Aztec Noir escrow contracts from source and generate TypeScript bindings. Use after modifying contract source code.
disable-model-invocation: true
allowed-tools: Bash Read Grep
---

# Build Escrow Contracts from Source

Compile the Aztec Noir smart contracts and generate TypeScript bindings.

## Prerequisites

- Aztec CLI v4.0.0-devnet.2-patch.3 (`aztec` in PATH)
- Bun runtime installed

## Steps

### 1. Compile Token Contract (dependency)

The token contract comes from the `aztec-standards` git submodule. Its artifact MUST be compiled with the same `aztec` CLI version as the running node — otherwise you get "Artifact does not match expected class id" errors.

```bash
cd ${CLAUDE_SKILL_DIR}/../../aztec-otc-desk
```

If submodules haven't been initialized:
```bash
git clone https://github.com/defi-wonderland/aztec-standards.git deps/aztec-standards
cd deps/aztec-standards && git checkout v4.0.0-devnet.2-patch.1
```

Compile and generate bindings:
```bash
cd deps/aztec-standards
aztec compile --package token_contract
aztec codegen ./target/token_contract-Token.json -o ./target -f
```

Copy to project and fix imports:
```bash
cp ./target/token_contract-Token.json ../../packages/contracts/ts/src/artifacts/token/Token.json
cp ./target/Token.ts ../../packages/contracts/ts/src/artifacts/token/Token.ts
```

IMPORTANT: Fix the import path in Token.ts:
```bash
sed -i '' 's|./token_contract-Token.json|./Token.json|g' ../../packages/contracts/ts/src/artifacts/token/Token.ts
```

If submodules are already initialized (skip clone):
```bash
cd deps/aztec-standards
rm -rf target
aztec compile --package token_contract
aztec codegen ./target/token_contract-Token.json -o ./target -f
cp ./target/token_contract-Token.json ../../packages/contracts/ts/src/artifacts/token/Token.json
cp ./target/Token.ts ../../packages/contracts/ts/src/artifacts/token/Token.ts
sed -i '' 's|./token_contract-Token.json|./Token.json|g' ../../packages/contracts/ts/src/artifacts/token/Token.ts
```

### 2. Compile OTC Escrow Contract

```bash
cd packages/contracts
aztec compile
```

### 3. Generate TypeScript Bindings

```bash
aztec codegen target/otc_escrow-OTCEscrow.json --outdir artifacts -f
```

### 4. Copy and Fix Artifacts

```bash
cp artifacts/OTCEscrow.ts ts/src/artifacts/escrow/OTCEscrow.ts
cp target/otc_escrow-OTCEscrow.json ts/src/artifacts/escrow/OTCEscrow.json
sed -i '' 's|./otc_escrow-OTCEscrow.json|./OTCEscrow.json|g' ts/src/artifacts/escrow/OTCEscrow.ts
```

## Source Structure

```
packages/contracts/
  src/
    main.nr              # OTCEscrow contract
    types/
      config_note.nr     # ConfigNote (escrow parameters)
    test/
      escrow.nr          # TXE test suite
      utils/             # Test helpers
  Nargo.toml             # Dependencies
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
    fees.ts              # Fee payment helpers
    utils.ts             # Utilities (wad, isTestnet)
```

## Noir API Reference (v4.0.0-devnet.2-patch.3)

```noir
use aztec::protocol::address::AztecAddress;
use aztec::protocol::traits::{Serialize, Deserialize, Packable};
use aztec::oracle::random::random;
use aztec::state_vars::SinglePrivateImmutable;
use aztec::messages::message_delivery::MessageDelivery;
use aztec::macros::{aztec, notes::note, functions::{initializer, external}, storage::storage};
use aztec::test::helpers::{test_environment::TestEnvironment, authwit, txe_oracles};
```

Key changes from v3:
- `protocol_types` -> `protocol`
- `self.msg_sender()` returns `AztecAddress` directly (not `Option`)
- `MessageDelivery.ONCHAIN_CONSTRAINED` (was `CONSTRAINED_ONCHAIN`)
- `unsafe` blocks in unconstrained functions are unnecessary
- `unsafe` in constrained code needs `// Safety:` comments

## Running Noir Tests (TXE)

```bash
cd packages/contracts && aztec test
```
