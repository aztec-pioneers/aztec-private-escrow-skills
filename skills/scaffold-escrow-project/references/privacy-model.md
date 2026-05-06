# Privacy Model

Default to private execution and private state. Add public state or public calls only when the escrow design needs public discoverability, public settlement, or external tooling that cannot operate privately.

## Capability Boundaries

| Material | Enables | Does not enable |
|---|---|---|
| Contract artifact and instance | Reconstructing the contract wrapper, forming calls, and registering the artifact/instance locally | Reading encrypted contract-owned private notes |
| Contract secret key | PXE/wallet access to decrypt, read, and potentially nullify notes owned by the contract address | Authorization by itself, unless the Noir contract deliberately treats key possession as sufficient |
| Participant account key | Sending as that account and proving account-owned private state | Reading contract-owned private state without the contract secret key |
| Role secret | Proving that the caller can reproduce a private maker/taker/filler pseudonym expected by escrow config or lifecycle state; for `ACCEPTED`, this is normally the accepting caller's runtime pseudonym | Reading shared escrow state, moving escrow-owned funds by itself, proving the caller was predesignated, or authorizing a different caller address |
| Sensitive term plaintext | Lets a participant verify or perform an offchain action such as payment or delivery | Should not be recoverable from onchain encrypted logs or public/orderflow data |
| Authwit | Permission for a specific cross-contract action, usually token movement | General escrow authority or reusable spending rights |

## Rules

1. Treat the contract secret key as an access capability, not harmless metadata.
2. Keep shared escrow data in contract-owned private state when all participants need to read the same facts privately.
3. Put role restrictions in Noir logic. Do not rely on possession of the contract secret key as the only role gate unless the user explicitly wants that model.
4. Keep offchain manifests and future discovery services as handoff layers. They should not become the source of truth for escrow state.
5. If a participant registers only the artifact/instance without the contract secret key, they can instantiate the wrapper but should be expected to fail private reads that require contract-owned notes. A complete escrow manifest includes the contract secret key and should be encrypted for transport.
6. Role secrets are the main exception to the contract-owned shared-state default. The contract never stores the raw secret; it stores only `Poseidon2([caller, secret])` in shared config or lifecycle state, and emits `RoleAdded { secret }` to the caller for recovery.
7. For recoverable sensitive terms, store salted commitments onchain and deliver plaintexts offchain through the same secure handoff channel as the contract secret key.
