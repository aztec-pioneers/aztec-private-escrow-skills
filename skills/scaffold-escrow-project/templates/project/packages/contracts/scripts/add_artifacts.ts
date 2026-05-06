#!/usr/bin/env bun

import { copyFile, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";

async function copyFileWithLog(src: string, dest: string): Promise<void> {
  try {
    await copyFile(src, dest);
    console.log(`Copied: ${src} -> ${dest}`);
  } catch (error) {
    throw new Error(`Failed to copy ${src} to ${dest}: ${error}`);
  }
}

async function replaceInFile(filePath: string, searchText: string, replaceText: string): Promise<void> {
  try {
    const content = await readFile(filePath, "utf-8");
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await writeFile(filePath, content.replace(new RegExp(escaped, "g"), replaceText), "utf-8");
    console.log(`Updated imports in: ${filePath}`);
  } catch (error) {
    throw new Error(`Failed to update file ${filePath}: ${error}`);
  }
}

async function main() {
  const scriptDir = dirname(import.meta.path);
  const contractsDir = join(scriptDir, "..");
  process.chdir(contractsDir);

  await copyFileWithLog(
    "./target/otc_escrow-OTCEscrow.json",
    "./ts/src/artifacts/escrow/OTCEscrow.json",
  );

  await replaceInFile(
    "./ts/src/artifacts/escrow/OTCEscrow.ts",
    "../../../../target/otc_escrow-OTCEscrow.json",
    "./OTCEscrow.json",
  );
}

if (import.meta.main) {
  main().catch(error => {
    console.error("Script failed:", error);
    process.exit(1);
  });
}
