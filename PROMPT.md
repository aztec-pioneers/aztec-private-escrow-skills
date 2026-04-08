# Ready-to-Use Prompts

Copy any of these into Claude Code to get started. Make sure `aztec start --local-network` is running first.

---

## The One-Shot Prompt (recommended)

```
Build a private escrow system on Aztec where two parties can atomically swap tokens.
One party locks tokens in an escrow, the other fills it by providing the required
counter-token. Deploy everything to the running localnet and execute a full swap
to prove it works.
```

---

## Scaffold Only (no deploy)

```
Scaffold an Aztec private escrow project with Noir contracts, TypeScript SDK,
orderflow API, and CLI scripts. Don't deploy or run anything yet.
```

## Deploy & Run (project already exists)

```
Deploy the escrow infrastructure to the Aztec localnet and run a complete
private token swap end-to-end.
```

## Custom Escrow Contract

```
Write a new Aztec escrow contract in Noir where a seller can lock ETH and
set a price in USDC. A buyer can fill it by sending the exact USDC amount,
triggering a private atomic swap. Include the TypeScript integration code
with proper authwit patterns for v4.
```

## Test Everything

```
Run the end-to-end escrow test — deploy tokens, mint, create an order,
fill it, and verify all balances are correct after the swap.
```

## Explain the Architecture

```
Explain how the Aztec private escrow system works — the Noir contract,
partial notes, nullifiers, authwits, and the atomic swap flow.
```
