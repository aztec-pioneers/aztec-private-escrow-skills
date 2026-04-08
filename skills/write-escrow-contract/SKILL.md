---
name: write-escrow-contract
description: Guide for writing custom Aztec private escrow contracts in Noir with TypeScript integration. Includes templates for ConfigNote, escrow logic, and atomic swaps.
user-invocable: true
allowed-tools: Read Write Edit Bash Grep Glob
---

# Write a Custom Private Escrow Contract

Guide for creating new private escrow contracts on Aztec using the OTC Desk as reference.

## Escrow Architecture

An Aztec private escrow needs:
1. **ConfigNote** - Private note storing escrow parameters
2. **Constructor** - Initializes escrow with trade parameters, creates partial note commitment
3. **Deposit function** - Maker deposits offered tokens
4. **Fill function** - Taker deposits tokens, triggers atomic swap
5. **Nullifiers** - Prevent double-deposit and double-fill

## Contract Template

See `contract-template.md` in this skill directory for the full Noir contract template.

See `config-note-template.md` for the ConfigNote implementation.

## Nargo.toml

```toml
[package]
name = "my_escrow"
type = "contract"

[dependencies]
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "v4.0.0-devnet.2-patch.3", directory = "noir-projects/aztec-nr/aztec" }
token_contract = { path = "../../deps/aztec-standards/src/token_contract" }
poseidon = { git = "https://github.com/noir-lang/poseidon", tag = "v0.2.6" }
```

## TypeScript Integration

After compiling with `aztec compile` and `aztec codegen`:

```typescript
import { OTCEscrowContract, OTCEscrowContractArtifact } from "./artifacts/escrow/OTCEscrow";
import { Fr } from "@aztec/aztec.js/fields";
import { deriveKeys } from "@aztec/stdlib/keys";

// Deploy with unique encryption keys
const secretKey = Fr.random();
const publicKeys = (await deriveKeys(secretKey)).publicKeys;
const escrow = await OTCEscrowContract.deployWithPublicKeys(
    publicKeys, wallet,
    sellTokenAddress, sellAmount,
    buyTokenAddress, buyAmount
);
const instance = await escrow.getInstance();
await wallet.registerContract(instance, OTCEscrowContractArtifact, secretKey);
const contract = await escrow.send({ from: deployerAddress });
```

## Authorization Witnesses (Authwit) — v4.0.0-devnet.2-patch.3 Pattern

CRITICAL: Use this exact pattern for cross-contract token transfers:

```typescript
import { AuthWitness } from "@aztec/stdlib/auth-witness";

// 1. Build the function call data
const nonce = Fr.random();
const call = await token.withWallet(wallet).methods
    .transfer_private_to_private(from, to, amount, nonce)
    .getFunctionCall();

// 2. Create the auth witness (TWO arguments: from address, { caller, call })
const authwit = await wallet.createAuthWit(from, { caller: escrow.address, call });

// 3. Attach to the transaction via .with()
const receipt = await escrow.methods
    .deposit_tokens(nonce)
    .with({ authWitnesses: [authwit] })
    .send({ from });
```

DO NOT use `wallet.addAuthWitness()` separately — it doesn't work in v4.

## Key Patterns

1. **Private state**: `SinglePrivateImmutable` for config set once, read many times
2. **Authorization**: `.getFunctionCall()` + `wallet.createAuthWit(from, { caller, call })` + `.with({ authWitnesses })`
3. **Replay protection**: Custom nullifiers via `self.context.push_nullifier()`
4. **Atomic swaps**: Chain `self.call()` invocations - all succeed or all fail
5. **Partial notes**: `initialize_transfer_commitment` + `transfer_private_to_commitment` for private token receipt at contract address
6. **Message delivery**: Use `MessageDelivery.ONCHAIN_CONSTRAINED` for guaranteed note delivery
7. **Token deploy**: Use `TokenContract.deployWithOpts({ wallet, method: "constructor_with_minter" }, ...)` not plain `.deploy()`
