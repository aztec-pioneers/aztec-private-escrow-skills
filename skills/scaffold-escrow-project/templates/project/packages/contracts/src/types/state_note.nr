use aztec::{
    macros::notes::note,
    protocol::traits::{Deserialize, Packable, Serialize},
};

pub global PHASE_OPEN: Field = 0;
pub global PHASE_VOID: Field = 1;
pub global PHASE_ACCEPTED: Field = 2;
pub global PHASE_SETTLEMENT_IN_PROGRESS: Field = 3;
pub global PHASE_FILLED: Field = 4;

#[derive(Eq, Serialize, Deserialize, Packable)]
#[note]
pub struct StateNote {
    pub phase: Field,
}

impl StateNote {
    pub fn open() -> Self {
        StateNote {
            phase: PHASE_OPEN,
        }
    }

    pub fn assert_phase(self, expected: Field) -> Self {
        assert(self.phase == expected, "invalid escrow phase");
        self
    }

    pub fn transition(self, expected: Field, next: Field) -> Self {
        let _state = self.assert_phase(expected);
        StateNote {
            phase: next,
        }
    }
}
