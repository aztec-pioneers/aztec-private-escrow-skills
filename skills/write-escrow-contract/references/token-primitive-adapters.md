# Token Primitive Adapters

Do not hard-code the Aztec example token contract API into generalized escrow logic. The preferred token implementation is `defi-wonderland/aztec-standards`, and its method names and argument order may differ from reference examples.

Before writing concrete Noir or TypeScript calls, inspect the selected token contract source or generated binding and map the escrow's needed capabilities to that token's API.

## Required Capabilities

| Escrow capability | What it means | Authwit expectation |
|---|---|---|
| Private deposit into escrow | Participant transfers an offered asset into escrow-owned private state. | Participant authorizes the token call with escrow as caller. |
| Private refund from escrow | Escrow returns escrow-owned asset notes to maker/creator on `VOID` or recovery. | No participant spending authwit should be needed for escrow-owned notes; Noir role/phase checks still gate the action. |
| Private payout from escrow | Escrow releases maker's offered asset to the taker after delivery succeeds. | No taker spending authwit should be needed for escrow-owned notes; Noir role/phase checks still gate the action. |
| Private transfer to commitment | Escrow completes a maker-provided receive commitment or partial note. | Usually called from escrow-owned funds after taker consideration has entered escrow. |
| Proof-only delivery | Taker proves an offchain/onchain action without moving a token into escrow. | Authwit may be unnecessary unless the proof flow also moves assets. |

## Partial-Note Fill Pattern

For token-to-token settlement:

1. Maker creates a receive-side partial note or commitment in the order config.
2. The filler should be the escrow address, not the maker or taker.
3. The taker first transfers their asset privately into escrow-owned notes.
4. The escrow completes the maker's partial note from the escrow-owned balance. In the preferred token standard this may be the `transfer_private_to_commitment`-style primitive, but always confirm against the actual binding.
5. The escrow then releases the maker's offered asset to the taker.

This keeps participant addresses out of the receive path and makes the escrow the atomic settlement point.

## SDK Naming

Name SDK helpers by capability, not by one token contract method:

- `createPrivateDepositAuthwit`
- `createPrivateCommitmentFillCall`
- `depositOfferedAsset`
- `voidEscrow`
- `fillEscrow`

Inside those helpers, call the selected token binding's concrete methods.

## Contract Template Guidance

If the generated Noir imports a specific token contract, the contract must use that token's actual API. If supporting multiple token standards, create separate contract templates or small token-specific wrappers rather than pretending Noir can dynamically dispatch across incompatible contracts.
