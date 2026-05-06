use aztec::{
    macros::notes::note,
    protocol::{
        address::AztecAddress,
        traits::{Deserialize, Packable, Serialize},
    },
};

#[derive(Eq, Serialize, Deserialize, Packable)]
#[note]
pub struct ConfigNote {
    pub creator_pseudonym: Field,
    pub partial_note: Field,
    pub sell_token_address: AztecAddress,
    pub sell_token_amount: u128,
    pub buy_token_address: AztecAddress,
    pub buy_token_amount: u128,
}

impl ConfigNote {
    pub fn new(
        creator_pseudonym: Field,
        partial_note: Field,
        sell_token_address: AztecAddress,
        sell_token_amount: u128,
        buy_token_address: AztecAddress,
        buy_token_amount: u128,
    ) -> Self {
        Self {
            creator_pseudonym,
            partial_note,
            sell_token_address,
            sell_token_amount,
            buy_token_address,
            buy_token_amount,
        }
    }
}
