# Design Intake

Use this intake before scaffolding a fresh escrow project or before changing lifecycle/config/state design. Keep it short; the goal is to prevent wrong protocol assumptions, not to run a workshop.

## When To Ask

Ask the intake questions when:

- the target project is not initialized yet;
- the user asks for a new escrow shape;
- phases, time windows, config fields, state fields, or settlement proofs are ambiguous;
- the `OrderFilled` event payload is ambiguous;
- adding `ACCEPTED`, `SETTLEMENT_IN_PROGRESS`, offchain delivery, zkTLS, zkEmail, Venmo-like payment, Amazon-like delivery, or timeout recovery.

Do not ask again when:

- the project already has a clear design in files or recent context;
- the user is continuing after compaction or a new Codex session and the design is recoverable;
- the user asks for a narrow implementation fix unrelated to phases/config/state.

## Plan Mode Nudge

For a fresh project, say once:

```text
This skill is best used in Plan mode first. I can still proceed here, but if you skip Plan mode you are asking me to make escrow-design assumptions that may need correction later.
```

If the user declines Plan mode, continue with the most conservative assumptions and make the assumptions explicit.

## Phase Selection

Always confirm phases when designing or changing lifecycle state.

Prefer the richest available input UI:

- If a multiselect UI is available, recommend a phase set and let the user toggle phases.
- If `request_user_input` is available but only supports mutually-exclusive choices, ask for one preset:
  - `Atomic`: `CREATED`, `OPEN`, `VOID`, `FILLED`
  - `Accept`: `CREATED`, `OPEN`, `VOID`, `ACCEPTED`, `FILLED`
  - `Delayed settlement`: `CREATED`, `OPEN`, `VOID`, `ACCEPTED`, `SETTLEMENT_IN_PROGRESS`, `FILLED`
- If no structured input is available, ask in chat:

```text
I recommend phases: CREATED, OPEN, VOID, [recommended optional phases], FILLED.
Reply "ok" or send the exact phase list you want.
```

Recommend based on the spec:

- Atomic one-shot onchain settlement: `Atomic`. This is usually token-to-token, but can be any delivery that settles fully and atomically onchain in one fill action.
- Offchain payment/proof where taker needs time after accepting: `Accept`.
- Cancellable/delayed delivery or delivery-initiation proof is not final delivery: `Delayed settlement`.

## Timing Windows

Always confirm timing windows when `ACCEPTED`, `SETTLEMENT_IN_PROGRESS`, or timeout recovery is present.

Defaults:

- `ACCEPTED` fill window: `1 hour`
- `SETTLEMENT_IN_PROGRESS` settlement window: `7 days`
- Recovery/void windows: infer from the spec; ask if not specified.

Ask compactly:

```text
Timing defaults: fill window 1 hour; settlement window 7 days. Reply "ok" or give replacements like "fill=30m settlement=3d".
```

If a structured input UI is available, use one question per timing family rather than a long form.

## Config vs State Fields

If there is any ambiguity, ask the user to confirm the field split before writing contracts.

Default split:

- `ConfigNote`: owner set to `self.address`, immutable creator pseudonym, offered asset, offered amount, requested asset/proof/delivery terms, partial note, immutable windows, salted commitments to sensitive terms.
- `StateNote`: owner set to `self.address`, phase, and only the bound taker/filler pseudonyms, timestamps, deadlines, or recovery metadata required by the selected phases.

Default role-secret bootstrap:

- A per-caller role secret is created under `role_secret.at(caller)`, delivered to that caller, and its pseudonym is stored in `ConfigNote` or `StateNote`.
- Atomic one-shot flows bind only the creator pseudonym by default.
- Taker/filler pseudonyms are bound only when `ACCEPTED`, delayed settlement, or another explicit role-restricted phase requires them.

Ask compactly:

```text
I’ll put immutable terms and creator pseudonym in ConfigNote, with owner=self.address, and phase fields in StateNote, also owner=self.address. Ambiguous fields: [list]. Confirm where they belong or tell me to infer.
```

Sensitive plaintexts such as usernames, account handles, addresses, locker codes, and emails should not go into onchain note messages. Store salted commitments and deliver plaintexts offchain with key material.

## OrderFilled Payload

Always decide the `OrderFilled` payload during intake. Default to no payload when the fill action settles atomically and the event is only a receipt.

Ask compactly when settlement may need event-carried data:

```text
OrderFilled can be a no-payload receipt. Does settlement require the event to carry any data, such as a delivery/proof commitment or scalar handoff payload? Reply "none" or list the exact fields.
```

Rules:

- Do not add placeholder fields for future flexibility.
- Do not include random values, zero-filled delivery slots, partial-note commitments, filler pseudonyms, or token-settlement metadata unless the user explicitly chooses those fields.
- For atomic token settlement, use a no-payload `OrderFilled` unless the user states a specific payload requirement.
- For sensitive recoverable terms, prefer salted commitments in config/state and offchain plaintext handoff.
