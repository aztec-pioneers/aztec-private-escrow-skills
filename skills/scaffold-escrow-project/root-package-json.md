# Root package.json Template

```json
{
  "name": "aztec-otc-desk",
  "private": true,
  "workspaces": {
    "packages": ["packages/*"],
    "catalog": {
      "@aztec/aztec.js": "4.2.0-aztecnr-rc.2",
      "@aztec/accounts": "4.2.0-aztecnr-rc.2",
      "@aztec/constants": "4.2.0-aztecnr-rc.2",
      "@aztec/entrypoints": "4.2.0-aztecnr-rc.2",
      "@aztec/ethereum": "4.2.0-aztecnr-rc.2",
      "@aztec/foundation": "4.2.0-aztecnr-rc.2",
      "@aztec/noir-contracts.js": "4.2.0-aztecnr-rc.2",
      "@aztec/pxe": "4.2.0-aztecnr-rc.2",
      "@aztec/protocol-contracts": "4.2.0-aztecnr-rc.2",
      "@aztec/stdlib": "4.2.0-aztecnr-rc.2",
      "@aztec/wallets": "4.2.0-aztecnr-rc.2",
      "@aztec/wallet-sdk": "4.2.0-aztecnr-rc.2",
      "@types/bun": "latest",
      "dotenv": "^17.2.1",
      "typescript": "^5.0.0"
    }
  },
  "scripts": {
    "postinstall": "bun run scripts/token.ts"
  },
  "config": {
    "aztecVersion": "4.2.0-aztecnr-rc.2",
    "aztecStandardsVersion": "dev"
  }
}
```

All `@aztec/*` packages share one version, pinned via the root `workspaces.catalog`. The wallet API ships as `@aztec/wallets`. `packages/contracts/` is itself a JS package (it owns the codegen + artifact-copy scripts), so workspaces is `packages/*`.

## Sub-package: packages/contracts/package.json

```json
{
  "name": "@aztec-otc-desk/contracts",
  "type": "module",
  "main": "./ts/src/index.ts",
  "types": "./ts/src/index.ts",
  "exports": {
    ".": "./ts/src/index.ts",
    "./artifacts": "./ts/src/artifacts/index.ts",
    "./constants": "./ts/src/constants.ts",
    "./contract": "./ts/src/contract.ts",
    "./fees": "./ts/src/fees.ts",
    "./utils": "./ts/src/utils.ts"
  },
  "scripts": {
    "compile": "aztec compile",
    "codegen": "aztec codegen target --outdir ts/src/artifacts/escrow -f && rm ts/src/artifacts/escrow/Token.ts",
    "copy-artifacts": "bun run scripts/add_artifacts.ts",
    "build": "bun run compile && bun run codegen && bun run copy-artifacts"
  },
  "dependencies": {
    "@aztec/aztec.js": "catalog:",
    "@aztec/accounts": "catalog:",
    "@aztec/constants": "catalog:",
    "@aztec/entrypoints": "catalog:",
    "@aztec/ethereum": "catalog:",
    "@aztec/foundation": "catalog:",
    "@aztec/noir-contracts.js": "catalog:",
    "@aztec/pxe": "catalog:",
    "@aztec/stdlib": "catalog:",
    "@aztec/wallets": "catalog:"
  },
  "devDependencies": {
    "@types/bun": "catalog:",
    "dotenv": "catalog:"
  },
  "peerDependencies": {
    "typescript": "catalog:"
  }
}
```

## Sub-package: packages/api/package.json

```json
{
  "name": "@aztec-otc-desk/api",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "start": "bun run src/index.ts",
    "dev": "bun run --watch src/index.ts"
  },
  "devDependencies": {
    "@types/bun": "^1.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Sub-package: packages/cli/package.json

```json
{
  "name": "@aztec-otc-desk/cli",
  "type": "module",
  "private": true,
  "scripts": {
    "balances": "bun run scripts/print_balances.ts",
    "setup:accounts": "bun run scripts/setup_accounts.ts",
    "setup:deploy": "bun run scripts/deploy.ts",
    "setup:mint": "bun run scripts/mint.ts",
    "order:create": "bun run scripts/create_order.ts",
    "order:fill": "bun run scripts/buy_order.ts"
  },
  "devDependencies": {
    "@aztec/aztec.js": "catalog:",
    "@aztec/accounts": "catalog:",
    "@aztec/ethereum": "catalog:",
    "@aztec/noir-contracts.js": "catalog:",
    "@aztec/pxe": "catalog:",
    "@aztec/stdlib": "catalog:",
    "@aztec/wallets": "catalog:",
    "@aztec-otc-desk/contracts": "workspace:*",
    "@types/bun": "catalog:",
    "dotenv": "catalog:"
  },
  "peerDependencies": {
    "typescript": "catalog:"
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
packages/cli/scripts/data/accounts.json
```

## Nargo.toml (packages/contracts/Nargo.toml)

```toml
[package]
name = "otc_escrow"
type = "contract"

[dependencies]
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "v4.2.0-aztecnr-rc.2", directory = "noir-projects/aztec-nr/aztec" }
token_contract = { git = "https://github.com/defi-wonderland/aztec-standards/", tag = "dev", directory = "src/token_contract" }
poseidon = { git = "https://github.com/noir-lang/poseidon", tag = "v0.2.6" }
```

## scripts/token.ts (root postinstall)

This compiles the token artifact off of the `aztec-standards` submodule and copies the result into `packages/contracts/ts/src/artifacts/token/` (and `packages/contracts/target/` for TXE tests). It runs automatically on `bun install` via the root `postinstall` script.

```ts
#!/usr/bin/env bun
import { spawn } from "bun";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { config } from "../package.json" with { type: "json" };

interface ScriptOptions { skipSubmodules: boolean }

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  let skipSubmodules = false;
  for (const arg of args) {
    if (arg === "--skip-submodules") skipSubmodules = true;
    else { console.error(`Invalid option: ${arg}`); process.exit(1); }
  }
  return { skipSubmodules };
}

async function replaceInFile(filePath: string, search: string, replace: string) {
  const content = await readFile(filePath, "utf-8");
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await writeFile(filePath, content.replace(new RegExp(escaped, "g"), replace), "utf-8");
}

async function exec(cmd: string, args: string[] = [], cwd?: string) {
  const proc = spawn({ cmd: [cmd, ...args], cwd, stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${code})`);
}

async function main() {
  const { skipSubmodules } = parseArgs();
  if (!skipSubmodules) {
    await exec("git", ["submodule", "update", "--init", "--recursive", "--remote"]);
    await exec("git", ["fetch", "--tags"], "deps/aztec-standards");
    await exec("git", ["checkout", config.aztecStandardsVersion], "deps/aztec-standards");
  } else {
    if (existsSync("deps/aztec-standards/target"))
      await rm("deps/aztec-standards/target", { recursive: true, force: true });
  }

  await exec("aztec", ["compile", "--package", "token_contract"], "deps/aztec-standards");
  await exec("aztec", ["codegen", "./target/token_contract-Token.json", "-o", "./target", "-f"], "deps/aztec-standards");
  await exec("cp", ["./target/token_contract-Token.json", "../../packages/contracts/ts/src/artifacts/token/Token.json"], "deps/aztec-standards");
  await exec("cp", ["./target/Token.ts", "../../packages/contracts/ts/src/artifacts/token/Token.ts"], "deps/aztec-standards");
  await replaceInFile(
    "./packages/contracts/ts/src/artifacts/token/Token.ts",
    "./token_contract-Token.json",
    "./Token.json"
  );

  if (!existsSync("packages/contracts/target"))
    await mkdir("packages/contracts/target", { recursive: true });
  await exec("cp", ["./target/token_contract-Token.json", "../../packages/contracts/target/otc_escrow-Token.json"], "deps/aztec-standards");
}

if (import.meta.main) main();
```

## .gitmodules

```
[submodule "deps/aztec-standards"]
	path = deps/aztec-standards
	url = https://github.com/defi-wonderland/aztec-standards.git
	branch = dev
```
