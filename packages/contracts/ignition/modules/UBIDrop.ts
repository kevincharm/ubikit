import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

export default buildModule('UBIDropModule', (m) => {
    const passportBoundNftAddress = m.getParameter('passportBoundNftAddress')

    const ubiDrop = m.contract('UBIDrop', [passportBoundNftAddress])

    return { ubiDrop }
})
