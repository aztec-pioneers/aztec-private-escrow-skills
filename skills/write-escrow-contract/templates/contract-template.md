# Escrow Contract Template (Noir)

This compact OTC template shows the minimum atomic one-shot onchain settlement shape. It maps phases implicitly as constructor = `CREATED`, `deposit_tokens` = `OPEN`, and `fill_order` = `FILLED`.

For generalized escrows, do not copy this unchanged. Add an explicit contract-owned lifecycle state note using `../scaffold-escrow-project/references/lifecycle-phases.md`, role-secret checks using `templates/role-secret-note-template.md`, and map concrete token calls with `references/token-primitive-adapters.md`. Token method names below are illustrative unless they match the selected token contract's actual API.

This template intentionally does not push custom order-level nullifiers for deposit or fill. The one-shot flow is asset-gated: a replay can only succeed if the maker funds the escrow again, so generated docs should warn makers not to refill a completed one-shot order.

The minimal OTC template below does not wire role secrets or mutable state directly because maker/taker/filler pseudonyms and phase windows may be bound at different phases. If role-secret auth is required, add the `RoleSecretNote` storage and checks from `templates/role-secret-note-template.md`. If the escrow needs ACCEPTED, SETTLEMENT_IN_PROGRESS, timers, or timeout recovery, add `StateNote` from `templates/state-note-template.md`.

```noir
use aztec::macros::aztec;

#[aztec]
pub contract MyEscrow {
    use aztec::{
        macros::{
            events::event,
            functions::{initializer, external},
            storage::storage
        },
        messages::message_delivery::MessageDelivery,
        protocol::address::AztecAddress,
        state_vars::SinglePrivateImmutable
    };
    use token_contract::Token;
    use crate::types::config_note::ConfigNote;

    global DELIVERY_KIND_NONE: Field = 0;
    global DELIVERY_KIND_TOKEN_SETTLEMENT: Field = 1;
    global DELIVERY_KIND_PRIVATE_PROOF: Field = 2;
    global DELIVERY_KIND_PRIVATE_MESSAGE: Field = 3;

    #[event]
    struct OrderFilled {
        filler_pseudonym: Field,
        delivery_kind: Field,
        delivery_commitment: Field,
        delivery_data_0: Field,
        delivery_data_1: Field,
    }

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

        // Always emit the fill receipt to the escrow address. Participants who
        // registered the escrow secret key can read it without revealing their
        // own address as the event recipient.
        self.emit(OrderFilled {
            filler_pseudonym: 0,
            delivery_kind: DELIVERY_KIND_TOKEN_SETTLEMENT,
            delivery_commitment: config.partial_note,
            delivery_data_0: 0,
            delivery_data_1: 0,
        }).deliver_to(self.address, MessageDelivery.ONCHAIN_CONSTRAINED);
    }

    #[external("utility")]
    unconstrained fn get_config() -> ConfigNote {
        self.storage.config.view_note()
    }
}
```
