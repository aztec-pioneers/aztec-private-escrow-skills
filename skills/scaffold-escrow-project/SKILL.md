---
name: scaffold-escrow-project
description: "Scaffold generalized Aztec private escrow projects from scratch: secret contracts, contract-owned shared private state, Noir contracts, and TypeScript SDK. Use for private escrow systems, atomic swaps, or escrow protocol prototypes."
allowed-tools: Bash Read Write Edit Glob Grep Agent
---

# Scaffold Aztec Private Escrow Project

Create a private escrow contract package on Aztec from scratch. The default preset is the OTC atomic swap, but the skill should generalize to other private escrow protocols that use secret contracts, contract-owned shared private state, explicit participant roles, and a TypeScript SDK.

## Prerequisites

- Aztec CLI v4.2.0 (`aztec` in PATH)
- Bun runtime installed
- Aztec localnet running on port 8080 (`aztec start --local-network`)

## What To Build

Create a directory called `aztec-otc-desk/` (or whatever name the user requests) with the structure described below. If the user asks for a non-OTC escrow, adapt the Noir contract and TypeScript SDK while preserving the private deployment and shared-state model.

## Reference Loading

Load these only when they are relevant:

- `references/privacy-model.md` - privacy capability boundaries and defaults.
- `references/secret-contracts.md` - private/secret deployment, contract instance reconstruction, and key registration.
- `references/shared-private-state.md` - contract-owned private storage that all escrow participants may read with the contract secret key.
- `references/escrow-design-space.md` - choosing a generalized escrow shape instead of the OTC preset.
- `references/design-intake.md` - pre-scaffold questions for phase selection, timing windows, and config/state fields.
- `references/lifecycle-phases.md` - CREATED/OPEN/VOID/ACCEPTED/SETTLEMENT_IN_PROGRESS/FILLED lifecycle design.
- `references/manifest-schema.md` - offchain escrow instance manifest fields for participant handoff.
- `references/testing-strategy.md` - monolithic TypeScript/Bun localnet test layout, fixtures, and failure cases.

## Companion Skills

When writing or substantially changing Noir or Aztec SDK code, use the Aztec developer skill and the Noir developer skill together when they are available. In Codex this may appear as `aztec:aztec-developer` plus `noir-developer`; in Claude-style environments it may appear as `aztec-developer` plus `noir-developer`. Use Aztec guidance for contracts, notes, private state, wallet/PXE, deployment, and TypeScript SDK semantics; use Noir guidance for `.nr` project structure, syntax, and compilation.

## Fresh Project Intake

Before scaffolding a new project or redesigning the lifecycle/config/state model, load `references/design-intake.md` and run the short intake there. A project is "new" if the target directory does not exist or lacks `packages/contracts/Nargo.toml` and `packages/contracts/src/main.nr`.

If it is new, tell the user once: "This skill is best used in Plan mode first." If the user says they do not want Plan mode, continue, but state that they are asking the skill to make design assumptions that may need correction later.

Skip this warning when the project is already initialized, when the user is continuing an in-progress design after compaction or a new Codex session, or when the requested change is narrow and does not alter the lifecycle/config/state shape.

## Step-by-step

### 1. Create the directory structure

If the target directory is not already git-initialized, run `git init` in the project root before installing dependencies. Check for an existing `.git` first and do not reinitialize an existing repository. The `deps/aztec-standards` dependency is a git submodule, so the generated project must be a git repository before `bun install` runs.

Before `bun install`, ensure the submodule is actually registered and checked out:

```bash
git init # only if .git is missing
git submodule add --force -b dev https://github.com/defi-wonderland/aztec-standards.git deps/aztec-standards
```

Do not create `deps/aztec-standards` as a normal directory. A `.gitmodules` file by itself is only metadata; it does not create or populate the submodule. Let `git submodule add` or the postinstall script create/register it.

```
aztec-otc-desk/
├── package.json                  # root: catalog + postinstall token build + localnet script
├── .gitignore
├── .gitmodules                   # deps/aztec-standards submodule
├── README.md
├── deps/
│   └── aztec-standards/          # git submodule (created by git, token contract source)
├── scripts/
│   └── token.ts                  # postinstall: compile + copy token artifact
├── packages/
│   ├── contracts/
│   │   ├── package.json          # JS package (codegen + add-artifacts scripts)
│   │   ├── tsconfig.json         # TypeScript NodeNext config
│   │   ├── Nargo.toml
│   │   ├── scripts/
│   │   │   └── add_artifacts.ts  # post-codegen artifact copy + import fix
│   │   ├── src/
│   │   │   ├── main.nr
│   │   │   └── types/
│   │   │       ├── config_note.nr
│   │   │       ├── state_note.nr
│   │   └── ts/
│   │       ├── src/
│   │           ├── index.ts
│   │           ├── contract.ts
│   │           ├── constants.ts
│   │           ├── manifest.ts
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
│   │       └── test/
│   │           ├── setup.ts      # Bun preload shim for Aztec/Jest expect hook
│   │           └── escrow.test.ts # monolithic Bun localnet test harness
```

### 2. Write all files

Use the templates in this skill directory:
- `templates/project/` - real scaffold files. Copy this tree into the generated project first, including dotfiles such as `.gitignore` and `.gitmodules`, then adapt package names and protocol-specific code. Use a scoped contracts package name like `@aztec-otc-desk/contracts`; for custom projects, derive the scope from the project name and update `packages/contracts/package.json` plus `packages/contracts/tsconfig.json` paths together.
- `templates/root-package-json.md` - index for root `package.json`, sub-package manifests, `tsconfig.json`, `Nargo.toml`, `scripts/token.ts`, `.gitmodules`
- `../write-escrow-contract/templates/contract-template.md` - Noir contract source
- `../write-escrow-contract/templates/config-note-template.md` - ConfigNote
- `../write-escrow-contract/templates/state-note-template.md` - required mutable StateNote for phase, cancellation, terminal-state, and timer flows
- `../write-escrow-contract/templates/role-secret-template.md` - caller-sampled role secrets, RoleAdded recovery events, and private role authentication
- `../write-escrow-contract/templates/order-filled-event-template.md` - required private fill receipt event
- `templates/ts-library-template.md` - index for TypeScript SDK files (uses `EmbeddedWallet`, subpath imports, `additionalScopes`)

### 3. Install dependencies (also builds the token artifact)

```bash
cd aztec-otc-desk
bun install
```

The root `postinstall` runs `scripts/token.ts`, which compiles the token contract from the `deps/aztec-standards` submodule (pinned to `dev` via `config.aztecStandardsVersion`) and writes:
- `packages/contracts/ts/src/artifacts/token/Token.json` and `Token.ts` (TS bindings)

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

To run localnet for TypeScript tests:

```bash
bun run localnet
```

### 5. Stop at SDK + contracts

Do not scaffold an API, CLI, orderflow service, or runnable demo flow for now. Expose deployment, registration, authwit, manifest, and contract interaction helpers from the TypeScript SDK so an app or test harness can be added later.

Testing for generated escrow projects should be TypeScript/Bun-based around the SDK and private interaction flow. Add a single monolithic `packages/contracts/ts/test/escrow.test.ts` by default plus `packages/contracts/ts/test/setup.ts` for the Bun preload shim. Keep `package.json` free of Aztec.nr/TXE test scripts. The contracts package `test` script must target only `./ts/test/escrow.test.ts` with `--preload ./ts/test/setup.ts`; do not let Bun recursively discover `deps/aztec-standards` tests and do not make a script that recursively invokes itself.

## Non-Negotiables

Keep the full details in the referenced files and templates. For scaffold runs, preserve these rules:

1. **Version + TS shape**: Target Aztec `4.2.0`, Bun, `EmbeddedWallet`, workspace catalog pinning, package imports such as `@aztec-otc-desk/contracts`, subpath `@aztec/*` imports, and NodeNext `.js` suffixes for handwritten relative TS imports.
2. **Secret contract handoff**: Private-only escrow contracts need an offchain manifest class. Include only address, serialized `ContractInstanceWithAddress`, contract secret key, creation block, and tx hash; encrypt the whole manifest for transport when sending it to another participant.
3. **Shared private state**: `ConfigNote` and `StateNote` are contract-owned private notes. Pass `additionalScopes` on deploy/deposit/fill calls that read or nullify escrow-owned notes.
4. **Roles + lifecycle**: Use caller-sampled role secrets and caller-bound pseudonyms for private role checks, `StateNote` for all phase/cancel/fill state, and no custom fill/deposit nullifiers by default.
5. **Output scope**: Generate contracts plus the TypeScript SDK and TypeScript/Bun tests only. Do not scaffold API, CLI, demo app, or Aztec.nr/TXE test scripts.
