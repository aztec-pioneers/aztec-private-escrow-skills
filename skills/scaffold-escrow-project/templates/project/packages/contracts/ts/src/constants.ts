import { AztecAddress } from "@aztec/aztec.js/addresses";

export const TOKEN_METADATA = {
    usdc: { name: "USD Coin", symbol: "USDC", decimals: 6 },
    eth: { name: "Ether", symbol: "ETH", decimals: 18 }
}

export type EscrowConfig = {
    creator_pseudonym: bigint,
    partial_note: bigint,
    sell_token_address: AztecAddress,
    sell_token_amount: bigint,
    buy_token_address: AztecAddress,
    buy_token_amount: bigint,
};
