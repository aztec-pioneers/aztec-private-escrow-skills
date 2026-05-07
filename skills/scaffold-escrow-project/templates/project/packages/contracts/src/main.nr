pub mod types;

use aztec::macros::aztec;

#[aztec]
pub contract OTCEscrow {
    use aztec::{
        macros::{
            events::event,
            functions::{external, initializer},
            storage::storage,
        },
        messages::message_delivery::MessageDelivery,
        protocol::{
            address::AztecAddress,
            traits::ToField,
        },
        state_vars::{SinglePrivateImmutable, SinglePrivateMutable},
    };
    use poseidon::poseidon2::Poseidon2;
    use token_contract::Token;
    use crate::types::{
        config_note::ConfigNote,
        state_note::{StateNote, PHASE_FILLED, PHASE_OPEN, PHASE_VOID},
    };

    #[event]
    struct OrderFilled {
        filled: bool,
    }

    #[event]
    struct RoleAdded {
        secret: Field,
    }

    #[storage]
    struct Storage<Context> {
        config: SinglePrivateImmutable<ConfigNote, Context>,
        state: SinglePrivateMutable<StateNote, Context>,
    }

    #[external("private")]
    #[initializer]
    fn constructor(
        sell_token_address: AztecAddress,
        sell_token_amount: u128,
        buy_token_address: AztecAddress,
        buy_token_amount: u128,
        creator_role_secret: Field,
        _nonce: Field,
    ) {
        let creator = self.msg_sender();
        let creator_pseudonym = Poseidon2::hash([creator.to_field(), creator_role_secret], 2);

        let partial_note = self.call(Token::at(buy_token_address)
            .initialize_transfer_commitment(self.address, self.address));

        self.call(Token::at(sell_token_address)
            .transfer_private_to_private(creator, self.address, sell_token_amount, _nonce));

        self.storage.config
            .initialize(ConfigNote::new(
                creator_pseudonym,
                partial_note,
                sell_token_address,
                sell_token_amount,
                buy_token_address,
                buy_token_amount,
            ))
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

        self.storage.state
            .initialize(StateNote::open(), self.address)
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

        self.emit(RoleAdded { secret: creator_role_secret })
            .deliver_to(creator, MessageDelivery.ONCHAIN_UNCONSTRAINED);
    }

    #[external("private")]
    fn fill_order(_nonce: Field) {
        let config = self.storage.config.get_note();
        let caller = self.msg_sender();

        self.storage.state
            .replace(|state| state.transition(PHASE_OPEN, PHASE_FILLED), self.address)
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

        self.call(Token::at(config.buy_token_address)
            .transfer_private_to_private(caller, self.address, config.buy_token_amount, _nonce));

        self.call(Token::at(config.buy_token_address)
            .transfer_private_to_commitment(self.address, config.partial_note, config.buy_token_amount, 0));

        self.call(Token::at(config.sell_token_address)
            .transfer_private_to_private(self.address, caller, config.sell_token_amount, 0));

        self.emit(OrderFilled { filled: true }).deliver_to(self.address, MessageDelivery.ONCHAIN_CONSTRAINED);
    }

    #[external("private")]
    fn void_order(_nonce: Field, creator_role_secret: Field) {
        let config = self.storage.config.get_note();
        let caller = self.msg_sender();
        assert(
            Poseidon2::hash([caller.to_field(), creator_role_secret], 2) == config.creator_pseudonym,
            "invalid role secret",
        );

        self.storage.state
            .replace(|state| state.transition(PHASE_OPEN, PHASE_VOID), self.address)
            .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

        self.call(Token::at(config.sell_token_address)
            .transfer_private_to_private(self.address, caller, config.sell_token_amount, _nonce));
    }

    #[external("utility")]
    unconstrained fn get_config() -> pub ConfigNote {
        self.storage.config.view_note()
    }

    #[external("utility")]
    unconstrained fn get_state() -> pub StateNote {
        self.storage.state.view_note()
    }
}
