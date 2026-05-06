# Role Restriction Patterns

The contract secret key is a read/nullify capability for contract-owned private notes. It is not a business role unless the protocol intentionally makes it one.

## Common Roles

| Role | Typical authority |
|---|---|
| Maker | Create terms, deposit offered asset, cancel before fill |
| Taker | Fill terms by providing consideration |
| Arbiter | Release, refund, or resolve a dispute |
| Admin | Configure protocol parameters, not per-escrow funds unless explicitly intended |
| Observer | Read shared private state but cannot act |

## Role-Secret Pseudonym Pattern

Prefer role pseudonyms when maker/taker/filler identity should not be stored as an address in shared config.

1. Store a caller-owned `RoleSecretNote` in `Owned<PrivateImmutable<RoleSecretNote, Context>, Context>`.
2. The note contains `owner: AztecAddress` and `randomness: Field`.
3. `RoleSecretNote::new(owner)` uses `unsafe { random() }` for randomness.
4. `RoleSecretNote::pseudonym()` returns `Poseidon2::hash([owner.to_field(), randomness], 2)`.
5. Config stores expected role pseudonyms as `Field` values, such as `maker_pseudonym`, `taker_pseudonym`, or `filler_pseudonym`.
6. A role-gated private entrypoint reads `self.storage.role_secrets.at(caller).get_note()` and asserts its pseudonym equals the configured role field.

Use `PrivateImmutable`, not `SinglePrivateImmutable`, because role secrets are per-account notes owned by the caller. `SinglePrivateImmutable` is contract-wide and sets the note owner to the contract address.

### Creation and delivery

Role-secret notes should be emitted to the caller, not to the escrow contract. This is the exceptional case where escrow-generated private state is caller-owned.

Use:

```noir
self.storage.role_secrets
    .at(caller)
    .initialize(RoleSecretNote::new(caller))
    .deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED);
```

`ONCHAIN_UNCONSTRAINED` is appropriate here because the caller is sending the note to themselves and is incentivized to receive it. Do not use `OFFCHAIN` by default because the note should remain recoverable from onchain private logs.

Contract-owned shared config and lifecycle notes should still use `MessageDelivery.ONCHAIN_CONSTRAINED`.

## General Patterns

1. Store role pseudonyms, addresses, or role commitments in the shared private config note depending on privacy requirements.
2. In each private entrypoint, read the config and assert the caller or supplied proof matches the required role.
3. Use authwits for token movement from participant accounts into the escrow.
4. Use lifecycle phase checks, deadlines, and asset availability for action gating. Do not add custom fill/deposit nullifiers in the default templates.
5. If role membership must remain private, store commitments and require the caller to prove membership instead of exposing an address field.

## Guardrail

Do not infer that anyone with the contract secret key is allowed to execute privileged actions. Shared readers and authorized actors are separate concepts.
