# TypeScript Library Template Index

The generated TypeScript SDK files live as real files under `templates/project/packages/contracts/ts/src/`.
Copy these files into the target project, then adapt names and protocol-specific behavior as needed:

- `templates/project/packages/contracts/ts/src/artifacts/index.ts`
- `templates/project/packages/contracts/ts/src/constants.ts`
- `templates/project/packages/contracts/ts/src/utils.ts`
- `templates/project/packages/contracts/ts/src/fees.ts`
- `templates/project/packages/contracts/ts/src/contract.ts`
- `templates/project/packages/contracts/ts/src/manifest.ts`
- `templates/project/packages/contracts/ts/src/index.ts`

These files target Aztec `4.2.0`, `EmbeddedWallet`, NodeNext `.js` import suffixes, package imports such as `@aztec-otc-desk/contracts`, escrow `registerSender`, and `additionalScopes` for private escrow-owned note reads. `contract.ts` deploys a constructor-funded escrow, includes the maker funding authwit in deploy options, and starts lifecycle state at `OPEN`. It also includes `retrieveRoleSecret`, which scans caller-addressed `RoleAdded` events and returns the recovered secret. `manifest.ts` exports `EscrowManifest` for minimal secret-contract handoff, registration, JSON, base64, and encrypted transport. When adapting the project name, update both `packages/contracts/package.json` and `packages/contracts/tsconfig.json` paths. Preserve or add full JSDoc comments with `@param`/`@returns` tags for every generated function/method and `// Step N: ...` comments for multi-step protocol flows.
