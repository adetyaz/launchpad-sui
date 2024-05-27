import provider from './suiClient'

export const createAsset = async (
	phygitalTag,
	nftName,
	nftDescription,
	uri,
	royalty,
	controlCapId,
	clockId,
	ctxSender
) => {
	try {
		const result = await provider.executeMoveCall({
			packageObjectId: '...',
			module: 'phygital',
			typeArguments: [],
			arguments: [
				phygitalTag,
				nftName,
				nftDescription,
				uri,
				royalty.toString(), // Convert to string if necessary
				controlCapId,
				clockId,
			],
			gasBudget: 1000, // Adjust as needed
			sender: ctxSender, // Address of the sender
		})
	} catch (error) {
		console.error('Error calling create_asset:', error)
		throw error
	}
}

/**
 * Executes a Move call to a smart contract.
 * @param {string} packageObjectId - The contract address.
 * @param {string} module - The module name.
 * @param {string} func - The function name.
 * @param {Array} typeArgs - The type arguments for the function.
 * @param {Array} args - The arguments for the function.
 * @param {number} gasBudget - The gas budget for the transaction.
 * @param {string} sender - The address of the sender.
 * @returns {Promise<Object>} - The result of the Move call.
 */
export const executeMoveCall = async ({
	packageObjectId,
	module,
	func,
	typeArgs = [],
	args,
	gasBudget,
	sender,
}) => {
	try {
		const result = await provider.executeMoveCall({
			packageObjectId,
			module,
			function: func,
			typeArguments: typeArgs,
			arguments: args,
			gasBudget,
			sender,
		})

		return result
	} catch (error) {
		console.error('Error executing Move call:', error)
		throw error
	}
}

/**
 * Update the status of a PhygitalNFT.
 * @param {string} nftId - The ID of the NFT.
 * @param {number} status - The new status.
 * @param {string} clockId - The clock ID.
 * @param {string} sender - The sender address.
 * @returns {Promise<Object>} - The result of the update operation.
 */
export const updateItemStatus = async (nftId, status, clockId, sender) => {
	return await executeMoveCall({
		packageObjectId: '0x3b9a06e1...', // Replace with your actual contract address
		module: 'phygital',
		func: 'update_item_status',
		args: [nftId, status, clockId],
		gasBudget: 1000, // Adjust as needed
		sender,
	})
}

/**
 * Executes a Move call.
 * @param {Object} options - The options for the Move call.
 * @returns {Promise<Object>} - The result of the Move call.
 */
// export const executeMoveCall = async (options) => {
// 	// Implementation of executeMoveCall function
// }

/**
 * Grants a role to a user.
 * @param {string} packageObjectId - The contract address.
 * @param {string} user - The address of the user.
 * @param {number} roleType - The type of role (1 for operator, 2 for creator).
 * @param {string} sender - The sender address.
 * @returns {Promise<Object>} - The result of the grant operation.
 */
export const grantRole = async (packageObjectId, user, roleType, sender) => {
	// Implementation of grantRole function
}

/**
 * Revokes a role from a user.
 * @param {string} packageObjectId - The contract address.
 * @param {string} user - The address of the user.
 * @param {number} roleType - The type of role (1 for operator, 2 for creator).
 * @param {string} sender - The sender address.
 * @returns {Promise<Object>} - The result of the revoke operation.
 */
export const revokeRole = async (packageObjectId, user, roleType, sender) => {
	// Implementation of revokeRole function
}

/**
 * Delegates the creation of an asset to another user.
 * @param {string} packageObjectId - The contract address.
 * @param {string} user - The address of the user creating the asset.
 * @param {string} phygitalTag - The tag of the phygital asset.
 * @param {string} nftName - The name of the NFT.
 * @param {string} nftDescription - The description of the NFT.
 * @param {string} uri - The URI of the NFT.
 * @param {number} royalty - The royalty information.
 * @param {Object} controlcap - The access control capabilities.
 * @param {Object} clock - The clock module for timestamping.
 * @param {Object} sender - The sender address.
 * @returns {Promise<Object>} - The result of the delegate asset creation operation.
 */
export const delegateAssetCreation = async (
	packageObjectId,
	user,
	phygitalTag,
	nftName,
	nftDescription,
	uri,
	royalty,
	controlcap,
	clock,
	sender
) => {
	// Implementation of delegateAssetCreation function
}

/**
 * Destroys a PhygitalNFT asset.
 * @param {string} packageObjectId - The contract address.
 * @param {Object} nft - The PhygitalNFT object to destroy.
 * @param {Object} sender - The sender address.
 * @returns {Promise<Object>} - The result of the destroy operation.
 */
export const destroyAsset = async (packageObjectId, nft, sender) => {
	// Implementation of destroyAsset function
}

/**
 * Sets the URL of a token.
 * @param {string} packageObjectId - The contract address.
 * @param {Object} nft - The PhygitalNFT object.
 * @param {string} url - The new URL of the token.
 * @param {string} sender - The sender address.
 * @returns {Promise<Object>} - The result of the set token URI operation.
 */
export const setTokenURI = async (packageObjectId, nft, url, sender) => {
	// Implementation of setTokenURI function
}

/**
 * Asserts that the caller is an admin.
 * @param {string} packageObjectId - The contract address.
 * @param {Object} controlcap - The access control capabilities.
 * @param {string} user - The address of the user.
 * @param {string} sender - The sender address.
 * @returns {Promise<Object>} - The result of the assertion.
 */
export const assertIsAdmin = async (
	packageObjectId,
	controlcap,
	user,
	sender
) => {
	// Implementation of assertIsAdmin function
}

/**
 * Asserts that the caller is an operator.
 * @param {string} packageObjectId - The contract address.
 * @param {Object} controlcap - The access control capabilities.
 * @param {string} user - The address of the user.
 * @param {string} sender - The sender address.
 * @returns {Promise<Object>} - The result of the assertion.
 */
export const assertIsOperator = async (
	packageObjectId,
	controlcap,
	user,
	sender
) => {
	// Implementation of assertIsOperator function
}

/**
 * Asserts that the caller is a creator.
 * @param {string} packageObjectId - The contract address.
 * @param {Object} controlcap - The access control capabilities.
 * @param {string} user - The address of the user.
 * @param {string} sender - The sender address.
 * @returns {Promise<Object>} - The result of the assertion.
 */
export const assertIsCreator = async (
	packageObjectId,
	controlcap,
	user,
	sender
) => {
	// Implementation of assertIsCreator function
}
