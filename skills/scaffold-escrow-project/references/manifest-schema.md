# Escrow Manifest

Use an escrow manifest as the offchain handoff object for a secret escrow contract. It is not contract state and should not mirror the role graph, phase graph, config note, or sensitive order terms.

The manifest has one job: carry the data another participant needs to register the escrow wrapper and read contract-owned private notes.

## Shape

```typescript
export type EscrowManifestData = {
    address: string;
    contractInstance: unknown; // serialized ContractInstanceWithAddress
    contractSecretKey: string;
    createdBlockNumber: number; // start event scans here
    txHash?: string;
};
```

Do not add default `kind`, Aztec/package version, artifact name/hash, salt, deployer, skip-publication flags, roles, lifecycle, or sensitive-term fields. The SDK already imports the escrow artifact locally, and `wallet.registerContract(instance, OTCEscrowContractArtifact, secretKey)` only needs the serialized instance and key.

If a future app or API needs order metadata, model that as a separate order object. Do not let the manifest become a generic order schema.

## SDK Class

Generate `EscrowManifest` as a class around `EscrowManifestData`:

- `EscrowManifest.create({ instance, contractSecretKey, createdBlockNumber, txHash })`
- `manifest.register(wallet)` returns the typed escrow contract after registering the instance and secret key
- `toJSON()` / `fromJSON(data)`
- `toString()` / `fromString(json)`
- `toBase64()` / `fromBase64(encodedJson)`
- `encrypt(recipientPublicKey)` / `EscrowManifest.decrypt(encrypted, recipientPrivateKey)`
- `createManifestKeyPair()` for the recipient transport keypair used by manifest encryption

Encryption is for transport. The default template uses ephemeral ECDH, HKDF-SHA256, AES-128-CBC, and HMAC-SHA256; callers should use the helper instead of passing the escrow secret key around directly. The encrypted output is still a string: base64-encoded JSON containing the ephemeral public key, IV, ciphertext, salt, and MAC.

The required leakage test must cover the full transport loop: seller fails to read shared private state before receiving the manifest, seller creates the recipient transport key, buyer encrypts the manifest to that key, seller decrypts/registers through `manifest.register(wallet)`, and seller can then read the shared private data.

## Registration

Registration should live on the class:

```typescript
const escrow = await EscrowManifest.fromString(serializedManifest).register(wallet);
```

The method should parse `contractInstance` with `ContractInstanceWithAddressSchema`, verify that the instance address matches `address`, then call:

```typescript
await wallet.registerContract(instance, OTCEscrowContractArtifact, contractSecretKey);
await wallet.registerSender(instance.address);
return OTCEscrowContract.at(instance.address, wallet);
```
