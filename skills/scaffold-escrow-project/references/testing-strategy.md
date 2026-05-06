# TypeScript Test Strategy

Generated escrow projects should use one monolithic Bun test file:

```text
packages/contracts/ts/test/escrow.test.ts
```

Use `bun:test`, a running local Aztec node, `EmbeddedWallet`, and `getInitialTestAccountsData`. Default `AZTEC_NODE_URL` to `http://localhost:8080`, and create wallets with `pxeConfig: { proverEnabled: false }`. This means localnet, not public testnet.

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
- `registerEscrowWithKey`
- `expectPrivateBalance`
- `expectPhase`
- `expectRejects`
- `getOrderFilledEvents`

## Required Passing Tests

1. Secret contract key leakage: a wallet without the contract secret key cannot read contract-owned private config/state; the same wallet can read after `registerContract(instance, artifact, contractSecretKey)`.
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
