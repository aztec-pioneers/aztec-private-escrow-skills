# ConfigNote Template (Noir)

Use `ConfigNote` for immutable order terms: maker pseudonym, offered asset, offered amount, requested consideration terms, partial-note commitments, immutable windows, and salted commitments to sensitive offchain terms.

Do not store plaintext usernames, account handles, or shipping addresses in config. Store salted commitments only and deliver plaintexts offchain through the same secure channel as the contract secret key.

```noir
use aztec::{
    macros::notes::note,
    oracle::random::random,
    protocol::{
        traits::{Deserialize, Serialize, Packable},
        address::AztecAddress,
    },
};

#[derive(Eq, Serialize, Deserialize, Packable)]
#[note]
pub struct ConfigNote {
    pub owner: AztecAddress,
    pub partial_note: Field,
    pub sell_token_address: AztecAddress,
    pub sell_token_amount: u128,
    pub buy_token_address: AztecAddress,
    pub buy_token_amount: u128,
    pub randomness: Field,
}

impl ConfigNote {
    pub fn new(
        owner: AztecAddress,
        partial_note: Field,
        sell_token_address: AztecAddress,
        sell_token_amount: u128,
        buy_token_address: AztecAddress,
        buy_token_amount: u128,
    ) -> Self {
        Self {
            owner,
            partial_note,
            sell_token_address,
            sell_token_amount,
            buy_token_address,
            buy_token_amount,
            // Safety: random() is an oracle call for note randomness
            randomness: unsafe { random() }
        }
    }

}
```

For richer escrows, add fields as needed:

```noir
pub maker_pseudonym: Field,
pub taker_pseudonym: Field,
pub filler_pseudonym: Field,
pub requested_term_commitment: Field,
pub accept_window: u64,
pub fill_window: u64,
pub settlement_window: u64,
```

Only include role pseudonyms that are actually known at config time. For open orders, taker/filler pseudonyms are often bound later during `ACCEPTED` or `FILLED` state transitions rather than in the constructor.
