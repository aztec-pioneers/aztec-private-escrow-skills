# StateNote Template (Noir)

Use a `StateNote` when the escrow has mutable lifecycle state: accepted taker, settlement windows, delayed delivery, or timeout recovery. Atomic one-shot onchain settlement flows usually do not need it, even when they are not token-to-token.

For a single escrow-wide state value, prefer `SinglePrivateMutable<StateNote, Context>` and initialize/replace notes owned by `self.address`. An owned `PrivateMutable` is also valid only if keyed to `self.address`; do not make escrow lifecycle state per participant.

```noir
use aztec::{
    macros::notes::note,
    protocol::traits::{Deserialize, Serialize, Packable},
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
    pub phase: Field,
    pub taker_pseudonym: Field,
    pub filler_pseudonym: Field,
    pub accepted_at: u64,
    pub settlement_started_at: u64,
    pub fill_deadline: u64,
    pub settlement_deadline: u64,
}

impl StateNote {
    pub fn created() -> Self {
        StateNote {
            phase: PHASE_CREATED,
            taker_pseudonym: 0,
            filler_pseudonym: 0,
            accepted_at: 0,
            settlement_started_at: 0,
            fill_deadline: 0,
            settlement_deadline: 0,
        }
    }

    pub fn assert_phase(self, expected: Field) -> Self {
        assert(self.phase == expected, "invalid escrow phase");
        self
    }
}
```

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
    .initialize(StateNote::created(), self.address)
    .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
```

## Read Without Mutating

Private mutable reads still consume and recreate the state note. Always deliver the replacement note.

```noir
let state_message = self.storage.state.get_note();
let state = state_message.get_note().assert_phase(PHASE_OPEN);
state_message.deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
```

## Mutate

Read, validate, mutate, and reinsert through `replace`. Deliver contract-owned state with constrained onchain delivery.

```noir
let now = self.context.get_anchor_block_header().timestamp();

self.storage.state
    .replace(
        |state| {
            let state = state.assert_phase(PHASE_OPEN);
            StateNote {
                phase: PHASE_ACCEPTED,
                taker_pseudonym,
                filler_pseudonym: state.filler_pseudonym,
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
