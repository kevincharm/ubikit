import { useState, useMemo, useCallback, useEffect } from 'react'
import './Admin.css'
import { useUbiDropTotalSupply } from '../hooks/useUbiDropTotalSupply'
import { TOKEN_INFO, TOKEN_ADDRESSES, UBIDROP_ADDRESS, type TokenSymbol } from '../lib/constants'
import {
    useWriteContract,
    useReadContract,
    useAccount,
    useWaitForTransactionReceipt,
    useChainId,
    useSwitchChain,
} from 'wagmi'
import { getAddress, parseUnits, formatUnits } from 'viem'
import { celo } from 'viem/chains'
import { ubiDropAbi } from '../abis/ubiDropAbi'
import { erc20Abi } from '../abis/erc20Abi'

export function Admin() {
    const [tokenAddress, setTokenAddress] = useState<string>(TOKEN_ADDRESSES.USDC)
    const [amountPerRecipient, setAmountPerRecipient] = useState(20)
    const { totalSupply, isPending, error } = useUbiDropTotalSupply()
    const { address, isConnected, chainId: accountChainId } = useAccount()
    const chainId = useChainId()
    const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
    const {
        writeContract,
        data: hash,
        isPending: isWritePending,
        error: writeError,
    } = useWriteContract()

    // Use account chainId if available (actual connected chain), otherwise fall back to useChainId
    // Only consider network correct if connected AND on the right chain
    const currentChainId = accountChainId || chainId
    const isOnCorrectNetwork = isConnected && currentChainId === celo.id

    const tokenInfo = useMemo(() => {
        const entry = Object.entries(TOKEN_INFO).find(
            ([, info]) => info.address.toLowerCase() === tokenAddress.toLowerCase(),
        )
        return entry
            ? { symbol: entry[0] as TokenSymbol, ...entry[1] }
            : { symbol: 'USDC' as TokenSymbol, ...TOKEN_INFO.USDC }
    }, [tokenAddress])

    const calculateTotalAmount = useCallback(() => {
        if (totalSupply === null || amountPerRecipient <= 0) {
            return null
        }
        return amountPerRecipient * Number(totalSupply)
    }, [totalSupply, amountPerRecipient])

    // Calculate total amount in wei
    const totalAmountInWei = useMemo(() => {
        const totalAmount = calculateTotalAmount()
        if (!totalAmount || totalAmount <= 0) return null
        try {
            return parseUnits(totalAmount.toFixed(tokenInfo.decimals), tokenInfo.decimals)
        } catch {
            return null
        }
    }, [calculateTotalAmount, tokenInfo.decimals])

    // Check allowance
    const {
        data: allowance,
        refetch: refetchAllowance,
        isLoading: isCheckingAllowance,
    } = useReadContract({
        abi: erc20Abi,
        address: getAddress(tokenAddress),
        functionName: 'allowance',
        args: address && totalAmountInWei ? [address, getAddress(UBIDROP_ADDRESS)] : undefined,
        query: {
            enabled: Boolean(address && totalAmountInWei && isOnCorrectNetwork && isConnected),
        },
    })

    // Check user balance
    const {
        data: balance,
        refetch: refetchBalance,
        isLoading: isCheckingBalance,
    } = useReadContract({
        abi: erc20Abi,
        address: getAddress(tokenAddress),
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: {
            enabled: Boolean(address && isOnCorrectNetwork && isConnected),
        },
    })

    // Track if we're waiting for approval
    const [isApproving, setIsApproving] = useState(false)

    const formatAmount = useCallback(
        (amount: number): string => {
            return amount.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: tokenInfo.decimals,
            })
        },
        [tokenInfo.decimals],
    )

    const formatTokenAmount = useCallback(
        (value: bigint): string => {
            const numericValue = Number(formatUnits(value, tokenInfo.decimals))
            return formatAmount(numericValue)
        },
        [formatAmount, tokenInfo.decimals],
    )

    const allowanceBigInt = allowance ?? 0n
    const balanceBigInt = balance ?? 0n

    const needsApproval = useMemo(() => {
        if (!totalAmountInWei) return false
        return allowanceBigInt < totalAmountInWei
    }, [allowanceBigInt, totalAmountInWei])

    const hasInsufficientBalance = useMemo(() => {
        if (!totalAmountInWei) return false
        return balanceBigInt < totalAmountInWei
    }, [balanceBigInt, totalAmountInWei])

    const handleAddDrop = useCallback(() => {
        if (!totalAmountInWei || !isOnCorrectNetwork) return
        setIsApproving(false)
        writeContract({
            abi: ubiDropAbi,
            address: getAddress(UBIDROP_ADDRESS),
            functionName: 'addDrop',
            chainId: celo.id,
            args: [getAddress(tokenAddress), totalAmountInWei],
        })
    }, [writeContract, tokenAddress, totalAmountInWei, isOnCorrectNetwork])

    const handleApprove = useCallback(() => {
        if (!totalAmountInWei || !address || !isOnCorrectNetwork) return
        setIsApproving(true)
        writeContract({
            abi: erc20Abi,
            address: getAddress(tokenAddress),
            functionName: 'approve',
            chainId: celo.id,
            args: [getAddress(UBIDROP_ADDRESS), totalAmountInWei],
        })
    }, [writeContract, tokenAddress, totalAmountInWei, address, isOnCorrectNetwork])

    // Wait for transaction receipt
    const {
        isLoading: isConfirming,
        isSuccess: isConfirmed,
        isError: isTxError,
        error: txError,
        data: receipt,
    } = useWaitForTransactionReceipt({
        hash,
    })

    // Refetch allowance and balance when token address or amount changes
    useEffect(() => {
        if (isConnected && isOnCorrectNetwork && totalAmountInWei) {
            refetchAllowance()
        }
        if (isConnected && isOnCorrectNetwork) {
            refetchBalance()
        }
    }, [
        tokenAddress,
        totalAmountInWei,
        isConnected,
        isOnCorrectNetwork,
        refetchAllowance,
        refetchBalance,
    ])

    // Refresh allowance and balance after any transaction finishes successfully
    useEffect(() => {
        if (isConfirmed && !isTxError) {
            // Add a small delay to ensure blockchain state is updated
            const delayRefresh = async () => {
                await new Promise((resolve) => setTimeout(resolve, 1000))

                const refreshAllowanceWithRetry = async (retries = 5) => {
                    for (let i = 0; i < retries; i++) {
                        try {
                            console.log(`Refreshing allowance (attempt ${i + 1}/${retries})...`)
                            const { data: newAllowance } = await refetchAllowance()
                            if (newAllowance !== undefined) {
                                console.log(
                                    'Allowance refreshed successfully:',
                                    formatTokenAmount(newAllowance),
                                )
                                // If this was an approval transaction, check if we should proceed with addDrop
                                if (isApproving && newAllowance >= totalAmountInWei!) {
                                    console.log('Approval confirmed, proceeding with addDrop...')
                                    setIsApproving(false)
                                    handleAddDrop()
                                }
                                break // Successfully refreshed
                            }
                        } catch (error) {
                            console.warn(`Allowance refetch attempt ${i + 1} failed:`, error)
                            if (i === retries - 1) {
                                console.error('Failed to refresh allowance after multiple attempts')
                            }
                        }
                        // Wait before retrying (exponential backoff)
                        if (i < retries - 1) {
                            await new Promise((resolve) =>
                                setTimeout(resolve, Math.pow(2, i) * 1000),
                            )
                        }
                    }
                }

                const refreshBalanceWithRetry = async (retries = 5) => {
                    for (let i = 0; i < retries; i++) {
                        try {
                            console.log(`Refreshing balance (attempt ${i + 1}/${retries})...`)
                            const { data: newBalance } = await refetchBalance()
                            if (newBalance !== undefined) {
                                console.log(
                                    'Balance refreshed successfully:',
                                    formatTokenAmount(newBalance),
                                )
                                break // Successfully refreshed
                            }
                        } catch (error) {
                            console.warn(`Balance refetch attempt ${i + 1} failed:`, error)
                            if (i === retries - 1) {
                                console.error('Failed to refresh balance after multiple attempts')
                            }
                        }
                        // Wait before retrying (exponential backoff)
                        if (i < retries - 1) {
                            await new Promise((resolve) =>
                                setTimeout(resolve, Math.pow(2, i) * 1000),
                            )
                        }
                    }
                }

                // Refresh both allowance and balance concurrently
                await Promise.all([refreshAllowanceWithRetry(), refreshBalanceWithRetry()])
            }

            delayRefresh()
        }
    }, [
        isConfirmed,
        isTxError,
        isApproving,
        totalAmountInWei,
        handleAddDrop,
        refetchAllowance,
        refetchBalance,
        receipt,
        formatTokenAmount,
    ])

    const handleExecute = useCallback(() => {
        if (!totalAmountInWei || !address) return

        if (needsApproval) {
            handleApprove()
        } else {
            handleAddDrop()
        }
    }, [needsApproval, handleApprove, handleAddDrop, totalAmountInWei, address])

    const isProcessing = isWritePending || isConfirming
    const canExecute =
        !isProcessing &&
        totalAmountInWei !== null &&
        address &&
        totalSupply !== null &&
        isOnCorrectNetwork &&
        isConnected &&
        !hasInsufficientBalance

    const handleSwitchNetwork = useCallback(() => {
        switchChain({ chainId: celo.id })
    }, [switchChain])

    return (
        <section className="admin-panel">
            <h1>Deploy your Pension Fund Distributor</h1>

            {isConnected && !isOnCorrectNetwork && (
                <div className="network-warning">
                    <p>
                        You are connected to the wrong network (Chain ID:{' '}
                        {currentChainId || 'unknown'}). Please switch to{' '}
                        <strong>{celo.name}</strong> (Chain ID: {celo.id}) to continue.
                    </p>
                    <button
                        type="button"
                        className="switch-network-button"
                        onClick={handleSwitchNetwork}
                        disabled={isSwitchingChain}
                    >
                        {isSwitchingChain ? 'Switching...' : `Switch to ${celo.name}`}
                    </button>
                </div>
            )}

            {!isConnected && (
                <div className="network-warning">
                    <p>Please connect your wallet to continue.</p>
                </div>
            )}

            <div className="admin-section">
                <div className="form-group">
                    <label htmlFor="token-to-distribute">Token to distribute:</label>
                    <select
                        id="token-to-distribute"
                        value={tokenAddress}
                        onChange={(e) => setTokenAddress(e.target.value)}
                        className="form-select"
                        disabled
                    >
                        <option value={TOKEN_INFO.USDC.address}>USDC</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="amount-per-recipient">Amount per recipient:</label>
                    <div className="number-input-wrapper">
                        <input
                            id="amount-per-recipient"
                            type="number"
                            value={amountPerRecipient}
                            onChange={(e) => setAmountPerRecipient(Number(e.target.value))}
                            className="form-input number-input"
                            min="0"
                            step={1 / 10 ** tokenInfo.decimals}
                        />
                        <div className="number-input-controls">
                            <button
                                type="button"
                                className="number-input-btn"
                                onClick={() => setAmountPerRecipient((prev) => prev + 1)}
                            >
                                ▲
                            </button>
                            <button
                                type="button"
                                className="number-input-btn"
                                onClick={() =>
                                    setAmountPerRecipient((prev) => Math.max(0, prev - 1))
                                }
                            >
                                ▼
                            </button>
                        </div>
                    </div>
                </div>
                <div className="form-group">
                    <label>Number of eligible addresses:</label>
                    <div className="eligible-addresses-value">
                        {isPending ? (
                            <span className="loading-text">Loading...</span>
                        ) : error ? (
                            <span className="error-text">Error loading data</span>
                        ) : totalSupply !== null ? (
                            totalSupply.toString()
                        ) : (
                            <span className="muted-text">—</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="admin-section">
                <h2>Top-up Pension Fund</h2>
                <div className="top-up-display">
                    <label>Total amount to top-up:</label>
                    <div className="top-up-amount">
                        {totalSupply !== null && amountPerRecipient > 0 ? (
                            <>
                                {formatAmount(calculateTotalAmount()!)} {tokenInfo.symbol}
                            </>
                        ) : (
                            <span className="muted-text">—</span>
                        )}
                    </div>
                </div>
                {isConnected && isOnCorrectNetwork && totalAmountInWei && (
                    <div className="approval-status">
                        {isCheckingBalance || isCheckingAllowance ? (
                            <span className="loading-text">Checking balance and approval...</span>
                        ) : hasInsufficientBalance ? (
                            <div className="approval-warning">
                                <p>
                                    Insufficient balance: You need{' '}
                                    {formatAmount(calculateTotalAmount()!)} {tokenInfo.symbol} but
                                    only have {formatTokenAmount(balanceBigInt)} {tokenInfo.symbol}.
                                </p>
                            </div>
                        ) : needsApproval ? (
                            <div className="approval-warning">
                                <p>
                                    Approval required: You need to approve{' '}
                                    {formatAmount(calculateTotalAmount()!)} {tokenInfo.symbol} for
                                    the UBIDrop contract.
                                </p>
                                {allowance && (
                                    <p className="approval-details">
                                        Current allowance: {formatTokenAmount(allowanceBigInt)}{' '}
                                        {tokenInfo.symbol}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="approval-success">
                                <p>✓ Token approved. Ready to execute.</p>
                                {allowance && (
                                    <p className="approval-details">
                                        Approved amount: {formatTokenAmount(allowanceBigInt)}{' '}
                                        {tokenInfo.symbol}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {writeError && <div className="error-message">Error: {writeError.message}</div>}
            {isTxError && txError && (
                <div className="error-message">
                    Transaction failed: {txError.message || 'Unknown transaction error'}
                </div>
            )}
            {isConfirmed && !isTxError && (
                <div className="success-message">
                    Transaction confirmed! Drop created successfully.
                </div>
            )}
            <button
                type="button"
                className="execute-button"
                onClick={handleExecute}
                disabled={!canExecute || isProcessing}
            >
                {isProcessing
                    ? isApproving || needsApproval
                        ? 'Approving...'
                        : 'Creating drop...'
                    : needsApproval
                      ? 'Approve & Execute'
                      : 'Execute'}
            </button>
        </section>
    )
}
