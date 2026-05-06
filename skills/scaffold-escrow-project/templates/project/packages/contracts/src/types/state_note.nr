use aztec::{
    macros::notes::note,
    protocol::traits::{Deserialize, Packable, Serialize},
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
}

impl StateNote {
    pub fn created() -> Self {
        StateNote {
            phase: PHASE_CREATED,
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
