# Aztec Private Escrow Skills

Claude Code skills for vibecoding private escrows on [Aztec](https://aztec.network/) — the privacy-first L2. Give Claude a prompt, and it scaffolds, deploys, and runs a fully private atomic swap system using zero-knowledge proofs.

## What This Does

These skills teach Claude Code how to build a complete private OTC escrow system on Aztec:

- **Noir smart contracts** — escrow logic with private state, partial notes, and nullifier-based replay protection
- **TypeScript SDK** — deploy, deposit, fill, and query escrow contracts
- **Orderflow API** — HTTP service for posting and discovering escrow orders (SQLite-backed)
- **CLI scripts** — deploy tokens, mint, create orders, fill orders, check balances

The entire swap is **atomic and private** — zero-knowledge proofs ensure no one can see trade details, balances, or identities on-chain.

## Quick Start

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| [Aztec CLI](https://docs.aztec.network/) | `4.0.0-devnet.2-patch.3` | `curl -s https://install.aztec.network | bash` then `aztec-up 4.0.0-devnet.2-patch.3` |
| [Bun](https://bun.sh/) | 1.x | `curl -fsSL https://bun.sh/install \| bash` |
| [Claude Code](https://claude.ai/code) | Latest | `npm install -g @anthropic-ai/claude-code` |

### Install to all your agents

```bash
npx skills install aztec-pioneers/aztec-private-escrow-skills
```

### 1. Start the Aztec localnet

```bash
aztec start --local-network
```

Wait until `curl http://localhost:8080/status` returns `OK`.

### 2. Clone this repo and run Claude Code

```bash
git clone <this-repo>
cd <this-repo>
claude
```

### 3. Give it the prompt

Paste this into Claude Code:

```
Build a private escrow system on Aztec where two parties can atomically swap tokens.
One party locks tokens in an escrow, the other fills it by providing the required
counter-token. Deploy everything to the running localnet and execute a full swap
to prove it works.
```

Claude will:
1. Scaffold the project using the `scaffold-escrow-project` skill
2. Write all Noir contracts + TypeScript code from templates
3. Compile token artifacts or copy pre-built ones
4. Install dependencies with correct version overrides
5. Start the orderflow API
6. Deploy ETH + USDC tokens, mint to test accounts
7. Create an escrow order (deploy escrow contract, deposit 1 ETH)
8. Fill the order as the buyer (atomic swap: 5,000 USDC for 1 ETH)
9. Verify final balances match expectations

## Skills Reference

| Skill | What it does |
|-------|-------------|
| `scaffold-escrow-project` | One-shot scaffolds the entire project from templates — contracts, TS library, API, CLI |
| `write-escrow-contract` | Guide + templates for writing Noir escrow contracts with correct authwit patterns |
| `build-escrow-contract` | Compile Noir contracts and generate TypeScript bindings |
| `deploy-escrow` | Deploy token infrastructure + start API on localnet |
| `create-escrow-order` | Deploy escrow contract, deposit tokens, post order to API |
| `fill-escrow-order` | Fill an order as the buyer — atomic swap via ZK proofs |
| `check-balances` | Query private token balances for seller and buyer |
| `one-shot-escrow` | Run the entire flow (deploy → mint → create → fill → verify) in one go |
| `test-escrow` | End-to-end test with step-by-step assertions |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Aztec Localnet (port 8080)            │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │ ETH Token│  │USDC Token│  │  OTCEscrow Contract │   │
│  │ Contract │  │ Contract │  │  (per-order deploy) │   │
│  └──────────┘  └──────────┘  └────────────────────┘   │
│                                                         │
│  Private State:                                         │
│  - ConfigNote (sell/buy token, amounts, partial note)   │
│  - Nullifiers (prevent double-deposit & double-fill)    │
│  - Partial notes (private token receipt)                │
└─────────────────────────────────────────────────────────┘
          │                           │
          ▼                           ▼
┌──────────────────┐       ┌──────────────────────┐
│   Seller (CLI)   │       │    Buyer (CLI)        │
│                  │       │                       │
│ 1. Deploy escrow │       │ 4. Fetch order from   │
│ 2. Deposit ETH   │       │    orderflow API      │
│ 3. Post order    │       │ 5. Fill order (swap)  │
│    to API        │       │ 6. Close order        │
└──────────────────┘       └──────────────────────┘
          │                           │
          ▼                           ▼
┌─────────────────────────────────────────────────┐
│          Orderflow API (port 3000)              │
│          SQLite · POST/GET/DELETE /order         │
└─────────────────────────────────────────────────┘
```

### Swap Flow

```
Seller                         Escrow Contract                      Buyer
  │                                  │                                │
  │── deploy(sell=ETH, buy=USDC) ──▶│                                │
  │── deposit_tokens(1 ETH) ──────▶│                                │
  │── post order to API ──────────▶│                                │
  │                                  │                                │
  │                                  │◀── fill_order(5000 USDC) ─────│
  │                                  │    ┌─────────────────────┐    │
  │                                  │    │ ATOMIC (all or none)│    │
  │                                  │    │ 1. USDC → escrow    │    │
  │◀── 5000 USDC (partial note) ────│    │ 2. USDC → seller    │    │
  │                                  │────│ 3. ETH → buyer      │───▶│
  │                                  │    │ 4. emit nullifier   │    │
  │                                  │    └─────────────────────┘    │
```

## Alternative Prompts

Different ways to use these skills:

**Full project from scratch:**
```
Create a complete Aztec private escrow project that allows two parties to do trustless
token swaps. One party locks their tokens in an escrow contract, and the other party
can claim those tokens by providing the correct amount of a different token. The swap
should be atomic and fully private using zero-knowledge proofs. Set up the full
infrastructure, deploy to localnet, and run end-to-end.
```

**Just scaffold (no run):**
```
Scaffold an Aztec private escrow project with Noir contracts, TypeScript SDK,
orderflow API, and CLI scripts. Don't deploy or run anything yet.
```

**Run on existing project:**
```
Deploy the escrow infrastructure to localnet and execute a full swap.
```

**Write a custom escrow contract:**
```
Write a new Aztec escrow contract in Noir that swaps Token A for Token B with
a configurable exchange rate. Include the TypeScript integration code.
```

**Test the system:**
```
Run the end-to-end escrow test and verify all balances are correct after the swap.
```

## Key Technical Details

### Dependency Gotchas (captured in skills)

- `@aztec/test-wallet` only exists at `4.0.0-devnet.1-patch.0` — all other `@aztec/*` packages are at `4.0.0-devnet.2-patch.3`
- Root `package.json` MUST have `overrides` for `@aztec/foundation`, `@aztec/wallet-sdk`, `@aztec/pxe`, `@aztec/accounts`, `@aztec/stdlib`, `@aztec/aztec.js` — without these, transitive deps cause class ID mismatches
- Token artifacts must be compiled with the matching `aztec` CLI version
- Always `bun install --ignore-scripts` then `rm -rf node_modules/@aztec/test-wallet/node_modules/@aztec`

### Authwit Pattern (v4)

```typescript
// 1. Build call data
const call = await token.methods.transfer(...).getFunctionCall();
// 2. Create witness (TWO args)
const authwit = await wallet.createAuthWit(from, { caller, call });
// 3. Attach to tx
await escrow.methods.deposit(nonce).with({ authWitnesses: [authwit] }).send();
```

## Project Structure (generated)

```
aztec-otc-desk/
├── package.json              # Workspaces + catalog + overrides
├── deps/aztec-standards/     # Token contract source (git submodule)
├── packages/
│   ├── contracts/
│   │   ├── Nargo.toml        # Noir dependencies
│   │   ├── src/main.nr       # OTCEscrow contract
│   │   └── ts/src/           # TypeScript SDK
│   │       ├── contract.ts   # deploy, deposit, fill, balance functions
│   │       └── artifacts/    # Compiled contract bindings
│   ├── api/src/              # Orderflow HTTP API (Bun + SQLite)
│   └── cli/scripts/          # CLI: deploy, mint, create, fill, balances
```

## License

MIT
