# Escrow Design Space

Use the OTC atomic swap as the default preset, not the only shape. If the user asks for a generalized escrow, choose the smallest protocol that matches their lifecycle.

For fresh projects or lifecycle changes, load `design-intake.md` and confirm phases, timing windows, and ambiguous config/state fields before writing contract files.

## Common Shapes

| Shape | Use when | Typical state |
|---|---|---|
| OTC atomic swap | Two parties swap fixed assets atomically | Terms, maker deposit asset, partial-note commitment, `OrderFilled` event |
| RFQ or intent escrow | A maker publishes private terms and takers can satisfy them | Terms, optional acceptor pseudonym after `ACCEPTED`, expiry, `OrderFilled` event |
| Milestone escrow | Funds unlock after private milestone proofs or approvals | Deposits, milestone state, approver roles, release/cancel phase rules |
| Private orderbook entry | Many potential takers can discover and fill a private listing | Listing commitment, optional encrypted handoff, `OrderFilled` event |
| Claim/ticket escrow | A claimant redeems against a private entitlement | Claim note, verifier role, terminal state when needed |

## Lifecycle Selection

Load `lifecycle-phases.md` for every escrow shape, including one-shot atomic swaps. Use the smallest phase graph that protects both sides:

- Atomic token swaps usually need `CREATED`, `OPEN`, `VOID`, and `FILLED`.
- Offchain payment or proof-generation flows usually add `ACCEPTED`.
- Cancellable or delayed delivery flows usually add `SETTLEMENT_IN_PROGRESS`.

Do not silently choose optional phases for a new project. Recommend a preset, then ask the user to confirm or override.

## Design Questions

If the request is underspecified, infer conservative defaults and ask only for blockers:

- Assets being escrowed and whether settlement is token-to-token, token-to-claim, or conditional release.
- Participants and roles: maker, taker, arbiter, approver, admin, observer.
- Which state must be shared privately between participants.
- Whether the contract should remain secret or be publicly discoverable.
- Which actions must be one-shot, cancelable, expiring, or repeatable.
- Whether role membership itself must be private.
- Whether the escrow needs accept/fill/settlement windows and who can recover after each timeout.

## Default

When the user just asks for "a private escrow", generate a secret, private-only OTC atomic swap with contract-owned shared config, explicit maker checks, and open fill guarded by settlement terms and terminal phase state. Add public components only if the user asks for indexing, public settlement, external interoperability, or allowlisted counterparties.
