# Role Secret Pattern (Noir + TypeScript)

Use this pattern when escrow roles should be authenticated by a private pseudonym instead of a public address in config or state.

Do not create contract storage for role secrets. The caller samples a random `Field` off-contract, passes it to the role-creating contract call, and the contract computes the pseudonym inline:

```noir
fn compute_role_pseudonym(caller: AztecAddress, role_secret: Field) -> Field {
    Poseidon2::hash([caller.to_field(), role_secret], 2)
}
```

Hash both the caller address and role secret. A role secret alone must not let another address impersonate the role.

## Event

Emit the raw secret back to the caller as a recoverable private event. This event is caller-addressed, not escrow-addressed, and must never be added to the escrow manifest.

```noir
use aztec::{
    macros::events::event,
    messages::message_delivery::MessageDelivery,
    protocol::{address::AztecAddress, traits::ToField},
};
use poseidon::poseidon2::Poseidon2;

#[event]
struct RoleAdded {
    secret: Field,
}

fn emit_role_added(caller: AztecAddress, role_secret: Field) {
    self.emit(RoleAdded { secret: role_secret })
        .deliver_to(caller, MessageDelivery.ONCHAIN_UNCONSTRAINED);
}
```

`ONCHAIN_UNCONSTRAINED` is appropriate here because the caller is sending recoverable private data to themselves. Contract-owned config/state notes and escrow-addressed fill events should still use constrained onchain delivery.

## Creation and Checks

At construction, store the creator pseudonym in `ConfigNote`:

```noir
let creator = self.msg_sender();
let creator_pseudonym = compute_role_pseudonym(creator, creator_role_secret);

self.storage.config
    .initialize(ConfigNote::new(self.address, creator_pseudonym, ...))
    .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

emit_role_added(creator, creator_role_secret);
```

For `ACCEPTED`, bind the accepting caller at runtime:

```noir
let caller = self.msg_sender();
let taker_pseudonym = compute_role_pseudonym(caller, taker_role_secret);

self.storage.state
    .replace(|state| state.accept(taker_pseudonym, now), self.address)
    .deliver(MessageDelivery.ONCHAIN_CONSTRAINED);

emit_role_added(caller, taker_role_secret);
```

Role-gated entrypoints take the role secret as an argument and recompute the caller-bound pseudonym inline:

```noir
fn assert_role_pseudonym(caller: AztecAddress, role_secret: Field, expected_pseudonym: Field) {
    assert(
        compute_role_pseudonym(caller, role_secret) == expected_pseudonym,
        "invalid role secret"
    );
}
```

Atomic one-shot escrows bind only the creator pseudonym by default. Do not bind taker/filler pseudonyms unless the user explicitly adds `ACCEPTED`, delayed settlement, or another phase that needs to remember the runtime caller for later actions.

## TypeScript Retrieval

The SDK should expose `retrieveRoleSecret(wallet, node, escrow, recipient, fromBlock)`:

- scan `wallet.getPrivateEvents<RoleAddedEvent>(OTCEscrowContract.events.RoleAdded, ...)`;
- use `contractAddress: escrow.address`;
- use `scopes: [recipient]`, because `RoleAdded` is delivered to the caller;
- use `fromBlock` from the role creation transaction or manifest creation block;
- use `toBlock` as the current block plus one;
- return `events[0].event.secret`;
- throw if no event is found.

Generated tests should sample the role secret before each role-creating call, pass it into the call, then retrieve and compare it against the sampled value.
