# Escrow Lifecycle Phases

Use phases as protocol state, not UI labels. Store lifecycle state in contract-owned private state so authorized participants can share a private view without making the order publicly discoverable.

Keep immutable terms in `ConfigNote` and mutable lifecycle fields in `StateNote`. Atomic one-shot flows still use `StateNote` so `VOID` and `FILLED` are durable terminal phases.

Before implementing lifecycle state for a fresh project, confirm the phase set with the user. Use a multiselect UI if available; otherwise recommend a preset and ask the user to reply `ok` or provide the exact phase list.

## Core Phases

| Phase | Meaning | Typical next phases |
|---|---|---|
| `OPEN` | Constructor has written config, funded the escrow with the maker's offered asset, and initialized state. The order can now be filled, accepted, or voided according to its rules. | `ACCEPTED`, `FILLED`, `VOID` |
| `VOID` | Terminal cancellation/refund state. Return whatever the escrow owns to the maker/creator using the selected asset's private transfer primitive. | terminal |
| `ACCEPTED` | Optional reservation state for non-atomic fills. The accepting caller's role-secret pseudonym is stored in state so the maker cannot void while that caller is actively trying to fill. | `FILLED`, `SETTLEMENT_IN_PROGRESS`, explicit timeout/recovery path |
| `SETTLEMENT_IN_PROGRESS` | Optional delayed-settlement state. The taker has proven an action or initiated delivery, but final release requires later proof, delivery, or timeout handling. | `FILLED`, explicit timeout/recovery/dispute path |
| `FILLED` | Terminal successful settlement. Delivery was proven or performed and escrowed assets were released according to the order terms. | terminal |

## Defaults

- Default constructors both create the escrow and privately fund it with the maker's offered asset. The initial state is `OPEN`; do not add a separate unfunded pre-open phase unless the user explicitly asks for a legacy two-step funding flow.
- For atomic one-shot onchain settlement, use `OPEN -> FILLED` with `VOID` before fill. This is usually token-to-token, but can be any delivery that settles fully in one onchain fill action.
- Add `ACCEPTED` when filling requires offchain action or proof generation and the taker needs protection from maker cancellation.
- `ACCEPTED` is runtime caller binding, not a default allowlist. Unless the user explicitly wants a pre-authorized counterparty, any caller may accept by sampling or presenting their own role secret and writing its caller-bound pseudonym into `StateNote`.
- Add `SETTLEMENT_IN_PROGRESS` when proof of initiation is not proof of final delivery, such as cancellable ecommerce orders or locker-style deliveries that still need a recipient handoff.
- Default `ACCEPTED` fill window to 1 hour unless the user specifies otherwise.
- Default `SETTLEMENT_IN_PROGRESS` settlement window to 7 days unless the user specifies otherwise.

## Invariants

1. Terminal phases are exclusive. An order must not become both `VOID` and `FILLED`.
2. Stateful phase transitions should consume or replace the prior phase/state note. Do not add custom transition nullifiers in the default templates.
3. `VOID` after `ACCEPTED` or `SETTLEMENT_IN_PROGRESS` must be an explicit timeout/recovery rule, not an implicit maker escape hatch.
4. Time windows such as accept, fill, settlement, or recovery windows should be immutable contract configuration once deployed.
5. Role/auth rules belong in Noir entrypoints. Contract secret key possession may let someone read shared state, but it is not itself maker/taker authority. Store creator pseudonyms in config during construction; store taker/filler pseudonyms in state only when a runtime transition such as `ACCEPTED` binds the caller. Later role-gated calls pass the same role secret and recompute the caller-bound pseudonym inline.
6. Token method names are token-standard-specific. The lifecycle should name capabilities like constructor funding, refund, payout, and commitment completion instead of hard-coding one token contract API.
7. Mutable phase reads/replacements must deliver the replacement `StateNote`.
8. Use the anchor block timestamp for deadline checks.
9. Every successful `FILLED` transition should emit an `OrderFilled` private event to the escrow address with `MessageDelivery.ONCHAIN_CONSTRAINED`.
10. One-shot atomic settlement is terminal-phase-gated in `StateNote`, not custom-nullifier-gated. A completed or voided order should not be fillable again without an explicit new order/state reset design.

## Token-to-Token Partial Notes

For token-to-token fills where the maker should receive privately:

1. The maker posts a partial note or commitment in the order config for the asset they intend to receive.
2. Set the partial-note filler to the escrow contract, not either participant, so participant addresses are not exposed through the receive path.
3. During fill, the taker's asset first moves privately into the escrow.
4. The escrow completes the maker's partial note from the escrow-owned balance, for example with the selected token standard's private-to-commitment primitive.
5. Only after delivery succeeds should the escrow release the maker's offered asset to the taker.

## Delivery Shapes

`FILLED` can mean different things depending on the escrow:

- Token-to-token: taker transfers into escrow, escrow completes maker's partial note, escrow pays taker.
- Proof-only delivery: taker submits a zkTLS/zkEmail/private proof matching config, then escrow pays taker.
- Private message delivery: ask during intake whether `OrderFilled` must carry a delivery commitment or intentionally event-carried scalar payload beyond the required `filled: true` marker. If not explicitly required, keep only the boolean receipt marker and deliver plaintext offchain or through a separate purpose-built event/note.
- Delayed delivery: taker proves initiation, phase advances to `SETTLEMENT_IN_PROGRESS`, and final release waits for delivery proof or configured timeout handling.
