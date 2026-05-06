# TypeScript Test Strategy

Generated escrow projects should use one monolithic Bun test file:

```text
packages/contracts/ts/test/escrow.test.ts
```

Use `bun:test`, a running local Aztec node, `EmbeddedWallet`, and `getInitialTestAccountsData`. Default `AZTEC_NODE_URL` to `http://localhost:8080`, and create wallets with `ephemeral: true` plus `pxeConfig: { proverEnabled }`. This means localnet, not public testnet.

Use a setup helper shaped like this so tests default to fast proving-off PXEs but can opt into proving when needed:

```ts
type TestWallet = {
  label: string;
  wallet: EmbeddedWallet;
  address: AztecAddress;
};

async function setupWallet(
  label: string,
  accountIndex: number,
  proverEnabled = false,
): Promise<TestWallet> {
  const wallet = await EmbeddedWallet.create(node, {
    ephemeral: true,
    pxeConfig: { proverEnabled },
  });
  const accountsData = await getInitialTestAccountsData();
  const account = accountsData[accountIndex];
  const registeredAccount = await wallet.createSchnorrAccount(
    account.secret,
    account.salt,
    account.signingKey,
  );
  return { label, wallet, address: registeredAccount.address };
}
```

Do not create temp PXE data directories for normal generated tests; ephemeral wallets are the default isolation mechanism.

## Validation Flow

Run localnet in one terminal:

```bash
bun run localnet
```

Then build and test the contracts package in another terminal:

```bash
cd packages/contracts
bun run build
bun run typecheck
bun run test
```

Prefer package imports in tests:

```ts
import {
  deployEscrowContract,
  deployTokenContract,
  depositToEscrow,
  fillOTCOrder,
} from "@aztec-otc-desk/contracts";

import {
  OTCEscrowContractArtifact,
  TokenContractArtifact,
} from "@aztec-otc-desk/contracts/artifacts";
```

When adapting the project name, update the contracts package name and `tsconfig.json` paths together. For a project named `private-orderflow`, use package scope `@private-orderflow/contracts`.

## Layout

```ts
describe("private escrow", () => {
  describe("secret contract key sharing", () => {});
  describe("atomic happy path", () => {});
  describe("void", () => {});
  describe("phase failures", () => {});
  describe("role pseudonym failures", () => {});
  describe("authwit and token failures", () => {});
  describe.skip("offchain delivery flows", () => {});
});
```

Keep local helper functions in the same file until the generated flow stabilizes:

- `setupWallets`
- `deployTokens`
- `registerTokenContracts`
- `expectPrivateBalance`
- `expectPhase`
- `expectRejects`
- `getOrderFilledEvents`

If the test helpers get large enough to justify extraction, put them under `{test_dir}/utils/utils.ts`, where `{test_dir}` is normally `packages/contracts/ts/test`. If there are many utilities, logically split additional files inside `{test_dir}/utils/` and re-export them from `utils.ts`.

## Required Passing Tests

1. Secret contract key leakage and handoff: exercise the full manifest transport path, not a direct key pass. Buyer deploys/builds the escrow manifest; seller first registers or instantiates only the contract instance without the manifest key and proves private config/state reads fail; seller creates a recipient manifest transport key with `createManifestKeyPair()`; buyer encrypts the manifest to the seller's public key with `manifest.encrypt(...)`; seller decrypts with `EscrowManifest.decrypt(...)`, calls `decryptedManifest.register(sellerWallet)`, and then proves private config/state reads succeed.
2. Atomic happy path: maker deposits, filler fills, balances move correctly, escrow balances are emptied, phase becomes `FILLED`, and `OrderFilled` is emitted.
3. Void before deposit: creator can move `CREATED -> VOID`; deposit/fill after void fail.
4. Void after deposit: creator can move `OPEN -> VOID`; offered tokens refund to creator; fill after void fails.

## Required Failure Tests

- Non-creator cannot deposit or void, even with the escrow secret key.
- Fill before deposit fails.
- Duplicate deposit fails.
- Duplicate fill fails.
- Void after fill fails.
- Missing authwit fails.
- Authwit for the wrong token or amount fails.
- Insufficient private balance fails.

For designs with `ACCEPTED` or `SETTLEMENT_IN_PROGRESS`, add tests that bind the accepting caller's role-secret pseudonym into state and reject later calls from a different pseudonym. Do not add time-window tests until the time pattern is explicitly implemented.

## Skipped Stubs

Use `describe.skip` or `test.skip` for zkEmail, zkTLS, Venmo, Amazon, locker-code, and other offchain delivery flows. Each skipped test should name the missing verifier/delivery primitive and the expected phase transition.
