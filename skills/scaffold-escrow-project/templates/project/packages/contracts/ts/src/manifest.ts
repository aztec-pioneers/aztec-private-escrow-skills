import {
    createCipheriv,
    createDecipheriv,
    createECDH,
    createHmac,
    hkdfSync,
    randomBytes,
    timingSafeEqual,
} from "node:crypto";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/aztec.js/fields";
import type { Wallet } from "@aztec/aztec.js/wallet";
import {
    ContractInstanceWithAddressSchema,
    type ContractInstanceWithAddress,
} from "@aztec/stdlib/contract";
import {
    OTCEscrowContract,
    OTCEscrowContractArtifact,
} from "./artifacts/index.js";

export type EscrowManifestData = {
    address: string;
    contractInstance: unknown;
    contractSecretKey: string;
    createdBlockNumber: number;
    txHash?: string;
};

export type ManifestEcdhCurve = "prime256v1" | "secp256k1";

export type ManifestKeyPair = {
    curve: ManifestEcdhCurve;
    publicKey: string;
    privateKey: string;
};

export type EncryptedEscrowManifest = {
    scheme: "ECDH+A128CBC-HS256";
    curve: ManifestEcdhCurve;
    ephemeralPublicKey: string;
    salt: string;
    iv: string;
    ciphertext: string;
    mac: string;
};

const MANIFEST_ENCRYPTION_SCHEME = "ECDH+A128CBC-HS256" as const;
const DEFAULT_MANIFEST_CURVE: ManifestEcdhCurve = "prime256v1";
const MANIFEST_KDF_INFO = Buffer.from("aztec-private-escrow-manifest", "utf8");

export class EscrowManifest {
    constructor(public readonly data: EscrowManifestData) { }

    static create(args: {
        instance: ContractInstanceWithAddress;
        contractSecretKey: Fr;
        createdBlockNumber: number;
        txHash?: string;
    }): EscrowManifest {
        return new EscrowManifest({
            address: args.instance.address.toString(),
            contractInstance: cloneJSON(args.instance),
            contractSecretKey: args.contractSecretKey.toString(),
            createdBlockNumber: args.createdBlockNumber,
            txHash: args.txHash,
        });
    }

    get address(): AztecAddress {
        return AztecAddress.fromString(this.data.address);
    }

    get contractSecretKey(): Fr {
        return Fr.fromString(this.data.contractSecretKey);
    }

    get contractInstance(): ContractInstanceWithAddress {
        const instance = ContractInstanceWithAddressSchema.parse(this.data.contractInstance);
        if (instance.address.toString() !== this.data.address) {
            throw new Error("Escrow manifest address does not match contract instance address");
        }
        return instance;
    }

    get createdBlockNumber(): number {
        return this.data.createdBlockNumber;
    }

    get txHash(): string | undefined {
        return this.data.txHash;
    }

    async register(wallet: Wallet): Promise<OTCEscrowContract> {
        const instance = this.contractInstance;
        await wallet.registerContract(instance, OTCEscrowContractArtifact, this.contractSecretKey);
        await wallet.registerSender(instance.address);
        return OTCEscrowContract.at(instance.address, wallet);
    }

    static fromJSON(data: EscrowManifestData): EscrowManifest {
        return new EscrowManifest(cloneJSON(data));
    }

    toJSON(): EscrowManifestData {
        return cloneJSON(this.data);
    }

    static fromString(raw: string): EscrowManifest {
        return EscrowManifest.fromJSON(JSON.parse(raw) as EscrowManifestData);
    }

    toString(space?: number): string {
        return JSON.stringify(this.toJSON(), null, space);
    }

    static fromBase64(encoded: string): EscrowManifest {
        return EscrowManifest.fromString(fromBase64(encoded).toString("utf8"));
    }

    toBase64(): string {
        return toBase64(Buffer.from(this.toString(), "utf8"));
    }

    encrypt(recipientPublicKey: string, opts: { curve?: ManifestEcdhCurve } = {}): string {
        const curve = opts.curve ?? DEFAULT_MANIFEST_CURVE;
        const ephemeralKey = createECDH(curve);
        ephemeralKey.generateKeys();

        const sharedSecret = ephemeralKey.computeSecret(fromBase64(recipientPublicKey));
        const salt = randomBytes(16);
        const { aesKey, macKey } = deriveManifestKeys(sharedSecret, salt);
        const iv = randomBytes(16);
        const cipher = createCipheriv("aes-128-cbc", aesKey, iv);
        const ciphertext = Buffer.concat([
            cipher.update(Buffer.from(this.toString(), "utf8")),
            cipher.final(),
        ]);

        const envelopeWithoutMac = {
            scheme: MANIFEST_ENCRYPTION_SCHEME,
            curve,
            ephemeralPublicKey: ephemeralKey.getPublicKey("base64"),
            salt: toBase64(salt),
            iv: toBase64(iv),
            ciphertext: toBase64(ciphertext),
        } satisfies Omit<EncryptedEscrowManifest, "mac">;

        const mac = createHmac("sha256", macKey)
            .update(authenticationPayload(envelopeWithoutMac))
            .digest("base64");

        return toBase64(Buffer.from(JSON.stringify({ ...envelopeWithoutMac, mac }), "utf8"));
    }

    static decrypt(encryptedManifest: string, recipientPrivateKey: string): EscrowManifest {
        const envelope = JSON.parse(fromBase64(encryptedManifest).toString("utf8")) as EncryptedEscrowManifest;
        if (envelope.scheme !== MANIFEST_ENCRYPTION_SCHEME) {
            throw new Error(`Unsupported manifest encryption scheme: ${envelope.scheme}`);
        }

        const recipientKey = createECDH(envelope.curve);
        recipientKey.setPrivateKey(fromBase64(recipientPrivateKey));
        const sharedSecret = recipientKey.computeSecret(fromBase64(envelope.ephemeralPublicKey));
        const { aesKey, macKey } = deriveManifestKeys(sharedSecret, fromBase64(envelope.salt));

        const mac = createHmac("sha256", macKey)
            .update(authenticationPayload(withoutMac(envelope)))
            .digest();
        const receivedMac = fromBase64(envelope.mac);
        if (receivedMac.length !== mac.length || !timingSafeEqual(receivedMac, mac)) {
            throw new Error("Invalid encrypted escrow manifest MAC");
        }

        const decipher = createDecipheriv("aes-128-cbc", aesKey, fromBase64(envelope.iv));
        const plaintext = Buffer.concat([
            decipher.update(fromBase64(envelope.ciphertext)),
            decipher.final(),
        ]);
        return EscrowManifest.fromString(plaintext.toString("utf8"));
    }
}

export function createManifestKeyPair(curve: ManifestEcdhCurve = DEFAULT_MANIFEST_CURVE): ManifestKeyPair {
    const key = createECDH(curve);
    key.generateKeys();
    return {
        curve,
        publicKey: key.getPublicKey("base64"),
        privateKey: key.getPrivateKey("base64"),
    };
}

function deriveManifestKeys(sharedSecret: Buffer, salt: Buffer): { aesKey: Buffer; macKey: Buffer } {
    const keyMaterial = Buffer.from(hkdfSync("sha256", sharedSecret, salt, MANIFEST_KDF_INFO, 48));
    return {
        aesKey: keyMaterial.subarray(0, 16),
        macKey: keyMaterial.subarray(16),
    };
}

function authenticationPayload(envelope: Omit<EncryptedEscrowManifest, "mac">): string {
    return JSON.stringify({
        scheme: envelope.scheme,
        curve: envelope.curve,
        ephemeralPublicKey: envelope.ephemeralPublicKey,
        salt: envelope.salt,
        iv: envelope.iv,
        ciphertext: envelope.ciphertext,
    });
}

function withoutMac(envelope: EncryptedEscrowManifest): Omit<EncryptedEscrowManifest, "mac"> {
    return {
        scheme: envelope.scheme,
        curve: envelope.curve,
        ephemeralPublicKey: envelope.ephemeralPublicKey,
        salt: envelope.salt,
        iv: envelope.iv,
        ciphertext: envelope.ciphertext,
    };
}

function cloneJSON<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function toBase64(value: Buffer): string {
    return value.toString("base64");
}

function fromBase64(value: string): Buffer {
    return Buffer.from(value, "base64");
}
