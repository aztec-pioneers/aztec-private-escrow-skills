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
