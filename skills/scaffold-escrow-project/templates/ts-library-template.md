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

These files target Aztec `4.2.0`, `EmbeddedWallet`, NodeNext runtime `.js` import suffixes, package imports such as `@aztec-otc-desk/contracts`, and `additionalScopes` for private cross-contract reads. When adapting the project name, update both `packages/contracts/package.json` and `packages/contracts/tsconfig.json` paths so tests can import through `@<project-scope>/contracts`.
