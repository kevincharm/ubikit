import { network } from 'hardhat'
import PassportBoundNFT from '../ignition/modules/PassportBoundNFT.js'
import UBIDrop from '../ignition/modules/UBIDrop.js'
import { type Address } from 'viem'

async function main() {
    const { viem, ignition } = await network.connect()
    const publicClient = await viem.getPublicClient()
    const [deployer] = await viem.getWalletClients()

    console.log('Deployer:', deployer.account.address)
    console.log('Network:', await publicClient.getChainId())

    // Parameters (hardcoded)
    const identityVerificationHubV2Address = '0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74' as Address
    const scopeSeed = 'ibt.ubikit'
    const issuingState = 'PSE'
    const verificationConfig = {
        olderThan: 21n,
        forbiddenCountries: [] as string[],
        ofacEnabled: false,
    }
    const layerZeroEndpoint = process.env.LZ_ENDPOINT as Address | undefined
    if (!layerZeroEndpoint) {
        throw new Error('LZ_ENDPOINT env var must be set to a LayerZero endpoint')
    }
    const passportChainEidRaw = process.env.PASSPORT_CHAIN_EID
    if (!passportChainEidRaw) {
        throw new Error('PASSPORT_CHAIN_EID env var must be provided')
    }
    const passportChainEid = Number(passportChainEidRaw)
    if (!Number.isFinite(passportChainEid) || passportChainEid <= 0) {
        throw new Error('PASSPORT_CHAIN_EID must be a positive integer')
    }

    console.log('Deploying PassportBoundNFT...')
    const { passportBoundNft } = await ignition.deploy(PassportBoundNFT, {
        parameters: {
            PassportBoundNFTModule: {
                identityVerificationHubV2Address,
                scopeSeed,
                verificationConfig,
                issuingState,
                layerZeroEndpoint,
            },
        },
    })
    console.log('PassportBoundNFT deployed at:', passportBoundNft.address)

    console.log('Deploying UBIDrop...')
    const { ubiDrop } = await ignition.deploy(UBIDrop, {
        parameters: {
            UBIDropModule: {
                passportBoundNftAddress: passportBoundNft.address,
                layerZeroEndpoint,
                passportChainEid,
            },
        },
    })
    console.log('UBIDrop deployed at:', ubiDrop.address)
}

main()
    .then(() => {
        console.log('Deployed successfully')
        process.exit(0)
    })
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
