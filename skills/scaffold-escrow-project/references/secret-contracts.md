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

const deployment = EscrowContract.deployWithPublicKeys(
    publicKeys,
    wallet,
    ...constructorArgs,
);

const instance = await deployment.getInstance();

await wallet.registerContract(instance, EscrowContractArtifact, contractSecretKey);

const sendOpts = {
    from: deployer,
    skipClassPublication: true,
    skipInstancePublication: true,
    additionalScopes: [instance.address],
};

await deployment.simulate(sendOpts);
const { contract } = await deployment.send(sendOpts);
```

`additionalScopes: [instance.address]` is required when the constructor initializes contract-owned private storage that the deployer/PXE must read during proving.

If the address must be deterministic, use the same `contractAddressSalt` and address mode when computing the instance and sending the deployment. Do not compute an instance with one deployment shape and send with another.

## Participant Handoff

Participants need an escrow manifest. It should contain the contract address, serialized `ContractInstanceWithAddress`, contract secret key, deployment block number, and transaction hash.

The generated SDK imports the escrow artifact locally, so the manifest should not carry artifact name/hash, salt, deployer, skip-publication flags, or version metadata. If a recipient does not receive the contract secret key, they do not have a complete escrow manifest for shared private-state reads.

## When To Publish

Publish the class or instance when public functions, public discovery, contract upgrades, or non-participant callers need normal node-level lookup. Otherwise, prefer skipped class and instance publication for private-only escrows.
