# Role Restriction Patterns

The contract secret key is a read/nullify capability for contract-owned private notes. It is not a business role unless the protocol intentionally makes it one.

## Common Roles

| Role | Typical authority |
|---|---|
| Maker | Create terms, fund the offered asset during construction, cancel before fill |
| Taker | Fill terms by providing consideration |
| Arbiter | Release, refund, or resolve a dispute |
| Admin | Configure protocol parameters, not per-escrow funds unless explicitly intended |
| Observer | Read shared private state but cannot act |

## Role-Secret Pseudonym Pattern

Prefer role pseudonyms when creator/maker/taker/filler identity should not be stored as an address in shared config.

1. The caller samples a random `Field` off-contract before the role-creating invocation.
2. The contract receives that `role_secret` argument and computes `Poseidon2::hash([caller.to_field(), role_secret], 2)`.
3. Config or state stores expected role pseudonyms as `Field` values, such as `creator_pseudonym`, `taker_pseudonym`, or `filler_pseudonym`.
4. The contract emits `RoleAdded { secret: role_secret }` as a private event to the caller. Do not deliver this event to the escrow address and do not include the secret in the manifest.
5. Later role-gated private entrypoints take `role_secret: Field`, recompute the caller-bound pseudonym inline, and assert it equals the configured role field.

For atomic one-shot escrows, only create the creator role secret by default. Do not add a filler role unless the user explicitly requires a bound filler.

For `ACCEPTED`, role binding is runtime caller binding: the accepting caller samples or presents their own role secret, and the contract writes that caller's pseudonym into `StateNote`. Do not ask for a "designated taker" unless the user explicitly wants an allowlisted counterparty.

If the same caller needs multiple unlinkable roles inside one escrow, ask the user whether those roles should share one secret or use separate sampled secrets. Otherwise use one active role secret per caller per escrow.

### Creation and delivery

Role secrets should be recoverable from caller-addressed private events, not stored in contract storage.

Use:

```noir
let pseudonym = Poseidon2::hash([caller.to_field(), role_secret], 2);

self.emit(RoleAdded { secret: role_secret })
    .deliver_to(caller, MessageDelivery.ONCHAIN_UNCONSTRAINED);
```

`ONCHAIN_UNCONSTRAINED` is appropriate here because the caller is sending recoverable private data to themselves. Do not use `OFFCHAIN` by default because the role secret should remain recoverable from onchain private logs.

Contract-owned shared config and lifecycle notes should still use `MessageDelivery.ONCHAIN_CONSTRAINED`.

The TypeScript SDK should expose `retrieveRoleSecret(wallet, node, escrow, recipient, fromBlock)` and scan `wallet.getPrivateEvents` with `contractAddress: escrow.address` and `scopes: [recipient]`. Return the decoded `secret` field, not the event wrapper, and throw if no `RoleAdded` event is found.

## General Patterns

1. Store role pseudonyms or role commitments in the shared private config/state note depending on privacy requirements. Do not store participant addresses for creator authorization unless the user explicitly chooses address-based auth.
2. In each private entrypoint, read the config/state and assert the caller's supplied role secret hashes to the required role pseudonym. Creator checks usually compare against config; post-accept taker/filler checks usually compare against state.
3. Use authwits for token movement from participant accounts into the escrow, including constructor funding.
4. Use `StateNote` lifecycle phase checks, deadlines, and asset availability for action gating. Do not add custom fill/funding nullifiers in the default templates.
5. If role membership must remain private, store commitments and require the caller to prove membership instead of exposing an address field.

## Guardrail

Do not infer that anyone with the contract secret key is allowed to execute privileged actions. Shared readers and authorized actors are separate concepts.
