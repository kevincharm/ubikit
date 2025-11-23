import { getAddress } from 'viem'
import { useReadContract } from 'wagmi'
import { ubiDropAbi } from '../abis/ubiDropAbi'
import { UBIDROP_ADDRESS } from '../lib/constants'

export function useDrop(dropId?: bigint) {
    const { data, ...rest } = useReadContract({
        abi: ubiDropAbi,
        address: getAddress(UBIDROP_ADDRESS),
        functionName: 'drops',
        args: [dropId as bigint],
        query: {
            enabled: typeof dropId === 'bigint',
        },
    })
    const [totalSupply, currency, amount] = data ?? []
    return {
        data: {
            totalSupply,
            currency,
            amount,
        },
        ...rest,
    }
}
