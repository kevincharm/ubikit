import { useReadContract, useConnection } from 'wagmi'
import { passportBoundNftAbi } from '../abis/passportBoundNftAbi'
import { getAddress, type Address } from 'viem'
import { PASSPORT_BOUND_NFT_ADDRESS } from '../lib/constants'
import { useMemo } from 'react'

export function usePassportBoundNft() {
    const { address } = useConnection()

    const { data: balance, ...rest } = useReadContract({
        abi: passportBoundNftAbi,
        address: getAddress(PASSPORT_BOUND_NFT_ADDRESS),
        functionName: 'balanceOf',
        args: address ? [address as Address] : undefined,
        query: {
            enabled: Boolean(address),
            refetchInterval: 1000,
        },
    })

    const hasMinted = useMemo(() => {
        return typeof balance === 'bigint' ? balance > 0n : null
    }, [balance])

    return {
        hasMinted,
        ...rest,
    }
}
