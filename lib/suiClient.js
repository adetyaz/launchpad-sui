import { JsonRpcProvider, Network } from '@mysten/sui.js'

const provider = new JsonRpcProvider({
	network: Network.DEVNET,
})

export default provider
