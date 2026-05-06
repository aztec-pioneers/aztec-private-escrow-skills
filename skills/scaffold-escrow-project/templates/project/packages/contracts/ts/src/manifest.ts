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

export type EscrowManifest = {
    version: 1;
    kind: string;
    aztecVersion: string;
    deployment: {
        address: string;
        contractInstance: unknown;
        artifactName: string;
        constructorArgs: {
            sellTokenAddress: string;
            sellTokenAmount: string;
            buyTokenAddress: string;
            buyTokenAmount: string;
        };
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

export function createEscrowManifest(args: {
    instance: ContractInstanceWithAddress;
    contractSecretKey?: Fr;
    sellTokenAddress: AztecAddress;
    sellTokenAmount: bigint;
    buyTokenAddress: AztecAddress;
    buyTokenAmount: bigint;
    txHash?: string;
    kind?: string;
}): EscrowManifest {
    return {
        version: 1,
        kind: args.kind ?? "otc-atomic-swap",
        aztecVersion: "4.2.0",
        deployment: {
            address: args.instance.address.toString(),
            contractInstance: JSON.parse(JSON.stringify(args.instance)),
            artifactName: "OTCEscrow",
            constructorArgs: {
                sellTokenAddress: args.sellTokenAddress.toString(),
                sellTokenAmount: args.sellTokenAmount.toString(),
                buyTokenAddress: args.buyTokenAddress.toString(),
                buyTokenAmount: args.buyTokenAmount.toString(),
            },
            skipClassPublication: true,
            skipInstancePublication: true,
            txHash: args.txHash,
        },
        access: args.contractSecretKey
            ? {
                contractSecretKey: args.contractSecretKey.toString(),
                visibleCapabilities: [
                    "instantiate",
                    "read-shared-private-state",
                    "execute-private-calls",
                ],
            }
            : { visibleCapabilities: ["instantiate"] },
    };
}

export function getEscrowInstanceFromManifest(
    manifest: EscrowManifest,
): ContractInstanceWithAddress {
    return ContractInstanceWithAddressSchema.parse(manifest.deployment.contractInstance);
}

export function getContractSecretKeyFromManifest(
    manifest: EscrowManifest,
): Fr | undefined {
    const raw = manifest.access?.contractSecretKey;
    return raw ? Fr.fromString(raw) : undefined;
}

export async function registerEscrowFromManifest(
    wallet: Wallet,
    manifest: EscrowManifest,
): Promise<OTCEscrowContract> {
    const instance = getEscrowInstanceFromManifest(manifest);
    const contractSecretKey = getContractSecretKeyFromManifest(manifest);
    await wallet.registerContract(instance, OTCEscrowContractArtifact, contractSecretKey);
    await wallet.registerSender(instance.address);
    return OTCEscrowContract.at(AztecAddress.fromString(manifest.deployment.address), wallet);
}
