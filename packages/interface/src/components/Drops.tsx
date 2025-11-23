import {
    useReadContract,
    useWriteContract,
    useAccount,
    useChainId,
    useSwitchChain,
    useWaitForTransactionReceipt,
} from 'wagmi'
import { useDrop } from '../hooks/useDrop'
import { usePassportBoundNft } from '../hooks/usePassportBoundNft'
import { UBIDROP_ADDRESS, TOKEN_INFO, TOKEN_ADDRESSES } from '../lib/constants'
import { getAddress, formatUnits } from 'viem'
import { ubiDropAbi } from '../abis/ubiDropAbi'
import { useCallback, useMemo, useState, useEffect } from 'react'
import { celoSepolia } from 'viem/chains'

export function Drop({ dropId }: { dropId: bigint }) {
    const { data: drop, refetch: refetchDrop } = useDrop(dropId)
    const { tokenId } = usePassportBoundNft()
    const [claimSuccess, setClaimSuccess] = useState(false)
    const [isClaiming, setIsClaiming] = useState(false)

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

    const { writeContract, data: claimHash } = useWriteContract()

    const claim = useCallback(() => {
        if (!tokenId || !dropId) return
        setIsClaiming(true)
        setClaimSuccess(false)
        writeContract({
            abi: ubiDropAbi,
            address: getAddress(UBIDROP_ADDRESS),
            functionName: 'claim',
            args: [tokenId as bigint, dropId as bigint],
        })
    }, [tokenId, dropId, writeContract])

    // Monitor claim transaction
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash: claimHash,
    })

    // Handle successful claim
    useEffect(() => {
        if (isConfirmed && isClaiming) {
            console.log('Claim transaction confirmed successfully!')
            setClaimSuccess(true)
            setIsClaiming(false)

            // Refresh drop data after a short delay to ensure state is updated
            setTimeout(() => {
                refetchDrop()
            }, 2000)
        }
    }, [isConfirmed, isClaiming, refetchDrop])

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

            {claimSuccess && (
                <div className="claim-success-message">
                    🎉 Successfully claimed {formattedAmount} {tokenSymbol}!
                </div>
            )}

            <button
                className={`claim-drop-button ${isEligible ? 'eligible' : 'disabled'} ${isClaiming || isConfirming ? 'claiming' : ''}`}
                onClick={claim}
                disabled={
                    !isEligible ||
                    typeof tokenId !== 'bigint' ||
                    typeof dropId !== 'bigint' ||
                    isClaiming ||
                    isConfirming ||
                    claimSuccess
                }
            >
                {isClaiming || isConfirming
                    ? '⏳ Claiming...'
                    : claimSuccess
                      ? '✅ Claimed'
                      : isEligible
                        ? 'Claim'
                        : 'Not Eligible'}
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

    const { isConnected, chainId: accountChainId } = useAccount()
    const chainId = useChainId()
    const { switchChain, isPending: isSwitchingChain } = useSwitchChain()

    // Use account chainId if available (actual connected chain), otherwise fall back to useChainId
    // Only consider network correct if connected AND on the right chain
    const currentChainId = accountChainId || chainId
    const isOnCorrectNetwork = isConnected && currentChainId === celoSepolia.id

    const handleSwitchNetwork = useCallback(() => {
        switchChain({ chainId: celoSepolia.id })
    }, [switchChain])

    return (
        <div className="drops-container">
            <h3 className="drops-title">UBI Claims</h3>

            {isConnected && !isOnCorrectNetwork && (
                <div className="network-warning">
                    <p>
                        You are connected to the wrong network (Chain ID:{' '}
                        {currentChainId || 'unknown'}). Please switch to{' '}
                        <strong>{celoSepolia.name}</strong> (Chain ID: {celoSepolia.id}) to claim
                        tokens.
                    </p>
                    <button
                        type="button"
                        className="switch-network-button"
                        onClick={handleSwitchNetwork}
                        disabled={isSwitchingChain}
                    >
                        {isSwitchingChain ? 'Switching...' : `Switch to ${celoSepolia.name}`}
                    </button>
                </div>
            )}

            {!isConnected && (
                <div className="network-warning">
                    <p>Please connect your wallet to claim tokens.</p>
                </div>
            )}

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
