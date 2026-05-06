---
name: scaffold-escrow-project
description: "Scaffold generalized Aztec private escrow projects from scratch: secret contracts, contract-owned shared private state, Noir contracts, TypeScript SDK, and Bun localnet tests. Use for private escrow systems, atomic swaps, or escrow protocol prototypes."
allowed-tools: Bash Read Write Edit Glob Grep Agent
---

# Scaffold Aztec Private Escrow Project

Create a contracts + TypeScript SDK project for Aztec private escrows. The default preset is an OTC atomic onchain settlement, but adapt it for other escrow shapes while preserving secret deployment, contract-owned shared private state, explicit roles, and phase-driven lifecycle state.

## Prerequisites

- Aztec CLI `4.2.0`
- Bun
- Localnet on `http://localhost:8080` for tests: `aztec start --local-network`

## Load References As Needed

- `references/design-intake.md` - phase/timing/config-state questions for fresh or ambiguous designs.
- `references/private-state-and-handoff.md` - contract secret key, shared private notes, role-secret boundary.
- `references/secret-contracts.md` - `deployWithPublicKeys`, secret key registration, participant handoff.
- `references/lifecycle-phases.md` - `CREATED`, `OPEN`, `VOID`, `ACCEPTED`, `SETTLEMENT_IN_PROGRESS`, `FILLED`.
- `references/manifest-schema.md` - minimal escrow manifest and encrypted transport.
- `references/testing-strategy.md` - Bun/localnet test layout and required cases.
- `references/escrow-design-space.md` - choosing a non-OTC escrow shape.

For Noir/Aztec behavior, use the Aztec developer and Noir developer companion skills when available.

## Intake Rule

Before scaffolding a fresh project or changing lifecycle/config/state shape, load `references/design-intake.md`. A project is fresh when the target directory is missing, or it lacks `packages/contracts/Nargo.toml` and `packages/contracts/src/main.nr`.

For a fresh project, say once: `This skill is best used in Plan mode first.` If the user declines Plan mode, continue with explicit conservative assumptions.

## Scaffold Workflow

1. Create the target directory. If `.git` is missing, run `git init` before dependency install because `deps/aztec-standards` is a submodule.
2. Copy `templates/project/` into the target, including dotfiles.
3. Register the submodule with git, not by writing `.gitmodules` alone:

```bash
git submodule add --force -b dev https://github.com/defi-wonderland/aztec-standards.git deps/aztec-standards
```

4. Adapt package names and imports. Use a scoped contracts package such as `@aztec-otc-desk/contracts`; update both `packages/contracts/package.json` and `packages/contracts/tsconfig.json` paths.
5. Adapt Noir files in `templates/project/packages/contracts/src/` and TS SDK files in `templates/project/packages/contracts/ts/src/` for the requested escrow.
6. Run `bun install`; the root `postinstall` builds/copies the aztec-standards token artifact.
7. Build from `packages/contracts` with `bun run build`.

Do not scaffold an API, CLI, orderflow service, frontend, or runnable demo app for now.

## Template Map

- `templates/project/` - canonical scaffold files, including package files, scripts, Noir source, TS SDK, and Bun setup shim.
- `../write-escrow-contract/templates/contract-template.md` - how to adapt the real Noir contract files.
- `../write-escrow-contract/templates/config-note-template.md` - immutable config rules.
- `../write-escrow-contract/templates/state-note-template.md` - required mutable lifecycle state rules.
- `../write-escrow-contract/templates/order-filled-event-template.md` - required fill receipt event.
- `../write-escrow-contract/references/role-restriction-patterns.md` - caller-sampled role secrets and `RoleAdded` recovery events.
- `../write-escrow-contract/references/token-primitive-adapters.md` - selected-token private transfer/commitment mapping.

## Testing Scope

Generated projects use TypeScript/Bun tests only. Keep `package.json` free of Aztec.nr/TXE scripts.

The contracts package test script must stay targeted:

```json
"test": "bun test --preload ./ts/test/setup.ts --timeout 300000 ./ts/test/escrow.test.ts"
```

Do not let Bun recursively discover `deps/aztec-standards` tests. Do not add `escrow.test.ts` from this skill until the user provides the current generated example.

## Non-Negotiables

1. Target Aztec `4.2.0`, Bun, `EmbeddedWallet`, workspace catalog pinning, package imports, and NodeNext `.js` suffixes.
2. Generate contracts, TypeScript SDK, and TypeScript/Bun tests only.
3. Use secret contract handoff through `EscrowManifest`: address, serialized instance, required contract secret key, creation block, optional tx hash.
4. Use contract-owned `ConfigNote`/`StateNote` with storage owner `self.address`; do not add manual note `owner` or randomness fields.
5. Use caller-sampled role secrets and caller-bound pseudonyms; emit `RoleAdded { secret }` to the caller only.
6. Use `StateNote` for all phase/cancel/fill state and avoid custom fill/deposit nullifiers by default.
7. Emit `OrderFilled` on every fill, no payload unless intake explicitly confirms event-carried data.
