import { useMemo } from 'react'
import { useConnect, useConnection, useDisconnect } from 'wagmi'

export function ConnectWalletButton() {
    const { address, isConnecting, isReconnecting, isConnected } = useConnection()
    const { connectors, connectAsync, status } = useConnect()
    const { disconnectAsync } = useDisconnect()

    const injectedConnector = connectors.find((connector) => connector.type === 'injected')

    const label = useMemo(() => {
        if (isConnecting || status === 'pending') return 'Connecting…'
        if (!injectedConnector) return 'No wallet found'
        if (isConnected && address) return `${address.slice(0, 6)}…${address.slice(-4)}`
        return 'Connect wallet'
    }, [address, injectedConnector, isConnected, isConnecting, status])

    const handleClick = async () => {
        if (!injectedConnector) return
        if (isConnected) {
            await disconnectAsync()
            return
        }
        await connectAsync({ connector: injectedConnector })
    }

    return (
        <button
            type="button"
            className="wallet-button"
            onClick={handleClick}
            disabled={!injectedConnector || isConnecting || isReconnecting || status === 'pending'}
        >
            {label}
        </button>
    )
}
