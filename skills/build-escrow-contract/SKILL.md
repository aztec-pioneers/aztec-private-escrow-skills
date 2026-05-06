---
name: build-escrow-contract
description: Compile Aztec Noir escrow contracts from source and generate TypeScript bindings. Use when the user asks to build, verify compilation, or after modifying contract source code.
allowed-tools: Bash Read Grep
---

# Build Escrow Contracts

Compile the generated Aztec escrow contract and refresh TypeScript bindings.

## Prerequisites

- Aztec CLI `4.2.0`
- Bun

Commands assume `PROJECT_DIR=aztec-otc-desk` unless already inside the generated project.

## Build Flow

Token artifact is built by root `postinstall` from `deps/aztec-standards`. Escrow artifact is rebuilt from `packages/contracts`.

```bash
cd "${PROJECT_DIR:-aztec-otc-desk}/packages/contracts"
bun run build
```

This runs:

```bash
aztec compile
aztec codegen target --outdir ts/src/artifacts/escrow -f
bun run scripts/add_artifacts.ts
```

The generated `add_artifacts.ts` copies `target/otc_escrow-OTCEscrow.json` into `ts/src/artifacts/escrow/OTCEscrow.json` and rewrites the generated JSON import to `./OTCEscrow.json`.

To rebuild the token artifact manually from the project root:

```bash
bun run scripts/token.ts
bun run scripts/token.ts --skip-submodules
```

## Source Map

- `packages/contracts/src/main.nr` - escrow contract.
- `packages/contracts/src/types/config_note.nr` - immutable config note.
- `packages/contracts/src/types/state_note.nr` - mutable lifecycle state.
- `packages/contracts/ts/src/artifacts/` - generated TS bindings and JSON artifacts.
- `packages/contracts/ts/src/` - SDK helpers: contract calls, manifest, fees, precision utilities.

If a build failure requires Noir, note, event, token, lifecycle, or SDK behavior changes, switch to `write-escrow-contract`.

## Tests

Generated projects use TypeScript/Bun localnet tests only. Keep Aztec.nr/TXE scripts out of `package.json`.

The contracts package test script should be:

```json
"test": "bun test --preload ./ts/test/setup.ts --timeout 300000 ./ts/test/escrow.test.ts"
```

The preload shim provides `expect.addEqualityTesters` for Aztec JS packages, and the explicit test file prevents Bun from discovering `deps/aztec-standards` tests. Localnet tests take minutes; run targeted `bun test ... -t "<name>"` while iterating, then one full `bun run test`.
