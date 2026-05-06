---
name: write-escrow-contract
description: Write or customize Aztec private escrow contracts in Noir with TypeScript integration. Use for secret contracts, contract-owned shared private state, ConfigNote templates, authwit patterns, role-gated private actions, or atomic swap logic.
allowed-tools: Read Write Edit Bash Grep Glob
---

# Write a Custom Private Escrow Contract

Guide for creating private escrow contracts on Aztec. Use the OTC Desk as the default example, but adapt the storage, roles, and lifecycle to the requested escrow protocol.

## Reference Loading

Load these only when relevant:

- `references/noir-private-state-patterns.md` - private state patterns for shared escrow data.
- `references/role-restriction-patterns.md` - role-secret pseudonym checks for maker/taker/filler and other role-gated flows.
- `references/sensitive-term-commitments.md` - commit-onchain/deliver-offchain handling for recoverable usernames, addresses, and account handles.
- `references/token-primitive-adapters.md` - token-standard-specific private transfer and partial-note primitives.
- `../scaffold-escrow-project/references/design-intake.md` - phase/timing/config-state confirmation for new escrow designs.
- `../scaffold-escrow-project/references/lifecycle-phases.md` - escrow phase graph and transition invariants.
- `../scaffold-escrow-project/references/secret-contracts.md` - TypeScript deployment and registration model.
- `../scaffold-escrow-project/references/manifest-schema.md` - offchain participant handoff fields.

## Escrow Architecture

A private escrow usually needs:
1. **Shared private state** - Contract-owned private notes storing terms, roles, and lifecycle state.
2. **Constructor** - Initializes private state with trade or escrow parameters.
3. **Lifecycle phases** - `CREATED`, `OPEN`, `VOID`, `ACCEPTED`, `SETTLEMENT_IN_PROGRESS`, and `FILLED` as needed by the escrow shape.
4. **Entry functions** - Deposit, fill, release, cancel, dispute, accept, advance settlement, or claim actions depending on the escrow shape.
5. **Role checks** - Noir-enforced maker/taker/arbiter/admin rules. The contract secret key is not a role check by itself.
6. **Fill receipts** - Every successful fill emits an `OrderFilled` private event to the escrow address with constrained onchain delivery.
7. **Replay posture** - Do not add custom fill/deposit nullifiers by default. Gate cancellation and successful fills through terminal phases in `StateNote`, including atomic one-shot flows.

## Design Intake

Before writing a new escrow contract or changing lifecycle/config/state structure, load `../scaffold-escrow-project/references/design-intake.md`. Confirm phase set, timing windows, and ambiguous config/state fields. If the user declines Plan mode or structured input, continue with explicit conservative assumptions.

## Companion Skills

When available, use Aztec and Noir development guidance together before writing or reviewing contract code. In Codex, prefer `aztec:aztec-developer` plus `noir-developer`; in Claude-style environments, use the equivalent `aztec-developer` plus `noir-developer` skills. Treat the Aztec skill as authoritative for private state, notes, wallet/PXE, authwits, deployment, and TypeScript integration, and the Noir skill as authoritative for `.nr` syntax, project shape, compilation, and `nargo` validation.

## Contract Template

See `templates/contract-template.md` in this skill directory for the full Noir contract template.

See `templates/config-note-template.md` for the ConfigNote implementation.

See `templates/state-note-template.md` for required mutable StateNote lifecycle state.

See `templates/role-secret-template.md` for caller-sampled role secrets, `RoleAdded` recovery events, and pseudonym checks.

See `templates/order-filled-event-template.md` for the required `OrderFilled` private event pattern.

## Nargo.toml

```toml
[package]
name = "my_escrow"
type = "contract"

[dependencies]
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "v4.2.0", directory = "noir-projects/aztec-nr/aztec" }
token_contract = { git = "https://github.com/defi-wonderland/aztec-standards/", tag = "dev", directory = "src/token_contract" }
poseidon = { git = "https://github.com/noir-lang/poseidon", tag = "v0.3.0" }
```

## TypeScript Integration

After compiling with `aztec compile` and `aztec codegen` (or `bun run build` from the contracts package):

```typescript
import { OTCEscrowContract, OTCEscrowContractArtifact } from "./artifacts/escrow/OTCEscrow.js";
import { Fr } from "@aztec/aztec.js/fields";
import { deriveKeys } from "@aztec/stdlib/keys";

// Deploy with unique contract encryption keys
const secretKey = Fr.random();
const creatorRoleSecret = Fr.random();
const publicKeys = (await deriveKeys(secretKey)).publicKeys;
const escrow = await OTCEscrowContract.deployWithPublicKeys(
    publicKeys, wallet,
    sellTokenAddress, sellAmount,
    buyTokenAddress, buyAmount,
    creatorRoleSecret,
);
const instance = await escrow.getInstance();
await wallet.registerContract(instance, OTCEscrowContractArtifact, secretKey);

// IMPORTANT: scope the escrow's own address into the deploy tx
// so the deployer can read its newly-written config note
const { contract } = await escrow.send({
    from: deployerAddress,
    additionalScopes: [instance.address],
});
```

## Authorization Witnesses (Authwit)

CRITICAL: Use this exact shape for cross-contract token transfers. The concrete token method and argument order are token-standard-specific; inspect the selected token binding/source instead of assuming the Aztec example token API.

```typescript
import { AuthWitness } from "@aztec/stdlib/auth-witness";
import { Fr } from "@aztec/aztec.js/fields";

// 1. Build the function call data with the selected token's private transfer primitive.
const nonce = Fr.random();
const call = await buildSelectedTokenPrivateTransferCall({
    token,
    wallet,
    from,
    to,
    amount,
    nonce,
});

// 2. Create the auth witness (TWO arguments: from address, { caller, call })
const authwit = await wallet.createAuthWit(from, { caller: escrow.address, call });

// 3. Attach to the transaction via .with(), and remember to scope
//    the escrow into the send so it can read its own config note.
const { receipt } = await escrow.methods
    .deposit_tokens(nonce, creatorRoleSecret)
    .with({ authWitnesses: [authwit] })
    .send({ from, additionalScopes: [escrow.address] });
```

## Key Patterns

1. **Capability split**: Artifact plus init data lets a participant instantiate/register the wrapper; the contract secret key is required to read contract-owned private state.
2. **Authorization**: `.getFunctionCall()` + `wallet.createAuthWit(from, { caller, call })` + `.with({ authWitnesses })`
3. **Cross-contract reads**: Pass `additionalScopes: [otherContract.address]` in the send opts so the caller's PXE can read notes the other contract owns (escrow config note, partial notes, etc.). Deploys/deposits/fills that touch another contract's notes need this in their send opts.
4. **Config vs state**: Immutable order terms belong in `ConfigNote`; mutable phase, cancellation/fill terminal state, runtime-bound taker/filler pseudonyms, and phase deadlines belong in `StateNote`.
5. **PrivateMutable reads**: A mutable private read consumes and recreates the note. Always deliver the replacement note, even if the function only inspected the state.
6. **Sensitive terms**: Store salted commitments for recoverable usernames, addresses, or account handles. Deliver plaintexts offchain through the same secure handoff channel as the contract secret key.
7. **Role secrets**: Do not create contract storage or mappings for role secrets. Have the caller sample a random `Field`, pass it into the role-creating call, hash `[caller.to_field(), role_secret]` inline with Poseidon2, store only the pseudonym as a `Field`, and emit `RoleAdded { secret }` to the caller. Atomic one-shot flows bind only the creator pseudonym by default. `ACCEPTED` binds the accepting caller's pseudonym at runtime; do not describe this as a designated-taker flow unless the user explicitly asks for allowlisting.
8. **Replay posture**: Do not use custom `self.context.push_nullifier()` guards for deposit/fill in the default escrow templates. Notes and token spends still create primitive nullifiers; `StateNote` terminal transitions provide the lifecycle guard.
9. **Atomic swaps**: Chain `self.call()` invocations — all succeed or all fail. Even one-shot atomic fills must transition `StateNote` to `FILLED` so they cannot be filled after `VOID` and so terminal state is durable.
10. **Order-filled event**: Emit `OrderFilled` from every successful fill and deliver it to `self.address` with `MessageDelivery.ONCHAIN_CONSTRAINED`. Use a no-payload receipt by default. Add fields only when the design intake explicitly confirms settlement requires event-carried data. In the SDK, scan with `wallet.getPrivateEvents` using `contractAddress: escrow.address`, `scopes: [escrow.address]`, `fromBlock` from the manifest creation block, and `toBlock` as the current block plus one.
11. **Partial notes**: For atomic onchain fills, usually token-to-token but not guaranteed, have the maker post a receive-side partial note with the escrow as filler; then complete it from escrow-owned funds with the selected token standard's private-to-commitment primitive.
12. **Message delivery**: Use `MessageDelivery.ONCHAIN_CONSTRAINED` for contract-owned shared notes and escrow-addressed fill events, and `MessageDelivery.ONCHAIN_UNCONSTRAINED` for `RoleAdded` events delivered to the caller themselves. Do not put sensitive plaintexts in onchain private logs unless the user explicitly chooses that delivery model.
13. **Time checks**: Use the anchor block timestamp, `self.context.get_anchor_block_header().timestamp()`, for phase deadlines.
14. **Token deploy**: Use `TokenContract.deployWithOpts({ wallet, method: "constructor_with_minter" }, ...)` not plain `.deploy()`
15. **Wallets**: In generated tests, use `EmbeddedWallet.create(node, { ephemeral: true, pxeConfig: { proverEnabled } })` from `@aztec/wallets/embedded`; helper args should default `proverEnabled` to `false`.
