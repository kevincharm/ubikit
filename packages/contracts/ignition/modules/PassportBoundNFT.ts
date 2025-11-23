import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

const TESTNET_IDENTITY_VERIFICATION_HUB_V2_ADDRESS = '0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74'

export default buildModule('PassportBoundNFTModule', (m) => {
    const identityVerificationHubV2Address = m.getParameter(
        'identityVerificationHubV2Address',
        TESTNET_IDENTITY_VERIFICATION_HUB_V2_ADDRESS,
    )

    const scopeSeed = m.getParameter('scopeSeed', 'ibt.ubikit')

    const verificationConfig = m.getParameter('verificationConfig', {
        olderThan: 21n,
        forbiddenCountries: [] as string[],
        ofacEnabled: false,
    })

    const issuingState = m.getParameter('issuingState', 'PSE')

    const passportBoundNft = m.contract('PassportBoundNFT', [
        identityVerificationHubV2Address,
        scopeSeed,
        verificationConfig,
        issuingState,
    ])

    return { passportBoundNft }
})
