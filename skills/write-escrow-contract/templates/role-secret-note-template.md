# RoleSecretNote Template (Noir)

Use this note when escrow roles should be authenticated by a private pseudonym instead of a public address in config.

Store it as:

```noir
role_secrets: Owned<PrivateImmutable<RoleSecretNote, Context>, Context>,
```

The note is owned by the participant account, not by the escrow contract. Deliver creation messages to the caller with `MessageDelivery.ONCHAIN_UNCONSTRAINED`.

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
use aztec::state_vars::{Owned, PrivateImmutable};
use crate::types::role_secret_note::RoleSecretNote;

#[storage]
struct Storage<Context> {
    role_secrets: Owned<PrivateImmutable<RoleSecretNote, Context>, Context>,
}

#[external("private")]
fn create_role_secret() -> Field {
    let caller = self.msg_sender();
    let note = RoleSecretNote::new(caller);
    let pseudonym = RoleSecretNote::compute_pseudonym(caller, note.randomness);

    self.storage.role_secrets
        .at(caller)
        .initialize(note)
        .deliver(MessageDelivery.ONCHAIN_UNCONSTRAINED);

    pseudonym
}

fn assert_role_pseudonym(caller: AztecAddress, expected_pseudonym: Field) {
    let role_secret = self.storage.role_secrets.at(caller).get_note();
    assert(role_secret.owner == caller, "role secret owner mismatch");
    assert(role_secret.pseudonym() == expected_pseudonym, "invalid role secret");
}
```

For a maker/taker/filler escrow, config or state should store fields such as `maker_pseudonym`, `taker_pseudonym`, or `filler_pseudonym`. The role-gated entrypoint checks the caller's role secret against the relevant field.

Default bootstrap:

- Create the maker role secret during constructor/deploy flow and store the maker pseudonym in `ConfigNote`.
- Create the taker/filler role secret and bind its pseudonym when entering `ACCEPTED`.
- For atomic one-shot flows with no `ACCEPTED` phase, bind the taker/filler pseudonym during `FILLED` if it is needed at all.

If the constructor cannot create the maker role secret, pass a precomputed pseudonym from an already-established role-secret flow.
