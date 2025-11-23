import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { celoSepolia } from 'viem/chains'

export const wagmiConfig = createConfig({
    chains: [celoSepolia],
    transports: {
        [celoSepolia.id]: http(),
    },
    connectors: [injected({ shimDisconnect: true })],
    ssr: true,
})
