import { useReadContract } from 'wagmi'
import { passportBoundNftAbi } from '../abis/passportBoundNftAbi'
import { getAddress } from 'viem'
import { PASSPORT_BOUND_NFT_ADDRESS } from '../lib/constants'

/**
 * Hook to fetch the totalSupply from PassportBoundNFT contract.
 * This represents the number of eligible addresses for UBIDrop.
 */
export function useUbiDropTotalSupply() {
    const { data: totalSupply, ...rest } = useReadContract({
        abi: passportBoundNftAbi,
        address: getAddress(PASSPORT_BOUND_NFT_ADDRESS),
        functionName: 'totalSupply',
    })

    return {
        totalSupply: typeof totalSupply === 'bigint' ? totalSupply : null,
        ...rest,
    }
}

