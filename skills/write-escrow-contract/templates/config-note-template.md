# ConfigNote Template

Canonical source: `../scaffold-escrow-project/templates/project/packages/contracts/src/types/config_note.nr`.

Use `ConfigNote` for immutable order terms:

- creator role pseudonym;
- offered asset and amount;
- requested consideration terms;
- partial-note or receive commitment data;
- immutable windows;
- salted commitments to sensitive offchain terms.

Do not add a manual `owner` field or manual note randomness. Contract ownership is supplied by the `SinglePrivateImmutable` storage operation, and the Aztec `#[note]` macro injects note-header randomness.

Only include role pseudonyms that are known at config time. Atomic one-shot orders usually bind only `creator_pseudonym`; do not predesignate taker/filler pseudonyms unless the user explicitly asks for an allowlist.
