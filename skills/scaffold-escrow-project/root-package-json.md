# Root package.json Template

```json
{
  "name": "aztec-otc-desk",
  "private": true,
  "workspaces": {
    "packages": ["packages/contracts/ts", "packages/api", "packages/cli"],
    "catalog": {
      "@aztec/aztec.js": "4.0.0-devnet.2-patch.3",
      "@aztec/accounts": "4.0.0-devnet.2-patch.3",
      "@aztec/stdlib": "4.0.0-devnet.2-patch.3",
      "@aztec/pxe": "4.0.0-devnet.2-patch.3",
      "@aztec/test-wallet": "4.0.0-devnet.1-patch.0",
      "@types/bun": "latest",
      "typescript": "^5.0.0"
    }
  },
  "overrides": {
    "@aztec/foundation": "4.0.0-devnet.2-patch.3",
    "@aztec/wallet-sdk": "4.0.0-devnet.2-patch.3",
    "@aztec/pxe": "4.0.0-devnet.2-patch.3",
    "@aztec/accounts": "4.0.0-devnet.2-patch.3",
    "@aztec/stdlib": "4.0.0-devnet.2-patch.3",
    "@aztec/aztec.js": "4.0.0-devnet.2-patch.3"
  },
  "scripts": {
    "build:contracts": "cd packages/contracts && aztec compile && aztec codegen target/otc_escrow-OTCEscrow.json --outdir artifacts -f"
  }
}
```

## Sub-package: packages/contracts/ts/package.json

```json
{
  "name": "@aztec-otc-desk/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./contract": "./src/contract.ts",
    "./constants": "./src/constants.ts",
    "./utils": "./src/utils.ts",
    "./fees": "./src/fees.ts",
    "./artifacts": "./src/artifacts/index.ts"
  },
  "devDependencies": {
    "@aztec/aztec.js": "catalog:",
    "@aztec/stdlib": "catalog:",
    "@aztec/test-wallet": "catalog:",
    "@types/bun": "catalog:"
  }
}
```

## Sub-package: packages/api/package.json

```json
{
  "name": "@aztec-otc-desk/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "bun run src/index.ts"
  },
  "devDependencies": {
    "@types/bun": "catalog:"
  }
}
```

## Sub-package: packages/cli/package.json

```json
{
  "name": "@aztec-otc-desk/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "setup:deploy": "bun run scripts/deploy.ts",
    "setup:mint": "bun run scripts/mint.ts",
    "order:create": "bun run scripts/create_order.ts",
    "order:fill": "bun run scripts/buy_order.ts",
    "balances": "bun run scripts/print_balances.ts"
  },
  "devDependencies": {
    "@aztec/aztec.js": "catalog:",
    "@aztec/accounts": "catalog:",
    "@aztec/stdlib": "catalog:",
    "@aztec/pxe": "catalog:",
    "@aztec/test-wallet": "catalog:",
    "@aztec-otc-desk/contracts": "workspace:*",
    "@types/bun": "catalog:",
    "dotenv": "^16.0.0"
  }
}
```

## .env (packages/cli/.env)

```
L2_NODE_URL=http://localhost:8080
API_URL=http://localhost:3000
```

## .gitignore

```
node_modules/
target/
*.sqlite
packages/cli/scripts/data/deployments.json
```

## Nargo.toml (packages/contracts/Nargo.toml)

```toml
[package]
name = "otc_escrow"
type = "contract"

[dependencies]
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "v4.0.0-devnet.2-patch.3", directory = "noir-projects/aztec-nr/aztec" }
token_contract = { path = "../../deps/aztec-standards/src/token_contract" }
poseidon = { git = "https://github.com/noir-lang/poseidon", tag = "v0.2.6" }
```
