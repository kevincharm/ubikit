export const PASSPORT_BOUND_NFT_ADDRESS = '0x9309bd93a8b662d315Ce0D43bb95984694F120Cb'.toLowerCase()
export const UBIDROP_ADDRESS = '0xb3a2EAB23AdC21eA78e1851Dd4b1316cb2275D9E'

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
