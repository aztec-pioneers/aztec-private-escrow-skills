---
name: check-balances
description: Query private token balances of seller and buyer accounts on the Aztec localnet.
allowed-tools: Bash
---

# Check Private Token Balances

Query the private token balances of seller and buyer accounts.

## Prerequisites

- Localnet running on port 8080
- Token contracts deployed (`/deploy-escrow`)

## Run

```bash
cd ${CLAUDE_SKILL_DIR}/../../aztec-otc-desk/packages/cli
bun run balances
```

## Output Format

```
==================[Balances]==================
ETH balance for seller: <amount in token base units>
USDC balance for seller: <amount in token base units>
ETH balance for buyer: <amount in token base units>
USDC balance for buyer: <amount in token base units>
==============================================
```

Values are reported in the token's base units (raw `u128`). Decimals are arbitrary per-token and the responsibility of whoever deployed the tokens; the contract is decimal-agnostic.

## How It Works

Uses `balance_of_private()` on the Token contract via utility simulation (no transaction needed). Reads the private note tree for each account — fully private, reveals nothing on-chain.
