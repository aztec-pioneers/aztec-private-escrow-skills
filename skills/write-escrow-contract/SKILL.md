---
name: write-escrow-contract
description: Write or customize Aztec private escrow contracts in Noir with TypeScript integration. Use for secret contracts, contract-owned shared private state, ConfigNote/StateNote design, authwit patterns, role-gated private actions, events, or atomic settlement logic.
allowed-tools: Read Write Edit Bash Grep Glob
---

# Write a Custom Private Escrow Contract

Create or adapt Aztec private escrow contracts. Default to the scaffolded OTC atomic onchain settlement, then modify storage, roles, lifecycle, token primitives, and SDK helpers for the requested protocol.

## Load References As Needed

- `references/noir-private-state-patterns.md` - contract-owned private state and mutable lifecycle notes.
- `references/role-restriction-patterns.md` - caller-sampled role secrets, `RoleAdded`, and pseudonym checks.
- `references/token-primitive-adapters.md` - selected-token private transfer and partial-note primitives.
- `references/sensitive-term-commitments.md` - commit-onchain/deliver-offchain sensitive terms.
- `../scaffold-escrow-project/references/design-intake.md` - phase/timing/config-state confirmation.
- `../scaffold-escrow-project/references/lifecycle-phases.md` - phase graph and transition invariants.
- `../scaffold-escrow-project/references/secret-contracts.md` - deployment and registration model.
- `../scaffold-escrow-project/references/manifest-schema.md` - participant handoff fields.

Use Aztec and Noir companion guidance together before writing or reviewing contract behavior.

## Intake Rule

Before writing a new escrow contract or changing lifecycle/config/state structure, load `../scaffold-escrow-project/references/design-intake.md`. Confirm phase set, timing windows, ambiguous config/state fields, and `OrderFilled` payload. If the user declines structured planning, continue with explicit conservative assumptions.

## Canonical Files

The real scaffold files live under `../scaffold-escrow-project/templates/project/packages/contracts/src/`:

- `main.nr` - default OTC escrow contract.
- `types/config_note.nr` - immutable terms.
- `types/state_note.nr` - mutable lifecycle phase.

Template notes:

- `templates/contract-template.md` - adaptation guide for the real contract file.
- `templates/config-note-template.md` - config rules.
- `templates/state-note-template.md` - state rules.
- `templates/order-filled-event-template.md` - fill receipt event rules.

## Non-Negotiables

1. Target Aztec `4.2.0` and poseidon `v0.3.0`.
2. Use `SinglePrivateImmutable` for immutable config.
3. Use `u128` for token amounts.
4. `ConfigNote` is immutable terms; `StateNote` is all phase/cancel/fill/timer/runtime role state.
5. Do not add manual note `owner` fields or note randomness to `ConfigNote`/`StateNote`.
6. Use caller-sampled role secrets: hash `[caller.to_field(), role_secret]`, store only the pseudonym, emit `RoleAdded { secret }` to the caller.
7. Atomic one-shot fills are open to any filler satisfying settlement terms; bind taker/filler only for `ACCEPTED`, delayed settlement, allowlists, or explicit role-restricted phases.
8. Do not add custom order-level deposit/fill nullifiers by default. Use `StateNote` terminal phases.
9. Emit `OrderFilled` to `self.address` with `ONCHAIN_CONSTRAINED` on every successful fill; no payload unless intake explicitly confirms event-carried data.
10. Use `ONCHAIN_CONSTRAINED` for contract-owned notes and escrow-addressed fill events; use `ONCHAIN_UNCONSTRAINED` for `RoleAdded` sent to the caller.
11. Token calls are adapter-specific. Inspect the selected binding/source before changing concrete private deposit/refund/payout/commitment calls.
12. For atomic onchain settlement, complete maker receive-side partial notes from escrow-owned funds, with escrow as filler.
13. Use anchor block timestamp for deadline checks.
14. Generated tests use `EmbeddedWallet.create(node, { ephemeral: true, pxeConfig: { proverEnabled } })`; default `proverEnabled = false`.
