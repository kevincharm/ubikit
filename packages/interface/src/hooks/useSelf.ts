import { useQuery } from '@tanstack/react-query'
import { SelfAppBuilder } from '@selfxyz/qrcode'
import { useAccount } from 'wagmi'
import { PASSPORT_BOUND_NFT_ADDRESS } from '../lib/constants'

export function useSelf() {
    const { address } = useAccount()

    return useQuery({
        queryKey: ['self.proof.thingy', address],
        enabled: Boolean(address),
        queryFn: () =>
            new SelfAppBuilder({
                version: 2,
                appName: 'Bitcoin UBI Kit',
                scope: 'ibt.ubikit',
                endpoint: PASSPORT_BOUND_NFT_ADDRESS.toLowerCase(),
                logoBase64: 'https://i.postimg.cc/mrmVf9hm/self.png',
                userId: address,
                endpointType: 'celo',
                userIdType: 'hex',
                disclosures: {
                    minimumAge: 21,
                    ofac: false,
                    excludedCountries: [],
                    issuing_state: true,
                    expiry_date: true,
                },
            }).build(),
    })
}
