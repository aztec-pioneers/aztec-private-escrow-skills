# Escrow Instance Manifest

Use an escrow manifest for participant handoff. It is an offchain descriptor, not onchain state.

Separate instance knowledge from private-state access. A manifest may let a participant instantiate/register the contract without letting them read shared private notes.

## Shape

```typescript
export type EscrowManifest = {
    version: 1;
    kind: string;
    aztecVersion: string;
    createdAt?: string;

    deployment: {
        address: string;
        contractInstance: string;
        artifactName: string;
        artifactHash?: string;
        constructorArgs: unknown[];
        salt?: string;
        deployer?: string;
        publicKeys?: unknown;
        skipClassPublication?: boolean;
        skipInstancePublication?: boolean;
        txHash?: string;
    };

    access?: {
        contractSecretKey?: string;
        encryptedContractSecretKey?: string;
        encryptionScheme?: string;
        visibleCapabilities: Array<"instantiate" | "read-shared-private-state" | "execute-private-calls">;
    };

    roles?: Array<{
        name: string;
        address?: string;
        pseudonym?: string;
        commitment?: string;
        capabilities: string[];
    }>;

    lifecycle?: {
        phases: string[];
        initialPhase: string;
        terminalPhases: string[];
        immutableWindows?: Record<string, string>;
    };

    sensitiveTerms?: Array<{
        key: string;
        commitment: string;
        encryptedPlaintext?: string;
        encryptionScheme?: string;
    }>;

    metadata?: Record<string, unknown>;
};
```

## Semantics

- `deployment.contractInstance` should be the serialized `ContractInstanceWithAddress`.
- `access.contractSecretKey` is sensitive. If present, the recipient can register the contract with the key and read contract-owned private notes.
- If `access` is omitted or lacks key material, the manifest only provides instance/artifact/init knowledge.
- `roles` document expected business authority. Prefer `pseudonym` for role-secret based auth when the participant address should not be exposed in config. The Noir contract must still enforce those roles.
- `lifecycle` may document the intended phase graph and immutable timing windows for handoff UX. The contract's private state remains the source of truth.
- `sensitiveTerms` should contain commitments and optionally encrypted plaintext handoff material. Never include raw usernames, handles, addresses, or locker codes.

## Registration

To register a secret escrow from a manifest, parse the serialized contract instance, then call:

```typescript
await wallet.registerContract(instance, EscrowContractArtifact, contractSecretKey);
```

If no `contractSecretKey` is available, registration can still attach the artifact/instance, but reads of contract-owned private state should not be expected to work.
