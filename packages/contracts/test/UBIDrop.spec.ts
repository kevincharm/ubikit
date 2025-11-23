import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { getAddress } from 'viem'
import { network } from 'hardhat'

describe('UBIDrop', async function () {
    const { viem } = await network.connect()
    const [deployer, recipientA, recipientB] = await viem.getWalletClients()

    let ubiDrop: Awaited<ReturnType<typeof viem.deployContract>>
    let mockPassport: Awaited<ReturnType<typeof viem.deployContract>>
    let token: Awaited<ReturnType<typeof viem.deployContract>>

    beforeEach(async () => {
        mockPassport = await viem.deployContract('MockPassportBoundNFT', [
            2n,
            [recipientA.account.address, recipientB.account.address],
        ])
        token = await viem.deployContract('MockERC20', ['UBI', 'UBI'])
        ubiDrop = await viem.deployContract('UBIDrop', [mockPassport.address])
    })

    it('reverts addDrop when no supply exists', async function () {
        const emptyPassport = await viem.deployContract('MockPassportBoundNFT', [0n, []])
        const drop = await viem.deployContract('UBIDrop', [emptyPassport.address])

        await assert.rejects(drop.write.addDrop([token.address, 1000n]), /NoSupply/)
    })

    it('stores drop info and pulls funds', async function () {
        await token.write.mint([deployer.account.address, 1_000n])
        await token.write.approve([ubiDrop.address, 1_000n])

        await ubiDrop.write.addDrop([token.address, 1_000n])
        const drop = await ubiDrop.read.drops([1n])
        assert.deepEqual(drop, [2n, getAddress(token.address), 1_000n])

        const balance = await token.read.balanceOf([ubiDrop.address])
        assert.equal(balance, 1_000n)
    })

    it('reverts claims for unknown drop', async function () {
        await assert.rejects(ubiDrop.write.claim([1n, 1n]), /DropNotFound/)
    })

    it('reverts claims when token id exceeds supply', async function () {
        await token.write.mint([deployer.account.address, 1_000n])
        await token.write.approve([ubiDrop.address, 1_000n])
        await ubiDrop.write.addDrop([token.address, 1_000n])

        await assert.rejects(ubiDrop.write.claim([3n, 1n]), /TokenIdNotIncluded/)
    })

    it('allows each passport holder to claim exactly once', async function () {
        await token.write.mint([deployer.account.address, 1_000n])
        await token.write.approve([ubiDrop.address, 1_000n])
        await ubiDrop.write.addDrop([token.address, 1_000n])

        await ubiDrop.write.claim([1n, 1n], { account: recipientA.account })
        const recipientABalance = await token.read.balanceOf([recipientA.account.address])
        assert.equal(recipientABalance, 500n)

        await assert.rejects(ubiDrop.write.claim([1n, 1n], { account: recipientA.account }), /AlreadyClaimed/)

        await ubiDrop.write.claim([2n, 1n], { account: recipientB.account })
        const recipientBBalance = await token.read.balanceOf([recipientB.account.address])
        assert.equal(recipientBBalance, 500n)
    })
})
