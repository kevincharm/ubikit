import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

export default buildModule('UBIDropModule', (m) => {
    const passportBoundNftAddress = m.getParameter('passportBoundNftAddress')
    const layerZeroEndpoint = m.getParameter('layerZeroEndpoint')
    const passportChainEid = m.getParameter('passportChainEid')

    const ubiDrop = m.contract('UBIDrop', [
        passportBoundNftAddress,
        layerZeroEndpoint,
        passportChainEid,
    ])

    return { ubiDrop }
})
