# Agent Notes

This is a skills-only repo for Aztec private escrow scaffolding. Keep changes focused on `skills/` unless the user explicitly asks for repo tooling or documentation.

- Use `skill-creator` when editing skill instructions, templates, references, or metadata.
- For Noir or Aztec SDK behavior, also use `aztec:aztec-developer` and `noir-developer` when available.
- Target Aztec `4.2.0`, Bun, `EmbeddedWallet`, and NodeNext `.js` suffixes in generated TS.
- Generated projects should contain contracts plus a TypeScript SDK only: no API, CLI, demo app, or Aztec.nr/TXE tests for now.
- Do not bake token decimal assumptions into contracts or skills. Use decimal-aware display helpers only in generated TS/app layers.
