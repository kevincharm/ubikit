import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { getAddress, zeroHash } from 'viem'
import { network } from 'hardhat'

type DisclosureOutput = {
    attestationId: `0x${string}`
    userIdentifier: bigint
    nullifier: bigint
    forbiddenCountriesListPacked: [bigint, bigint, bigint, bigint]
    issuingState: string
    name: string[]
    idNumber: string
    nationality: string
    dateOfBirth: string
    gender: string
    expiryDate: string
    olderThan: bigint
    ofac: [boolean, boolean, boolean]
}

describe('PassportBoundNFT', async function () {
    const { viem } = await network.connect()
    const [deployer, otherAccount] = await viem.getWalletClients()

    let passportBoundNft: Awaited<ReturnType<typeof viem.deployContract>>
    let mockHub: Awaited<ReturnType<typeof viem.deployContract>>

    const buildDisclosureOutput = (
        overrides: Partial<DisclosureOutput> = {},
    ): DisclosureOutput => ({
        attestationId: zeroHash,
        userIdentifier: BigInt(deployer.account.address),
        nullifier: 123n,
        forbiddenCountriesListPacked: [0n, 0n, 0n, 0n],
        issuingState: 'PSE',
        name: ['Alice'],
        idNumber: 'AA0101',
        nationality: 'PSE',
        dateOfBirth: '1990-01-01',
        gender: 'X',
        expiryDate: '2030-01-01',
        olderThan: 21n,
        ofac: [false, false, false],
        ...overrides,
    })

    beforeEach(async () => {
        mockHub = await viem.deployContract('MockIdentityVerificationHubV2')
        passportBoundNft = await viem.deployContract('PassportBoundNFT', [
            mockHub.address,
            'ibt.ubikit',
            {
                olderThan: 21n,
                forbiddenCountries: [],
                ofacEnabled: false,
            },
            'PSE',
        ])
    })

    it('registers verification config with the hub on deploy', async function () {
        const configId = await mockHub.read.lastConfigId()
        assert.equal(await passportBoundNft.read.verificationConfigId(), configId)

        const [
            olderThanEnabled,
            olderThan,
            forbiddenCountriesEnabled,
            forbiddenCountriesListPacked,
            ofacEnabled,
        ] = await mockHub.read.lastConfig()

        assert.equal(olderThanEnabled, true)
        assert.equal(olderThan, 21n)
        assert.equal(forbiddenCountriesEnabled, false)
        // assert.deepEqual(forbiddenCountriesListPacked, [0n, 0n, 0n, 0n])
        // assert.deepEqual(ofacEnabled, [false, false, false])
    })

    it('mints to the verified user and records passport data', async function () {
        const output = buildDisclosureOutput({
            userIdentifier: BigInt(otherAccount.account.address),
        })

        await mockHub.write.triggerSuccess([passportBoundNft.address, output, '0x'])

        assert.equal(await passportBoundNft.read.totalSupply(), 1n)
        assert.equal(
            await passportBoundNft.read.ownerOf([1n]),
            getAddress(otherAccount.account.address),
        )
        assert.equal(await passportBoundNft.read.tokenIdToNullifier([1n]), output.nullifier)

        const [userId, olderThan, issuingState, expiryDate] =
            await passportBoundNft.read.passportData([output.nullifier])
        assert.equal(userId, output.userIdentifier)
        assert.equal(olderThan, output.olderThan)
        assert.equal(issuingState, output.issuingState)
        assert.equal(expiryDate, output.expiryDate)
    })

    it('reverts if the same nullifier is used twice', async function () {
        const output = buildDisclosureOutput()
        await mockHub.write.triggerSuccess([passportBoundNft.address, output, '0x'])

        await assert.rejects(
            mockHub.write.triggerSuccess([passportBoundNft.address, output, '0x']),
            /PassportAlreadyMinted/,
        )
    })

    it('requires issuing state to match the configured one', async function () {
        const output = buildDisclosureOutput({ issuingState: 'USA' })

        await assert.rejects(
            mockHub.write.triggerSuccess([passportBoundNft.address, output, '0x']),
            /InvalidIssuingState/,
        )
    })

    it('requires a non-zero user identifier', async function () {
        const output = buildDisclosureOutput({ userIdentifier: 0n })

        await assert.rejects(
            mockHub.write.triggerSuccess([passportBoundNft.address, output, '0x']),
            /InvalidUserIdentifier/,
        )
    })
})
