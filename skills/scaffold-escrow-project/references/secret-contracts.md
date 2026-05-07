# Secret Contracts

A secret escrow contract is not assumed to be publicly discoverable through `node.getContract(address)` or public bytecode/class publication. Participants receive the contract artifact and instance material out of band, then register the contract locally.

Use this pattern for private-only escrow contracts whose functions and state are meant to be known only to participants.

For secret escrows, prove existence from the deployment/initialization effects, such as the contract or initialization nullifier, instead of treating public bytecode lookup as the proof surface.

## Deploy Pattern

```typescript
import { Fr } from "@aztec/aztec.js/fields";
import { deriveKeys } from "@aztec/stdlib/keys";

const contractSecretKey = Fr.random();
const publicKeys = (await deriveKeys(contractSecretKey)).publicKeys;
const fundingNonce = Fr.random();

const deployOpts = {
    from: deployer,
    skipClassPublication: true,
    skipInstancePublication: true,
    universalDeploy: true,
    contractAddressSalt: Fr.random(),
};

const deployment = EscrowContract.deployWithPublicKeys(
    publicKeys,
    wallet,
    ...constructorArgs,
    fundingNonce,
);

const instance = await deployment.getInstance(deployOpts);

await wallet.registerContract(instance, EscrowContractArtifact, contractSecretKey);
await wallet.registerSender(instance.address);

const { authwit: fundingAuthwit } = await getPrivateTransferAuthwit(
    wallet,
    deployer,
    offeredToken,
    instance.address,
    instance.address,
    offeredAmount,
    fundingNonce,
);

const sendOpts = {
    ...deployOpts,
    additionalScopes: [instance.address],
    authWitnesses: [fundingAuthwit],
};

const { contract } = await deployment.send(sendOpts);
```

`registerContract(..., contractSecretKey)` gives the PXE the escrow keys. `registerSender(instance.address)` and `additionalScopes: [instance.address]` let the deployer PXE discover/read escrow-owned notes during deployment and later private calls.

When the constructor also funds the escrow, compute the final instance before creating the maker's token authwit. The token authwit should authorize the escrow instance address as caller, use the same nonce passed to the constructor, and be included in deploy `authWitnesses`.

If the address must be deterministic, use the same `contractAddressSalt` and address mode when computing the instance and sending the deployment. Do not compute an instance with one deployment shape and send with another.

## Participant Handoff

Participants need an escrow manifest. It should contain the contract address, serialized `ContractInstanceWithAddress`, contract secret key, deployment block number, and transaction hash.

The generated SDK imports the escrow artifact locally, so the manifest should not carry artifact name/hash, salt, deployer, skip-publication flags, or version metadata. If a recipient does not receive the contract secret key, they do not have a complete escrow manifest for shared private-state reads.

## When To Publish

Publish the class or instance when public functions, public discovery, contract upgrades, or non-participant callers need normal node-level lookup. Otherwise, prefer skipped class and instance publication for private-only escrows.
