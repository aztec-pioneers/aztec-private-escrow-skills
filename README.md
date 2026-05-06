# Aztec Private Escrow Skills

Skills for building private escrow contracts and TypeScript SDKs on Aztec Network.

## What This Is

A skills-only repo. The `skills/` directory teaches an agent how to:

1. Scaffold an Aztec private escrow contract package from scratch
2. Write Noir smart contracts for private escrow and atomic swap patterns
3. Generate TypeScript bindings and SDK helpers for deployment, registration, authwits, manifests, and private calls

There is intentionally no API, CLI, orderflow server, or runnable app scaffold right now. Those can be added back later on top of the contract + SDK layer.

## Key Skills

| Skill | What it does |
|---|---|
| `scaffold-escrow-project` | Scaffolds the contracts package, Noir sources, artifacts, and TypeScript SDK |
| `write-escrow-contract` | Guides private escrow contract design, shared private state, role gates, and authwit patterns |
| `build-escrow-contract` | Compiles Noir contracts and generates TypeScript bindings |

## Aztec Version

All skills target **Aztec v4.2.0**. All `@aztec/*` packages are pinned at the same version via the root `package.json` `workspaces.catalog`. The wallet API is `EmbeddedWallet` from `@aztec/wallets/embedded`.

## Generated Project Shape

```text
aztec-otc-desk/
├── package.json
├── deps/aztec-standards/
├── scripts/token.ts
└── packages/
    └── contracts/
        ├── Nargo.toml
        ├── src/main.nr
        ├── src/types/config_note.nr
        └── ts/src/
            ├── contract.ts
            ├── constants.ts
            ├── fees.ts
            ├── manifest.ts
            ├── utils.ts
            └── artifacts/
```

## Privacy Model

The skill now treats secret contracts and contract-owned shared private state as the foundation:

- Artifact, instance, and initialization data let a participant instantiate/register/call the contract wrapper.
- The contract secret key is required to read contract-owned private notes.
- Noir role checks still decide who may execute privileged escrow actions.
- Offchain manifests carry secret contract instance data and optional key material between participants.
- Escrow lifecycle phases are explicit private state: `CREATED`, `OPEN`, `VOID`, optional `ACCEPTED`, optional `SETTLEMENT_IN_PROGRESS`, and `FILLED`.
- Private creator auth uses a per-caller `RoleSecretNote` whose Poseidon pseudonym is stored in config; taker/filler pseudonyms are bound only when the design explicitly needs them.
- Immutable terms live in `ConfigNote`; mutable phase/timer/cancellation data always lives in `StateNote`.
- Atomic one-shot onchain settlement still uses `StateNote` so `VOID` and `FILLED` are durable terminal states.
- Sensitive usernames, handles, and addresses are committed onchain and delivered offchain with the same care as key material.
- Fresh projects should run a short design intake first; Plan mode is preferred when available.

## Tokens Are Decimal-Agnostic

The Noir contract uses `u128` amounts and does not care about decimals. Any display or denomination assumptions belong in downstream apps, not in the contract.
