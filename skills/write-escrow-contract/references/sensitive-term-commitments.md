# Sensitive Term Commitments

Some escrow terms are recoverable from small search spaces: usernames, email addresses, phone numbers, Venmo handles, shipping addresses, locker codes, and similar identifiers. Do not emit these plaintexts in onchain private logs, even encrypted, because they are bad capture-now-decrypt-later material.

## Pattern

1. Store only a salted commitment in `ConfigNote` or `StateNote`.
2. Deliver the plaintext and salt offchain through the same secure participant handoff channel used for the contract secret key.
3. Keep the plaintext out of onchain note messages, private events, public logs, and raw manifests unless the manifest is itself encrypted for the recipient.
4. Domain-separate commitments so a Venmo handle commitment cannot be reused as an Amazon address commitment.
5. Include the platform or term type in config when it is not sensitive, such as `platform = "venmo"` or an enum/field encoding.

## Examples

| Term | Store onchain/private state | Deliver offchain |
|---|---|---|
| Venmo payment target | Currency code, amount, platform, salted username commitment | Username plaintext, salt |
| Amazon delivery | Platform, item/order constraints, salted address commitment | Address plaintext, salt |
| Email or account handle | Platform/domain, salted handle commitment | Handle plaintext, salt |

## Commitment Shape

Use a stable protocol-specific hash. In Noir examples, represent preprocessed offchain strings as `Field`s or fixed field arrays:

```noir
fn commit_sensitive_term(domain: Field, encoded_value: Field, salt: Field) -> Field {
    Poseidon2::hash([domain, encoded_value, salt], 3)
}
```

Do not rely on unsalted hashes for human-readable values. These values are easy to enumerate.

## Handoff

Treat sensitive plaintexts like key material:

- encrypt them to the intended participant out of band;
- never publish them for discovery;
- avoid storing raw plaintext in orderflow records;
- if a manifest carries them, use encrypted fields and mark the encryption scheme.

## Event Delivery Exception

`OrderFilled` always carries the `filled: true` receipt marker. It may carry additional delivery data only when the escrow design intentionally uses a private event as the delivery channel, such as a locker-code-style handoff to the escrow address. Treat that as an explicit design choice, not the default. When capture-now-decrypt-later risk matters, put a salted commitment in `OrderFilled` and deliver plaintext offchain through the same handoff channel as the contract secret key.
