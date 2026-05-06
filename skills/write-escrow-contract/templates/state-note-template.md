# StateNote Template (Noir)

Use a `StateNote` for escrow lifecycle state by default. Even atomic one-shot onchain settlement flows need it when the order can be voided, because `VOID` and `FILLED` must be durable terminal phases rather than implicit side effects of asset availability.

All notes must include an `owner` field. For contract-owned shared notes such as `StateNote`, set `owner` to `self.address`.

For a single escrow-wide state value, prefer `SinglePrivateMutable<StateNote, Context>` and initialize/replace notes owned by `self.address`. An owned `PrivateMutable` is also valid only if keyed to `self.address`; do not make escrow lifecycle state per participant.

```noir
use aztec::{
    macros::notes::note,
    protocol::{
        address::AztecAddress,
        traits::{Deserialize, Serialize, Packable},
    },
};

global PHASE_CREATED: Field = 0;
global PHASE_OPEN: Field = 1;
global PHASE_VOID: Field = 2;
global PHASE_ACCEPTED: Field = 3;
global PHASE_SETTLEMENT_IN_PROGRESS: Field = 4;
global PHASE_FILLED: Field = 5;

#[derive(Eq, Serialize, Deserialize, Packable)]
#[note]
pub struct StateNote {
    pub owner: AztecAddress,
    pub phase: Field,
}

impl StateNote {
    pub fn created(owner: AztecAddress) -> Self {
        StateNote {
            owner,
            phase: PHASE_CREATED,
        }
    }

    pub fn assert_phase(self, expected: Field) -> Self {
        assert(self.phase == expected, "invalid escrow phase");
        self
    }

    pub fn transition(self, expected: Field, next: Field) -> Self {
        let state = self.assert_phase(expected);
        StateNote {
            owner: state.owner,
            phase: next,
        }
    }
}
```

For `ACCEPTED`, `SETTLEMENT_IN_PROGRESS`, timeout, or role-bound non-atomic flows, extend `StateNote` with the exact fields the design needs:

```noir
pub taker_pseudonym: Field,
pub accepted_at: u64,
pub settlement_started_at: u64,
pub fill_deadline: u64,
pub settlement_deadline: u64,
```

Do not add `filler_pseudonym` to atomic one-shot flows. Atomic fills are open to any filler that can satisfy the settlement terms; creator authority is the only default role.

## Storage

```noir
use aztec::state_vars::{SinglePrivateImmutable, SinglePrivateMutable};
use crate::types::{config_note::ConfigNote, state_note::StateNote};

#[storage]
struct Storage<Context> {
    config: SinglePrivateImmutable<ConfigNote, Context>,
    state: SinglePrivateMutable<StateNote, Context>,
}
```

## Initialize

```noir
self.storage.state
    .initialize(StateNote::created(self.address), self.address)
    .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
```

## Read Without Mutating

Private mutable reads still consume and recreate the state note. Always deliver the replacement note.

Verification note: before changing this pattern, compile-test it against the target Aztec version. There is an open concern that calling `state_message.get_note()` may consume the `NoteMessage`, which would make a later `state_message.deliver(...)` a move-after-use error. If that is confirmed, use a check-only `replace(|state| state.assert_phase(...), self.address).deliver(...)` pattern instead.

```noir
let state_message = self.storage.state.get_note();
let state = state_message.get_note().assert_phase(PHASE_OPEN);
state_message.deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
```

## Mutate

Read, validate, mutate, and reinsert through `replace`. Deliver contract-owned state with constrained onchain delivery.

```noir
let now = self.context.get_anchor_block_header().timestamp();

// Example for an extended StateNote that includes taker/timer fields.
self.storage.state
    .replace(
        |state| {
            let state = state.assert_phase(PHASE_OPEN);
            StateNote {
                owner: state.owner,
                phase: PHASE_ACCEPTED,
                taker_pseudonym,
                accepted_at: now,
                settlement_started_at: state.settlement_started_at,
                fill_deadline: now + fill_window,
                settlement_deadline: state.settlement_deadline,
            }
        },
        self.address,
    )
    .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
```

## Time Checks

Use the anchor block timestamp for private deadline checks:

```noir
let now = self.context.get_anchor_block_header().timestamp();
assert(now >= state.settlement_deadline, "settlement window still active");
```

It is fine that the anchor block timestamp may lag slightly; keep windows coarse enough that this does not matter.
