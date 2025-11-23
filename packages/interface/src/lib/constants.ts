export const PASSPORT_BOUND_NFT_ADDRESS = '0x993B9220067eAC7bB63790cfd5966032dc01949f'.toLowerCase()
export const UBIDROP_ADDRESS = '0xE537f0394C84bbA5536400aD0f2Fc9Bb7A46791d'

// Token addresses and decimals for Celo Sepolia
export const TOKEN_INFO = {
    USDC: {
        address: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
        decimals: 6,
    },
} as const

export const TOKEN_ADDRESSES = Object.fromEntries(
    Object.entries(TOKEN_INFO).map(([symbol, info]) => [symbol, info.address]),
) as Record<keyof typeof TOKEN_INFO, string>

export type TokenSymbol = keyof typeof TOKEN_INFO
