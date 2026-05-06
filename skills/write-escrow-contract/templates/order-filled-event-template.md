# OrderFilled Event Template (Noir)

Successful fills should always emit an `OrderFilled` private event to the escrow address with constrained onchain delivery. This creates a shared private receipt for readers that registered the escrow secret key, without addressing the maker or taker directly.

Do not use this event as a replay guard. It is a receipt and optional delivery carrier. One-shot atomic settlement is intentionally asset-gated: a replay can only succeed if the escrow is funded again. That is a sharp edge for makers, so document it when generating a one-shot escrow.

```noir
use aztec::{
    macros::events::event,
    messages::message_delivery::MessageDelivery,
};

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
```

Emit from every successful fill path:

```noir
self.emit(OrderFilled {
    filler_pseudonym,
    delivery_kind,
    delivery_commitment,
    delivery_data_0,
    delivery_data_1,
}).deliver_to(self.address, MessageDelivery.ONCHAIN_CONSTRAINED);
```

Use `delivery_commitment` for the commitment to whatever was delivered or proven. Use `delivery_data_0` and `delivery_data_1` only for scalar delivery data that the design intentionally permits in an onchain private event. For recoverable secrets such as usernames, addresses, account handles, or locker codes, prefer delivering plaintext offchain and putting a salted commitment in the event unless the user explicitly chooses event delivery.
