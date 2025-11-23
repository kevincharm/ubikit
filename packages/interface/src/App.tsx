import { SelfQRcodeWrapper } from '@selfxyz/qrcode'
import { useConnection, useChainId } from 'wagmi'
import { celoSepolia } from 'viem/chains'
import './App.css'
import { usePassportBoundNft } from './hooks/usePassportBoundNft'
import { useSelf } from './hooks/useSelf'

function App() {
    const { isConnected } = useConnection()
    const chainId = useChainId()
    const { hasMinted, isPending } = usePassportBoundNft()
    const selfApp = useSelf()

    const isConfiguredForCelo = chainId === celoSepolia.id

    let actionArea = <p className="panel-message">Connect your wallet to get started.</p>

    if (isConnected) {
        if (isPending || hasMinted === null) {
            actionArea = <p className="panel-message">Checking your mint status…</p>
        } else if (hasMinted) {
            actionArea = (
                <button type="button" className="claim-button">
                    Claim
                </button>
            )
        } else if (!selfApp) {
            actionArea = <p className="panel-message">Preparing your verification request…</p>
        } else {
            actionArea = (
                <div className="qr-wrapper">
                    <SelfQRcodeWrapper
                        selfApp={selfApp}
                        onSuccess={() => {
                            console.info('Verification success')
                        }}
                        onError={(error) => {
                            console.warn('Verification failed', error)
                        }}
                    />
                </div>
            )
        }
    }

    return (
        <section className="panel">
            <div className="network-pill" role="status">
                Target network:{' '}
                {isConfiguredForCelo
                    ? `${celoSepolia.name} (chain id ${celoSepolia.id})`
                    : `chain id ${chainId}`}
            </div>
            <h2>Home</h2>
            <p className="panel-description">
                This route wires wagmi, TanStack Query, and Self QR tooling so you can handle
                verification or claiming logic in one place.
            </p>
            {actionArea}
        </section>
    )
}

export default App
