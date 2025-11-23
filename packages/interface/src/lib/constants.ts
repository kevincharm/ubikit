export const PASSPORT_BOUND_NFT_ADDRESS = '0xFBF562a98aB8584178efDcFd09755FF9A1e7E3a2'.toLowerCase()
export const UBIDROP_ADDRESS = '0x347Aa06Fd1a911078D858d87c4D1AE59Be818538'

// Token addresses and decimals for Celo Sepolia
export const TOKEN_INFO = {
    USDC: {
        address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
        decimals: 6,
    },
} as const

export const TOKEN_ADDRESSES = Object.fromEntries(
    Object.entries(TOKEN_INFO).map(([symbol, info]) => [symbol, info.address]),
) as Record<keyof typeof TOKEN_INFO, string>

export type TokenSymbol = keyof typeof TOKEN_INFO
