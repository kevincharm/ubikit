import { useReadContract, useWriteContract } from 'wagmi'
import { useDrop } from '../hooks/useDrop'
import { usePassportBoundNft } from '../hooks/usePassportBoundNft'
import { UBIDROP_ADDRESS, TOKEN_INFO, TOKEN_ADDRESSES } from '../lib/constants'
import { getAddress, formatUnits } from 'viem'
import { ubiDropAbi } from '../abis/ubiDropAbi'
import { useCallback, useMemo } from 'react'

export function Drop({ dropId }: { dropId: bigint }) {
    const { data: drop } = useDrop(dropId)
    const { tokenId } = usePassportBoundNft()
    const isEligible =
        typeof tokenId === 'bigint' &&
        typeof dropId === 'bigint' &&
        drop?.totalSupply &&
        tokenId <= drop.totalSupply

    // Get token symbol from currency address
    const tokenSymbol = useMemo(() => {
        if (!drop?.currency) return 'Unknown'

        const entry = Object.entries(TOKEN_ADDRESSES).find(
            ([, address]) => address.toLowerCase() === drop.currency!.toLowerCase(),
        )
        return entry ? entry[0] : 'Unknown'
    }, [drop])

    // Get token decimals
    const tokenDecimals = useMemo(() => {
        if (!drop?.currency) return 18 // default

        const entry = Object.entries(TOKEN_INFO).find(
            ([, info]) => info.address.toLowerCase() === drop.currency!.toLowerCase(),
        )
        return entry ? entry[1].decimals : 18
    }, [drop])

    // Format amount with proper decimals
    const formattedAmount = useMemo(() => {
        if (!drop?.amount || !drop?.totalSupply) return '0'

        const amountPerRecipient = drop.amount! / drop.totalSupply!
        return formatUnits(amountPerRecipient, tokenDecimals)
    }, [drop, tokenDecimals])

    const { writeContract } = useWriteContract()
    const claim = useCallback(() => {
        if (!tokenId || !dropId) return
        writeContract({
            abi: ubiDropAbi,
            address: getAddress(UBIDROP_ADDRESS),
            functionName: 'claim',
            args: [tokenId as bigint, dropId as bigint],
        })
    }, [tokenId, dropId, writeContract])

    return (
        <div>
            <div>
                Eligible for {formattedAmount} {tokenSymbol}
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
                Array.from({ length: Number(totalDrops!) }, (_, i: number) => (
                    <Drop key={i} dropId={BigInt(i + 1)} />
                ))}
        </div>
    )
}
