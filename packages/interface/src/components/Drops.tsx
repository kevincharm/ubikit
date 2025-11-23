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
        <div className="drop-card">
            <div className="drop-header">
                <div className="drop-id">Drop #{dropId.toString()}</div>
                <div className={`eligibility-badge ${isEligible ? 'eligible' : 'not-eligible'}`}>
                    {isEligible ? '✓ Eligible' : '✗ Not Eligible'}
                </div>
            </div>

            <div className="drop-content">
                <div className="amount-section">
                    <div className="amount-label">Claim Amount</div>
                    <div className="amount-value">
                        {formattedAmount} <span className="token-symbol">{tokenSymbol}</span>
                    </div>
                </div>

                <div className="drop-stats">
                    <div className="stat">
                        <span className="stat-label">Total Recipients</span>
                        <span className="stat-value">{drop?.totalSupply?.toString()}</span>
                    </div>
                </div>
            </div>

            <button
                className={`claim-drop-button ${isEligible ? 'eligible' : 'disabled'}`}
                onClick={claim}
                disabled={!isEligible || typeof tokenId !== 'bigint' || typeof dropId !== 'bigint'}
            >
                {isEligible ? 'Claim' : 'Not Eligible'}
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
        <div className="drops-container">
            <h3 className="drops-title">UBI Claims</h3>
            <div className="drops-grid">
                {typeof totalDrops === 'bigint' && totalDrops > 0n ? (
                    Array.from({ length: Number(totalDrops!) }, (_, i: number) => (
                        <Drop key={i} dropId={BigInt(i + 1)} />
                    ))
                ) : (
                    <div className="no-drops-message">
                        <div className="no-drops-icon">📦</div>
                        <p>No UBI drops available yet</p>
                        <p className="no-drops-subtitle">Check back later for new distributions</p>
                    </div>
                )}
            </div>
        </div>
    )
}
