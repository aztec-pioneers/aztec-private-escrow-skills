# Aztec Private Escrow Skills

This repo contains Claude Code skills for building private escrow systems on Aztec Network.

## What This Is

A skills-only repo — no application code. The `.claude/skills/` directory contains templates and instructions that teach Claude Code how to:
1. Scaffold a complete Aztec private escrow project from scratch
2. Write Noir smart contracts for private atomic swaps
3. Deploy and run the full flow on an Aztec localnet

## How To Use

Start the Aztec localnet (`aztec start --local-network`), then ask Claude to build a private escrow system. The `scaffold-escrow-project` skill will be triggered automatically.

## Key Skills

- `scaffold-escrow-project` — Main skill. One-shot creates the entire project from templates.
- `write-escrow-contract` — Noir contract + TypeScript templates with correct v4 authwit patterns.
- `build-escrow-contract` — Compile contracts and generate TS bindings.
- `deploy-escrow` — Deploy infrastructure to localnet. Documents critical dependency overrides.
- `one-shot-escrow` / `test-escrow` — Run and verify the full flow.

## Aztec Version

All skills target **Aztec v4.0.0-devnet.2-patch.3**. The `@aztec/test-wallet` package is pinned at `4.0.0-devnet.1-patch.0` (only version available on npm).

## Critical: Dependency Overrides

The generated project MUST include overrides in root package.json to force all `@aztec/*` transitive deps to `4.0.0-devnet.2-patch.3`. Without this, `@aztec/test-wallet` pulls older versions causing "Artifact does not match expected class id" errors. This is documented in the `scaffold-escrow-project` and `deploy-escrow` skills.
