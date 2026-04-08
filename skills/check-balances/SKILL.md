---
name: check-balances
description: Query private token balances of seller and buyer accounts on the Aztec localnet. Shows ETH and USDC balances.
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
ETH balance for seller: <amount in wei>
USDC balance for seller: <amount in wei>
ETH balance for buyer: <amount in wei>
USDC balance for buyer: <amount in wei>
==============================================
```

## Reading Values

| Raw Value | Human Readable |
|-----------|----------------|
| `10000000000000000000` | 10 ETH |
| `9000000000000000000` | 9 ETH |
| `1000000000000000000` | 1 ETH |
| `50000000000000000000000` | 50,000 USDC |
| `45000000000000000000000` | 45,000 USDC |
| `5000000000000000000000` | 5,000 USDC |

Both tokens use 18 decimals in this project.

## How It Works

Uses `balance_of_private()` on the Token contract via utility simulation (no transaction needed). Reads the private note tree for each account - fully private, reveals nothing on-chain.
