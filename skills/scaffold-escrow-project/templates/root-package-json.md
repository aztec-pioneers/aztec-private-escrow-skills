# Root package.json Template

```json
{
  "name": "aztec-otc-desk",
  "private": true,
  "workspaces": {
    "packages": ["packages/*"],
    "catalog": {
      "@aztec/aztec.js": "4.2.0",
      "@aztec/accounts": "4.2.0",
      "@aztec/constants": "4.2.0",
      "@aztec/entrypoints": "4.2.0",
      "@aztec/ethereum": "4.2.0",
      "@aztec/foundation": "4.2.0",
      "@aztec/noir-contracts.js": "4.2.0",
      "@aztec/pxe": "4.2.0",
      "@aztec/protocol-contracts": "4.2.0",
      "@aztec/stdlib": "4.2.0",
      "@aztec/wallets": "4.2.0",
      "@aztec/wallet-sdk": "4.2.0",
      "@types/bun": "latest",
      "typescript": "^5.0.0"
    }
  },
  "scripts": {
    "postinstall": "bun run scripts/token.ts"
  },
  "config": {
    "aztecVersion": "4.2.0",
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
    "./manifest": "./ts/src/manifest.ts",
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
    "@types/bun": "catalog:"
  },
  "peerDependencies": {
    "typescript": "catalog:"
  }
}
```

## Sub-package: packages/contracts/tsconfig.json

Use NodeNext and keep handwritten relative TS imports/exports suffixed with `.js`. Generated Aztec bindings may import JSON artifacts with explicit `.json` extensions.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["scripts/**/*.ts", "ts/src/**/*.ts"]
}
```

## .gitignore

```
node_modules/
target/
codegenCache.json
**/codegenCache.json
```

## Nargo.toml (packages/contracts/Nargo.toml)

```toml
[package]
name = "otc_escrow"
type = "contract"

[dependencies]
aztec = { git = "https://github.com/AztecProtocol/aztec-packages/", tag = "v4.2.0", directory = "noir-projects/aztec-nr/aztec" }
token_contract = { git = "https://github.com/defi-wonderland/aztec-standards/", tag = "dev", directory = "src/token_contract" }
poseidon = { git = "https://github.com/noir-lang/poseidon", tag = "v0.3.0" }
```

## scripts/token.ts (root postinstall)

This compiles the token artifact off of the `aztec-standards` submodule and copies the result into `packages/contracts/ts/src/artifacts/token/`. It runs automatically on `bun install` via the root `postinstall` script. The script initializes git only when `.git` is missing, then registers and checks out the `aztec-standards` submodule if it has not been added yet. `.gitmodules` alone is not enough.

```ts
#!/usr/bin/env bun
import { spawn } from "bun";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { config } from "../package.json" with { type: "json" };

interface ScriptOptions { skipSubmodules: boolean }
const AZTEC_STANDARDS_URL = "https://github.com/defi-wonderland/aztec-standards.git";
const AZTEC_STANDARDS_PATH = "deps/aztec-standards";

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

async function exec(cmd: string, args: string[] = [], cwd = ".") {
  if (!existsSync(cwd)) throw new Error(`cwd does not exist: ${cwd}`);
  const proc = spawn({ cmd: [cmd, ...args], cwd, stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${code})`);
}

async function ensureGitRepo() {
  if (existsSync(".git")) return;
  await exec("git", ["init"]);
}

async function ensureAztecStandards(skipSubmodules: boolean) {
  if (skipSubmodules) {
    if (!existsSync(AZTEC_STANDARDS_PATH)) {
      throw new Error(`${AZTEC_STANDARDS_PATH} is missing; run without --skip-submodules first`);
    }
    return;
  }

  await ensureGitRepo();

  if (!existsSync(`${AZTEC_STANDARDS_PATH}/.git`)) {
    await mkdir("deps", { recursive: true });
    await exec("git", [
      "submodule",
      "add",
      "--force",
      "-b",
      config.aztecStandardsVersion,
      AZTEC_STANDARDS_URL,
      AZTEC_STANDARDS_PATH,
    ]);
  }

  await exec("git", ["submodule", "update", "--init", "--recursive", "--remote"]);
  await exec("git", ["fetch", "--tags"], AZTEC_STANDARDS_PATH);
  await exec("git", ["checkout", config.aztecStandardsVersion], AZTEC_STANDARDS_PATH);
}

async function main() {
  const { skipSubmodules } = parseArgs();
  await ensureAztecStandards(skipSubmodules);
  if (skipSubmodules) {
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
