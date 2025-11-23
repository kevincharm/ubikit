import { network } from 'hardhat'
import PassportBoundNFT from '../ignition/modules/PassportBoundNFT.js'
import UBIDrop from '../ignition/modules/UBIDrop.js'
import { type Address } from 'viem'
import { celo } from 'viem/chains'

async function main() {
    const { viem, ignition } = await network.connect()
    const publicClient = await viem.getPublicClient()
    const [deployer] = await viem.getWalletClients()

    const chainId = await publicClient.getChainId()
    const isMainnet = chainId === celo.id
    console.log('Deployer:', deployer.account.address)
    console.log('Network:', chainId)

    // Parameters (hardcoded)
    const identityVerificationHubV2Address: Address = isMainnet
        ? '0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF'
        : '0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74'
    const scopeSeed = 'ibt.ubikit'
    const issuingState = 'ESP'
    const verificationConfig = {
        olderThan: 21n,
        forbiddenCountries: [] as string[],
        ofacEnabled: false,
    }

    console.log('Deploying PassportBoundNFT...')
    const { passportBoundNft } = await ignition.deploy(PassportBoundNFT, {
        parameters: {
            PassportBoundNFTModule: {
                identityVerificationHubV2Address,
                scopeSeed,
                verificationConfig,
                issuingState,
            },
        },
    })
    console.log('PassportBoundNFT deployed at:', passportBoundNft.address)

    console.log('Deploying UBIDrop...')
    const { ubiDrop } = await ignition.deploy(UBIDrop, {
        parameters: {
            UBIDropModule: {
                passportBoundNftAddress: passportBoundNft.address,
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
