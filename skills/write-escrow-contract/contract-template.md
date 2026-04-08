# Escrow Contract Template (Noir)

```noir
use aztec::macros::aztec;

#[aztec]
pub contract MyEscrow {
    use aztec::{
        macros::{
            functions::{initializer, external},
            storage::storage
        },
        messages::message_delivery::MessageDelivery,
        protocol::address::AztecAddress,
        state_vars::SinglePrivateImmutable
    };
    use token_contract::Token;
    use crate::types::config_note::ConfigNote;

    #[storage]
    struct Storage<Context> {
        config: SinglePrivateImmutable<ConfigNote, Context>,
    }

    #[external("private")]
    #[initializer]
    fn constructor(
        sell_token_address: AztecAddress,
        sell_token_amount: u128,
        buy_token_address: AztecAddress,
        buy_token_amount: u128,
    ) {
        // Create partial note for receiving buy tokens
        let partial_note = self.call(Token::at(buy_token_address)
            .initialize_transfer_commitment(
                self.address,
                self.address
            ));

        // Store config as private immutable note
        let config = ConfigNote::new(
            self.address,
            partial_note,
            sell_token_address,
            sell_token_amount,
            buy_token_address,
            buy_token_amount
        );

        self.storage.config
            .initialize(config)
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
    }

    #[external("private")]
    fn deposit_tokens(_nonce: Field) {
        let config = self.storage.config.get_note();
        let caller = self.msg_sender();

        // Transfer seller's tokens into escrow
        self.call(Token::at(config.sell_token_address)
            .transfer_private_to_private(
                caller,
                self.address,
                config.sell_token_amount,
                _nonce
            ));

        // Nullifier prevents double-deposit
        let deposit_nullifier = self.storage.config.get_note().get_nullifier(true);
        self.context.push_nullifier(deposit_nullifier);
    }

    #[external("private")]
    fn fill_order(_nonce: Field) {
        let config = self.storage.config.get_note();
        let caller = self.msg_sender();

        // 1. Transfer buyer's tokens into escrow
        self.call(Token::at(config.buy_token_address)
            .transfer_private_to_private(
                caller,
                self.address,
                config.buy_token_amount,
                _nonce
            ));

        // 2. Send buyer's tokens to seller via partial note
        self.call(Token::at(config.buy_token_address)
            .transfer_private_to_commitment(
                self.address,
                config.partial_note,
                config.buy_token_amount,
                0
            ));

        // 3. Send seller's tokens to buyer
        self.call(Token::at(config.sell_token_address)
            .transfer_private_to_private(
                self.address,
                caller,
                config.sell_token_amount,
                0
            ));

        // Nullifier prevents double-fill
        let fill_nullifier = config.get_nullifier(false);
        self.context.push_nullifier(fill_nullifier);
    }

    #[external("utility")]
    unconstrained fn get_config() -> ConfigNote {
        self.storage.config.view_note()
    }
}
```
