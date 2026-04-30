# Aztec Private Escrow Skills

This repo contains Claude Code skills for building private escrow systems on Aztec Network.

## What This Is

A skills-only repo — no application code. The `skills/` directory contains templates and instructions that teach Claude Code how to:
1. Scaffold a complete Aztec private escrow project from scratch
2. Write Noir smart contracts for private atomic swaps
3. Deploy and run the full flow on an Aztec localnet

## How To Use

Start the Aztec localnet (`aztec start --local-network`), then ask Claude to build a private escrow system. The `scaffold-escrow-project` skill will be triggered automatically.

## Key Skills

- `scaffold-escrow-project` — Main skill. One-shot creates the entire project from templates.
- `write-escrow-contract` — Noir contract + TypeScript templates with the authwit pattern.
- `build-escrow-contract` — Compile contracts and generate TS bindings.
- `deploy-escrow` — Deploy infrastructure to localnet.
- `one-shot-escrow` / `test-escrow` — Run and verify the full flow.

## Aztec Version

All skills target **Aztec v4.2.0-aztecnr-rc.2**. All `@aztec/*` packages are pinned at the same version via the root `package.json` `workspaces.catalog`. The wallet API is `EmbeddedWallet` from `@aztec/wallets/embedded`.

## Tokens are decimal-agnostic

The Noir contract uses `u128` amounts and doesn't care about decimals. Any decimals/wad numbers in the templates (e.g. ETH=18, USDC=6) are CLI demo defaults — the consumer picks. Don't bake decimal assumptions into the skills.
