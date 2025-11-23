import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { celo, celoSepolia } from 'viem/chains'

export const wagmiConfig = createConfig({
    chains: [celo, celoSepolia],
    transports: {
        [celo.id]: http(),
        [celoSepolia.id]: http(),
    },
    connectors: [injected({ shimDisconnect: true })],
    ssr: true,
})
