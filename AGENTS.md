# Aztec Private Escrow Skills

This repo contains Codex skills for building private escrow contracts and TypeScript SDKs on Aztec Network.

## What This Is

A skills-only repo — no application code. The `skills/` directory contains templates and instructions that teach Codex how to:
1. Scaffold an Aztec private escrow contract package from scratch
2. Write Noir smart contracts for private atomic swaps and generalized escrows
3. Generate TypeScript bindings and SDK helpers

## How To Use

Ask Codex to build a private escrow contract package on Aztec. The `scaffold-escrow-project` skill will be triggered automatically.

## Key Skills

- `scaffold-escrow-project` — Main skill. Creates contracts and TypeScript SDK from templates.
- `write-escrow-contract` — Noir contract + TypeScript templates with the authwit pattern.
- `build-escrow-contract` — Compile contracts and generate TS bindings.

## Aztec Version

All skills target **Aztec v4.2.0**. All `@aztec/*` packages are pinned at the same version via the root `package.json` `workspaces.catalog`. The wallet API is `EmbeddedWallet` from `@aztec/wallets/embedded`.

## Tokens are decimal-agnostic

The Noir contract uses `u128` amounts and doesn't care about decimals. Any display or denomination assumptions belong in downstream apps, not in the contract or SDK.
