import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { zeroHash } from 'viem'
import { network } from 'hardhat'

describe('PassportBoundNFT', async function () {
    const { viem } = await network.connect()
    const [deployer] = await viem.getWalletClients()
    const publicClient = await viem.getPublicClient()

    it('mints', async function () {
        const passportBoundNft = await viem.deployContract('PassportBoundNFT', [
            '0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74',
            'ibt.ubikit',
            {
                olderThan: 21n,
                forbiddenCountries: [],
                ofacEnabled: false,
            },
            'PSE',
        ])
    })
})
