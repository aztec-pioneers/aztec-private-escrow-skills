# Escrow Contract Template (Noir)

This compact OTC template shows the minimum atomic one-shot onchain settlement shape with explicit private lifecycle state. Even atomic flows use `StateNote` so `VOID` and `FILLED` are durable terminal phases.

For generalized escrows, do not copy this unchanged. Adapt the contract-owned lifecycle state using `../scaffold-escrow-project/references/lifecycle-phases.md`, role-secret checks using `templates/role-secret-note-template.md`, and map concrete token calls with `references/token-primitive-adapters.md`. Token method names below are illustrative unless they match the selected token contract's actual API.

This template intentionally does not push custom order-level nullifiers for deposit or fill. State transitions, not custom nullifiers, gate cancellation and terminal fill status.

The minimal OTC template below wires the creator role secret directly. It does not add taker/filler role secrets because atomic one-shot fills are open to any filler that can satisfy the settlement terms. For ACCEPTED, SETTLEMENT_IN_PROGRESS, timers, or timeout recovery, extend the baseline `StateNote` fields and transitions and add only the role secrets those phases require.

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
        state_vars::{SinglePrivateImmutable, SinglePrivateMutable}
    };
    use token_contract::Token;
    use crate::types::{
        config_note::ConfigNote,
        role_secret_note::RoleSecretNote,
        state_note::{StateNote, PHASE_CREATED, PHASE_OPEN, PHASE_VOID, PHASE_FILLED},
    };

    #[event]
    struct OrderFilled {}

    #[storage]
    struct Storage<Context> {
        config: SinglePrivateImmutable<ConfigNote, Context>,
        state: SinglePrivateMutable<StateNote, Context>,
        creator_role_secret: SinglePrivateImmutable<RoleSecretNote, Context>,
    }

    #[external("private")]
    #[initializer]
    fn constructor(
        sell_token_address: AztecAddress,
        sell_token_amount: u128,
        buy_token_address: AztecAddress,
        buy_token_amount: u128,
    ) {
        let creator = self.msg_sender();
        let creator_role_secret = RoleSecretNote::new(creator);
        let creator_pseudonym = RoleSecretNote::compute_pseudonym(
            creator,
            creator_role_secret.randomness,
        );

        // Create partial note for receiving buy tokens
        let partial_note = self.call(Token::at(buy_token_address)
            .initialize_transfer_commitment(
                self.address,
                self.address
            ));

        // Store config as private immutable note
        let config = ConfigNote::new(
            self.address,
            creator_pseudonym,
            partial_note,
            sell_token_address,
            sell_token_amount,
            buy_token_address,
            buy_token_amount
        );

        self.storage.config
            .initialize(config)
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

        self.storage.state
            .initialize(StateNote::created(self.address), self.address)
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

        self.storage.creator_role_secret
            .initialize(creator_role_secret)
            .deliver_to(creator, MessageDelivery.ONCHAIN_UNCONSTRAINED);
    }

    #[external("private")]
    fn deposit_tokens(_nonce: Field) {
        let config = self.storage.config.get_note();
        let caller = self.msg_sender();
        assert_creator_pseudonym(caller, config.creator_pseudonym);

        self.storage.state
            .replace(|state| state.transition(PHASE_CREATED, PHASE_OPEN), self.address)
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

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

        self.storage.state
            .replace(|state| state.transition(PHASE_OPEN, PHASE_FILLED), self.address)
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

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
        self.emit(OrderFilled {}).deliver_to(self.address, MessageDelivery.ONCHAIN_CONSTRAINED);
    }

    #[external("private")]
    fn void_created_order() {
        let config = self.storage.config.get_note();
        let caller = self.msg_sender();
        assert_creator_pseudonym(caller, config.creator_pseudonym);

        self.storage.state
            .replace(|state| state.transition(PHASE_CREATED, PHASE_VOID), self.address)
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);
    }

    #[external("private")]
    fn void_open_order(_nonce: Field) {
        let config = self.storage.config.get_note();
        let caller = self.msg_sender();
        assert_creator_pseudonym(caller, config.creator_pseudonym);

        self.storage.state
            .replace(|state| state.transition(PHASE_OPEN, PHASE_VOID), self.address)
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

        // Refund escrow-owned offered tokens to maker. The concrete token
        // method and nonce requirements are token-standard-specific.
        self.call(Token::at(config.sell_token_address)
            .transfer_private_to_private(
                self.address,
                caller,
                config.sell_token_amount,
                _nonce
            ));
    }

    #[external("utility")]
    unconstrained fn get_config() -> ConfigNote {
        self.storage.config.view_note()
    }

    #[external("utility")]
    unconstrained fn get_state() -> StateNote {
        self.storage.state.view_note()
    }

    fn assert_creator_pseudonym(caller: AztecAddress, expected_pseudonym: Field) {
        let role_secret = self.storage.creator_role_secret.get_note();
        assert(role_secret.owner == caller, "role secret owner mismatch");
        assert(role_secret.pseudonym() == expected_pseudonym, "invalid creator role");
    }
}
```
