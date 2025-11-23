import { useReadContract, useConnection } from 'wagmi'
import { passportBoundNftAbi } from '../abis/passportBoundNftAbi'
import { getAddress, type Address } from 'viem'
import { PASSPORT_BOUND_NFT_ADDRESS } from '../lib/constants'

export function usePassportBoundNft() {
    const { address } = useConnection()

    const { data: balance, ...rest } = useReadContract({
        abi: passportBoundNftAbi,
        address: getAddress(PASSPORT_BOUND_NFT_ADDRESS),
        functionName: 'balanceOf',
        args: address ? [address as Address] : undefined,
        query: {
            enabled: Boolean(address),
        },
    })

    const { data: tokenId } = useReadContract({
        abi: passportBoundNftAbi,
        address: getAddress(PASSPORT_BOUND_NFT_ADDRESS),
        functionName: 'tokenOfOwnerByIndex',
        args: [address as Address, 0n],
        query: {
            enabled: Boolean(address),
        },
    })

    const { data: nullifier } = useReadContract({
        abi: passportBoundNftAbi,
        address: getAddress(PASSPORT_BOUND_NFT_ADDRESS),
        functionName: 'tokenIdToNullifier',
        args: [tokenId as bigint],
        query: {
            enabled: typeof tokenId === 'bigint',
        },
    })

    const { data: passportData } = useReadContract({
        abi: passportBoundNftAbi,
        address: getAddress(PASSPORT_BOUND_NFT_ADDRESS),
        functionName: 'passportData',
        args: [nullifier as bigint],
        query: {
            enabled: typeof nullifier === 'bigint',
        },
    })

    return {
        hasMinted: typeof balance === 'bigint' ? balance > 0n : null,
        tokenId,
        passportData,
        ...rest,
    }
}
