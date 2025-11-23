import { useReadContract, useWriteContract } from 'wagmi'
import { useDrop } from '../hooks/useDrop'
import { usePassportBoundNft } from '../hooks/usePassportBoundNft'
import { UBIDROP_ADDRESS } from '../lib/constants'
import { getAddress } from 'viem'
import { ubiDropAbi } from '../abis/ubiDropAbi'
import { useCallback } from 'react'

export function Drop({ dropId }: { dropId: bigint }) {
    const { data: drop } = useDrop(dropId)
    const { tokenId } = usePassportBoundNft()
    const isEligible =
        typeof tokenId === 'bigint' && typeof dropId === 'bigint' && tokenId <= drop?.totalSupply!
    const amount = drop ? drop.amount! / drop.totalSupply! : 0

    const { writeContract } = useWriteContract()
    const claim = useCallback(() => {
        if (!tokenId || !dropId) return
        writeContract({
            abi: ubiDropAbi,
            address: getAddress(UBIDROP_ADDRESS),
            functionName: 'claim',
            args: [tokenId as bigint, dropId as bigint],
        })
    }, [tokenId, dropId])

    return (
        <div>
            <div>
                Eligible for {amount} {drop?.currency}
            </div>
            <button
                onClick={claim}
                disabled={!isEligible || typeof tokenId !== 'bigint' || typeof dropId !== 'bigint'}
            >
                Claim
            </button>
        </div>
    )
}

export function Drops() {
    const { data: totalDrops } = useReadContract({
        abi: ubiDropAbi,
        address: getAddress(UBIDROP_ADDRESS),
        functionName: 'totalDrops',
    })

    return (
        <div>
            {typeof totalDrops === 'bigint' &&
                Array.from({ length: Number(totalDrops!) }, (_: any, i: number) => (
                    <Drop key={i} dropId={BigInt(i + 1)} />
                ))}
        </div>
    )
}
