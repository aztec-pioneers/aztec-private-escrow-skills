# Shared Private State

Escrow participants often need to read the same private facts: terms, lifecycle flags, partial-note commitments, role commitments, cancellation terms, or dispute state. Model that as contract-owned private storage.

Role secrets are the exception: a `RoleSecretNote` is delivered to the role holder and its `owner` field is the creator/participant address. Store the pseudonym in shared config or lifecycle state, not the role-secret note itself.

## Pattern

1. Generate a contract secret key.
2. Derive public keys and deploy with `deployWithPublicKeys`.
3. Store shared escrow data as notes owned by `self.address`.
4. Register the contract instance with the secret key in every participant wallet that should read the shared state.
5. Include `additionalScopes: [escrow.address]` on private calls that read or nullify contract-owned notes.

## Storage Choices

| Need | Prefer |
|---|---|
| Immutable escrow terms | `SinglePrivateImmutable<T>` |
| Mutable single lifecycle state | `SinglePrivateMutable<StateNote, Context>` with notes owned by `self.address` |
| Sets of claims, deposits, fills, or receipts | `Owned<PrivateSet<T>>` |
| Per-participant private state | `Map<AztecAddress, Owned<...>>` |
| Per-caller role secret | `Owned<PrivateImmutable<RoleSecretNote, Context>, Context>` delivered to the role holder |

## Authorization

The contract secret key grants read/nullify capability for contract-owned notes. It should not automatically grant business authority. Gate actions with explicit Noir checks: maker/taker roles, role commitments, lifecycle phases, deadlines, authwits, or other escrow-specific rules.

For private role checks, read the caller's `RoleSecretNote` from `self.storage.role_secret.at(caller)`, assert its `owner` field equals the caller, compute its pseudonym, and compare it to the role pseudonym stored in contract-owned config or lifecycle state.

For mutable lifecycle checks, remember that private mutable reads consume and recreate the current note. Always deliver the replacement state note with constrained onchain delivery.

## Privacy Defaults

Avoid public mirrors of escrow terms unless the design needs public discoverability. If public indexing is needed, publish only the minimum commitment surface needed for discovery.
