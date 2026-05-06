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
├── package.json                  # root: catalog + postinstall token build
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
│   │   │       └── role_secret_note.nr
│   │   └── ts/
│   │       └── src/
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
```

### 2. Write all files

Use the templates in this skill directory:
- `templates/root-package-json.md` - root `package.json`, sub-package manifests, `tsconfig.json`, `Nargo.toml`, `scripts/token.ts`, `.gitmodules`
- `../write-escrow-contract/templates/contract-template.md` - Noir contract source
- `../write-escrow-contract/templates/config-note-template.md` - ConfigNote
- `../write-escrow-contract/templates/state-note-template.md` - required mutable StateNote for phase, cancellation, terminal-state, and timer flows
- `../write-escrow-contract/templates/role-secret-note-template.md` - caller-owned RoleSecretNote for private role authentication
- `../write-escrow-contract/templates/order-filled-event-template.md` - required private fill receipt event
- `templates/ts-library-template.md` - All TypeScript library files (uses `EmbeddedWallet`, subpath imports, `additionalScopes`)

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

### 5. Stop at SDK + contracts

Do not scaffold an API, CLI, orderflow service, or runnable demo flow for now. Expose deployment, registration, authwit, manifest, and contract interaction helpers from the TypeScript SDK so an app or test harness can be added later.

Testing for generated escrow projects should be TypeScript/Bun-based around the SDK and private interaction flow. Do not add contract-package test scripts to `package.json`; leave the generated contract package focused on compile/codegen/artifact-copy scripts.

## Key version + dependency notes (4.2.0)

1. **Workspaces**: `["packages/*"]`. Every directory under `packages/` is a JS package, including `packages/contracts/` (which owns the codegen + artifact-copy scripts).

2. **Catalog**: All `@aztec/*` packages live at the same version (`4.2.0`), pinned via root `workspaces.catalog`.

3. **EmbeddedWallet**: `import { EmbeddedWallet } from "@aztec/wallets/embedded"`. Created via `EmbeddedWallet.create(node, { pxeConfig })`. Schnorr accounts come from `wallet.createSchnorrAccount(secret, salt, signingKey?)` and expose `.address`.

4. **`additionalScopes` is mandatory** for any private function that reads another contract's notes — escrow deploy (so the deployer can read its own newly-written config note), `deposit_tokens`, and `fill_order` all need it. The TS library defaults handle this; just don't strip `additionalScopes` if you customize.

5. **Subpath imports**: import from sub-paths, e.g. `@aztec/aztec.js/addresses`, `/fields`, `/contracts`, `/wallet`, `/node`, `/abi`, `/tx`, `/fee`; `@aztec/stdlib/{aztec-address,contract,auth-witness,keys,gas}`; `@aztec/wallets/embedded`; `@aztec/pxe/config`; `@aztec/noir-contracts.js/SponsoredFPC`.

6. **TypeScript module resolution**: Use `module: "NodeNext"` and `moduleResolution: "NodeNext"`. Every handwritten relative import/export in `.ts` source must include its runtime `.js` extension, e.g. `./contract.js`, `./manifest.js`, and `./artifacts/index.js`. Do not remove explicit `.json` imports from generated Aztec bindings.

7. **Authwit pattern**: `getFunctionCall()` → `wallet.createAuthWit(from, { caller, call })` → `.with({ authWitnesses: [authwit] })`.

8. **Secret contracts**: For private-only escrow contracts, do not assume `node.getContract(address)` can recover the instance. Share an offchain escrow manifest with the artifact identity, contract instance, constructor args, salt/deployer/public keys, and key material as needed.

9. **Capability split**: Artifact plus init knowledge lets a participant instantiate/register/call the contract wrapper, but it does not let them read contract-owned private state. The contract secret key is the private-state read/nullify capability and must be handled as sensitive access material.

10. **Shared private state**: Escrow configuration and lifecycle state should usually be contract-owned private state. Anyone who should read it needs the contract secret key registered in their wallet/PXE; anyone who should act still needs to pass the Noir role/auth checks.

11. **Lifecycle phases**: Model escrow state with explicit phases in `StateNote`. Atomic one-shot onchain settlement only needs CREATED -> OPEN -> FILLED plus VOID; longer offchain settlement flows may add ACCEPTED and SETTLEMENT_IN_PROGRESS. Load `references/lifecycle-phases.md` before designing custom phase transitions.

12. **Role-secret auth**: For private creator/maker authentication, create a `RoleSecretNote` in `SinglePrivateImmutable<RoleSecretNote, Context>`, deliver it to the creator, store only its pseudonym as a `Field` in `ConfigNote`, and check that pseudonym in role-gated private entrypoints. Atomic one-shot flows do not add a filler role by default.

13. **Config/state split**: Immutable order terms live in `ConfigNote`; mutable lifecycle data always lives in `StateNote`, even for atomic one-shot flows, so cancellation and terminal fill state are durable. Sensitive plaintext terms never go into onchain note messages; store commitments and deliver plaintexts offchain.

14. **Fill receipts**: Every successful fill emits an `OrderFilled` private event to the escrow address with `MessageDelivery.ONCHAIN_CONSTRAINED`. Use a no-payload receipt by default. Include delivery commitments or event-carried scalar payloads only when the design intake explicitly confirms settlement requires those fields.

15. **No custom fill/deposit nullifiers by default**: Do not add custom order-level nullifiers for deposit/fill. Use `StateNote` terminal phase checks for cancellation/fill status; token and note primitives still create their own nullifiers.
