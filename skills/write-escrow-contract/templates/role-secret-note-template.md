# RoleSecretNote Template (Noir)

Use this note when escrow roles should be authenticated by a private pseudonym instead of a public address in config.

Store it as:

```noir
role_secret: Owned<SinglePrivateImmutable<RoleSecretNote, Context>, Context>,
```

This is one storage slot with one immutable note per owner. The caller is the underlying `Owned` key, and config/state decides which role the caller is satisfying by storing the expected pseudonym for creator, taker, filler, arbiter, etc. A role secret authenticates the current caller pseudonymously; it is not a default mechanism for predesignating who may fill an open order.

All notes must include an `owner` field. For role-secret notes, `owner` is the creator/participant address whose pseudonym is being authorized. Deliver creation messages to that caller with `MessageDelivery.ONCHAIN_UNCONSTRAINED`; do not deliver role secrets to the escrow address by default.

```noir
use aztec::{
    macros::notes::note,
    oracle::random::random,
    protocol::{
        address::AztecAddress,
        traits::{Deserialize, Serialize, Packable, ToField},
    },
};
use poseidon::poseidon2::Poseidon2;

#[derive(Eq, Serialize, Deserialize, Packable)]
#[note]
pub struct RoleSecretNote {
    pub owner: AztecAddress,
    pub randomness: Field,
}

impl RoleSecretNote {
    pub fn new(owner: AztecAddress) -> Self {
        Self {
            owner,
            // Safety: random() is an oracle call for note randomness.
            randomness: unsafe { random() },
        }
    }

    pub fn compute_pseudonym(owner: AztecAddress, randomness: Field) -> Field {
        Poseidon2::hash([owner.to_field(), randomness], 2)
    }

    pub fn pseudonym(self) -> Field {
        RoleSecretNote::compute_pseudonym(self.owner, self.randomness)
    }
}
```

## Contract Snippets

```noir
use aztec::state_vars::{Owned, SinglePrivateImmutable};
use crate::types::role_secret_note::RoleSecretNote;

#[storage]
struct Storage<Context> {
    role_secret: Owned<SinglePrivateImmutable<RoleSecretNote, Context>, Context>,
}

#[external("private")]
fn create_creator_role_secret() -> Field {
    let caller = self.msg_sender();
    let note = RoleSecretNote::new(caller);
    let pseudonym = RoleSecretNote::compute_pseudonym(caller, note.randomness);

    self.storage.role_secret.at(caller)
        .initialize(note)
        .deliver_to(caller, MessageDelivery.ONCHAIN_UNCONSTRAINED);

    pseudonym
}

fn assert_creator_pseudonym(caller: AztecAddress, expected_pseudonym: Field) {
    let role_secret = self.storage.role_secret.at(caller).get_note();
    assert(role_secret.owner == caller, "role secret owner mismatch");
    assert(role_secret.pseudonym() == expected_pseudonym, "invalid role secret");
}
```

For atomic one-shot escrows, create only the creator role secret by default and store its pseudonym in `ConfigNote.creator_pseudonym`. Do not add a filler role unless the user explicitly asks for a bound filler.

For non-atomic maker/taker/filler escrows, config or state may store fields such as `creator_pseudonym`, `taker_pseudonym`, or `filler_pseudonym`. The role-gated entrypoint reads `self.storage.role_secret.at(caller).get_note()` and checks that note's pseudonym against the relevant field.

For `ACCEPTED`, create or read the accepting caller's role secret during the accept transition and write that caller's pseudonym into `StateNote`. Later fill, settlement-progress, recovery, or handoff calls compare the caller's current role-secret pseudonym to the stored state field.

Default bootstrap:

- Create the creator role secret during constructor/deploy flow and store the creator pseudonym in `ConfigNote`.
- Create or read the taker/filler caller's role secret and bind that current caller's pseudonym when entering `ACCEPTED`.
- For atomic one-shot flows with no `ACCEPTED` phase, do not bind taker/filler pseudonyms unless explicitly required by the user's settlement design.
- Reuse the same `role_secret` storage slot for normal creator/taker/filler checks. Add a separate slot only if the same caller needs multiple unlinkable role secrets inside the same escrow.

If the constructor cannot create the creator role secret, pass a precomputed pseudonym from an already-established role-secret flow.
