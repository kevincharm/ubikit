import { SelfQRcodeWrapper } from '@selfxyz/qrcode'
import { useAccount, useChainId } from 'wagmi'
import { celo } from 'viem/chains'
import './App.css'
import { usePassportBoundNft } from './hooks/usePassportBoundNft'
import { useSelf } from './hooks/useSelf'
import { Drops } from './components/Drops'
import { useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

function App() {
    const { isConnected } = useAccount()
    const chainId = useChainId()
    const { hasMinted, isPending, passportData } = usePassportBoundNft()
    const { data: selfApp, isPending: isSelfLoading, isFetching: isSelfFetching } = useSelf()

    const isConfiguredForCelo = chainId === celo.id

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
        } else if (isSelfLoading || isSelfFetching || !selfApp) {
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

    useEffect(() => {
        sdk.actions.ready()
    })

    return (
        <section className="panel">
            <div className="network-pill" role="status">
                Target network:{' '}
                {isConfiguredForCelo ? `${celo.name} (chain id ${celo.id})` : `chain id ${chainId}`}
            </div>
            <h2>Home</h2>
            {actionArea}
            {passportData && (
                <div className="passport-data">
                    <h3>Passport Data</h3>
                    <p>User ID: {passportData[0]}</p>
                    <p>Older Than: {passportData[1]}</p>
                    <p>Issuing State: {passportData[2]}</p>
                    <p>Expiry Date: {passportData[3]}</p>
                </div>
            )}
            <Drops />
        </section>
    )
}

export default App
