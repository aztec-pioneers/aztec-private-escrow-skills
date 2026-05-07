# Noir Private State Patterns

Use contract-owned private state when escrow participants need a shared private view of terms or lifecycle state.

Contract-owned shared notes (`ConfigNote`, `StateNote`) do not need manual `owner` fields. Use the storage operation owner argument (`self.address`) and avoid manual note randomness; the Aztec `#[note]` macro injects note-header randomness. Role secrets are not notes in the default escrow pattern; they are caller-sampled `Field` values whose caller-bound pseudonyms are stored in config/state.

## Storage

| Need | Pattern |
|---|---|
| Set-once escrow config | `SinglePrivateImmutable<ConfigNote, Context>` |
| Mutable lifecycle state | `SinglePrivateMutable<StateNote, Context>` with notes owned by `self.address` |
| Deposits, claims, fills, receipts | `Owned<PrivateSet<T>>` |
| Per-participant private state | `Map<AztecAddress, Owned<...>>` |

## Lifecycle State

Represent mutable phases separately from immutable order terms. Use `StateNote` even for one-shot atomic fills so cancellation and terminal fill status are represented as private state instead of inferred from asset availability.

Store at least:

- Current phase discriminant, such as `OPEN`, `ACCEPTED`, `SETTLEMENT_IN_PROGRESS`, `VOID`, or `FILLED`.
- Bound taker or taker commitment when entering `ACCEPTED`.
- Immutable timing windows copied from config or constructor args.
- Terminal phase and deadline fields needed to prevent impossible transitions, such as filling after `VOID` or voiding during a live accepted window.

Use `ConfigNote` for immutable terms and `StateNote` for mutable phase data. Atomic one-shot onchain settlement flows use a small state graph (`OPEN`, `VOID`, `FILLED`) because constructor funding makes the order immediately actionable. Longer flows with accept, settlement-in-progress, or timeout recovery extend the same state note.

Do not add custom order-level nullifiers for default constructor-funding or fill replay protection. Primitive token and note operations still create their own nullifiers. Use `StateNote` terminal phases to prevent filling after `VOID` or after `FILLED`.

## Mutable Reads

Private mutable reads nullify and recreate the current note. The state variable API returns a note message for the replacement. Deliver it even when the function only inspected state.

Verification note: before changing this pattern, compile-test it against the target Aztec version. There is an open concern that calling `state_message.get_note()` may consume the `NoteMessage`, which would make a later `state_message.deliver(...)` a move-after-use error. If that is confirmed, use a check-only `replace(|state| state.assert_phase(...), self.address).deliver(...)` pattern instead.

```noir
let state_message = self.storage.state.get_note();
let state = state_message.get_note().assert_phase(PHASE_OPEN);
state_message.deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
```

For mutations, prefer `replace`:

```noir
self.storage.state
    .replace(|state| { /* validate and return updated StateNote */ }, self.address)
    .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
```

Contract-owned state should use constrained onchain delivery because a malicious caller should not be able to brick future readers by withholding or corrupting the replacement message.

## Time Checks

Use `self.context.get_anchor_block_header().timestamp()` for private phase deadlines. Keep windows coarse enough that the anchor block timestamp being slightly behind wall-clock time is acceptable.

## Contract-Owned State

Contract-owned state should be written to `self.address` and read by wallets that have registered the contract instance with the contract secret key.

Private functions that read or nullify contract-owned notes need the contract address in `additionalScopes` on the TypeScript call.

## Amounts

Use `u128` for token amounts. Do not use `Field` for values that need normal integer overflow behavior.

## Private Reads

Use non-nullifying reads only for immutable private notes or utility/view functions. Private mutable state reads in private execution nullify and recreate the note, so they must be followed by replacement delivery.
