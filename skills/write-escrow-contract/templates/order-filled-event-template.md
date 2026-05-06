# OrderFilled Event Template (Noir)

Successful fills should always emit an `OrderFilled` private event to the escrow address with constrained onchain delivery. This creates a shared private receipt for readers that registered the escrow secret key, without addressing the maker or taker directly.

Do not use this event as a replay guard. Use `StateNote` terminal phase checks, not the event and not custom order-level nullifiers, to prevent fills after `VOID` or `FILLED`.

Default to a no-payload receipt. Add fields only when the design intake explicitly confirms that settlement requires data to be delivered or committed in the fill event. Atomic token settlement should normally use the no-payload form.

The TypeScript SDK should expose a `getOrderFilledEvent` helper that calls `wallet.getPrivateEvents` with `contractAddress: escrow.address`, `scopes: [escrow.address]`, `fromBlock` set from the manifest's creation block, and `toBlock` set to the current block plus one. The wallet must already have registered the escrow instance with the escrow secret key. Do not use send/simulate `from` or `additionalScopes` for event scanning.

```noir
use aztec::{
    macros::events::event,
    messages::message_delivery::MessageDelivery,
};

#[event]
struct OrderFilled {}
```

Emit from every successful fill path:

```noir
self.emit(OrderFilled {}).deliver_to(self.address, MessageDelivery.ONCHAIN_CONSTRAINED);
```

## Optional Payload Variant

Only add payload fields after asking the user what the fill event must carry. Common opt-in fields are a delivery/proof commitment, a small scalar payload, or a payload kind tag. Do not add placeholder fields, zero fields, random fields, filler pseudonyms, partial-note commitments, or token-settlement metadata just because they might be useful later.

```noir
#[event]
struct OrderFilled {
    delivery_commitment: Field,
}
```

For recoverable secrets such as usernames, addresses, account handles, or locker codes, prefer delivering plaintext offchain and putting a salted commitment in the event unless the user explicitly chooses event delivery.

When `OrderFilled` has payload fields, update the TypeScript event type and happy-path assertions to parse/check the decoded `event` payload. For the no-payload atomic form, only assert that the event exists and inspect metadata if useful.
