# StateNote Template

Canonical source: `../scaffold-escrow-project/templates/project/packages/contracts/src/types/state_note.nr`.

Use `StateNote` for lifecycle state by default. Even atomic one-shot onchain settlement flows need it when the order can be voided, because `VOID` and `FILLED` must be durable terminal phases.

For a single escrow-wide state value, use `SinglePrivateMutable<StateNote, Context>` and initialize/replace notes with storage owner `self.address`:

```noir
self.storage.state
    .initialize(StateNote::created(), self.address)
    .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
```

Do not add a manual `owner` field to `StateNote`; the storage owner argument is the contract address.

For `ACCEPTED`, `SETTLEMENT_IN_PROGRESS`, timeout, or role-bound non-atomic flows, extend `StateNote` only with fields required by the confirmed design, such as:

```noir
pub taker_pseudonym: Field,
pub accepted_at: u64,
pub settlement_started_at: u64,
pub fill_deadline: u64,
pub settlement_deadline: u64,
```

Atomic fills are open to any filler that can satisfy settlement terms; do not add `filler_pseudonym` unless the user explicitly requires it.

For mutations, prefer `replace` and deliver the replacement note with constrained onchain delivery:

```noir
self.storage.state
    .replace(|state| state.transition(PHASE_OPEN, PHASE_FILLED), self.address)
    .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
```

Use `self.context.get_anchor_block_header().timestamp()` for private deadline checks.
