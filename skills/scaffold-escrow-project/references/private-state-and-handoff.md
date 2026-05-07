# Private State And Handoff

Default to private execution and private state. Add public state or public calls only when the escrow design needs public discoverability, public settlement, or external tooling that cannot operate privately.

## Capability Boundaries

| Material | Enables | Does not enable |
|---|---|---|
| Artifact + instance | Reconstructing/registering the wrapper and forming calls | Reading encrypted contract-owned private notes |
| Contract secret key | Reading and potentially nullifying contract-owned notes | Business authority unless Noir deliberately grants it |
| Participant account key | Sending/proving as that account | Reading contract-owned private notes without the contract key |
| Role secret | Proving caller-bound maker/taker/filler pseudonym | Reading shared state or authorizing another address |
| Authwit | One specific cross-contract action | General escrow authority |

## Contract-Owned Shared State

Participants who need the same private facts should read contract-owned private notes:

1. Generate a contract secret key.
2. Derive public keys and deploy with `deployWithPublicKeys`.
3. Store shared escrow data under storage owner `self.address`.
4. Register the contract instance, secret key, and escrow sender in every participant wallet that should read shared state: `wallet.registerContract(instance, artifact, secretKey)` then `wallet.registerSender(instance.address)`.
5. Include `additionalScopes: [escrow.address]` on private calls that read or nullify escrow-owned notes.
6. For the default funded constructor, compute/register the escrow instance before creating the maker's token authwit, then send deployment with that authwit and initialize state directly to `OPEN`.

Prefer:

| Need | Pattern |
|---|---|
| Immutable escrow terms | `SinglePrivateImmutable<ConfigNote, Context>` |
| Mutable lifecycle state | `SinglePrivateMutable<StateNote, Context>` with storage owner `self.address` |
| Sets of claims/deposits/fills | `Owned<PrivateSet<T>>` |
| Per-participant state | `Map<AztecAddress, Owned<...>>` |

## Rules

- `ConfigNote` and `StateNote` do not need manual `owner` fields; the storage operation supplies the owner.
- Do not add manual note randomness; the Aztec `#[note]` macro injects note-header randomness.
- Put role restrictions in Noir logic. Possession of the contract secret key is not a role gate by default.
- Role secrets are caller-sampled `Field` values. Store only `Poseidon2([caller, secret])` in config/state and emit `RoleAdded { secret }` to the caller for recovery.
- Keep offchain manifests as handoff layers, not sources of truth for escrow state.
- Store salted commitments for recoverable sensitive terms and deliver plaintexts offchain with the same care as key material.
