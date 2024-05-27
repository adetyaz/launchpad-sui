import Link from 'next/link'
import { classNames } from 'primereact/utils'
import React, { useContext, useEffect, useRef, useState } from 'react'
import { LayoutContext } from './context/layoutcontext'
import Image from 'next/image'
import AppConfig from './AppConfig'

import { useRouter, withRouter } from 'next/router'
import axios from 'axios'
import { Toast } from 'primereact/toast'
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client'
import {
	SerializedSignature,
	decodeSuiPrivateKey,
} from '@mysten/sui.js/cryptography'
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519'
import { TransactionBlock } from '@mysten/sui.js/transactions'
import {
	genAddressSeed,
	generateNonce,
	generateRandomness,
	getExtendedEphemeralPublicKey,
	getZkLoginSignature,
	jwtToAddress,
} from '@mysten/zklogin'
import {
	NetworkName,
	makeExplorerUrl,
	requestSuiFromFaucet,
	shortenSuiAddress,
} from '@polymedia/suits'

import { jwtDecode } from 'jwt-decode'

const NETWORK = 'devnet'
const MAX_EPOCH = 2 // keep ephemeral keys active for this many Sui epochs from now (1 epoch ~= 24h)

const suiClient = new SuiClient({
	url: 'https://fullnode.devnet.sui.io',
})

/* Session storage keys */

const setupDataKey = 'zklogin-demo.setup'
const accountDataKey = 'zklogin-demo.accounts'

function AppTopbar() {
	const { layoutConfig, layoutState } = useContext(LayoutContext)
	const [toggle, setToggle] = useState(false)
	const topbarmenuRef = useRef(null)

	const toast = useRef(null)
	const accounts = useRef(loadAccounts()) // useRef() instead of useState() because of setInterval()
	const [balances, setBalances] = useState(new Map()) // Map<Sui address, SUI balance>
	const [modalContent, setModalContent] = useState('')

	useEffect(() => {
		completeZkLogin()
		fetchBalances(accounts.current)
		const interval = setInterval(() => fetchBalances(accounts.current), 5_000)
		return () => {
			clearInterval(interval)
		}
	}, [])

	/* zkLogin end-to-end */

	/**
	 * Start the zkLogin process by getting a JWT token from an OpenID provider.
	 * https://docs.sui.io/concepts/cryptography/zklogin#get-jwt-token
	 */

	/* zkLogin end-to-end */

	/**
	 * Start the zkLogin process by getting a JWT token from an OpenID provider.
	 * https://docs.sui.io/concepts/cryptography/zklogin#get-jwt-token
	 */
	async function beginZkLogin(provider) {
		setModalContent(`🔑 Logging in with ${provider}...`)

		// Create a nonce
		const { epoch } = await suiClient.getLatestSuiSystemState()

		console.log('checking the : ' + epoch)

		const maxEpoch = Number(epoch) + MAX_EPOCH // the ephemeral key will be valid for MAX_EPOCH from now
		const ephemeralKeyPair = new Ed25519Keypair()
		const randomness = generateRandomness()
		const nonce = generateNonce(
			ephemeralKeyPair.getPublicKey(),
			maxEpoch,
			randomness
		)

		// Save data to session storage so completeZkLogin() can use it after the redirect
		saveSetupData({
			provider,
			maxEpoch,
			randomness: randomness.toString(),
			ephemeralPrivateKey: ephemeralKeyPair.getSecretKey(),
		})

		// Start the OAuth flow with the OpenID provider
		const urlParamsBase = {
			nonce: nonce,
			redirect_uri: window.location.origin,
			response_type: 'id_token',
			scope: 'openid',
		}
		let loginUrl
		switch (provider) {
			case 'Google': {
				const urlParams = new URLSearchParams({
					...urlParamsBase,
					client_id: process.env.NEXT_PUBLIC_CLIENT_ID_GOOGLE,
				})
				loginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${urlParams.toString()}`
				break
			}
		}
		window.location.replace(loginUrl)
	}

	/**
	 * Complete the zkLogin process.
	 * It sends the JWT to the salt server to get a salt, then
	 * it derives the user address from the JWT and the salt, and finally
	 * it gets a zero-knowledge proof from the Mysten Labs proving service.
	 */
	async function completeZkLogin() {
		// === Grab and decode the JWT that beginZkLogin() produced ===
		// https://docs.sui.io/concepts/cryptography/zklogin#decoding-jwt

		// grab the JWT from the URL fragment (the '#...')
		const urlFragment = window.location.hash.substring(1)
		const urlParams = new URLSearchParams(urlFragment)
		const jwt = urlParams.get('id_token')
		if (!jwt) {
			return
		}

		// remove the URL fragment
		window.history.replaceState(null, '', window.location.pathname)

		// decode the JWT
		const jwtPayload = jwtDecode(jwt)
		if (!jwtPayload.sub || !jwtPayload.aud) {
			console.warn('[completeZkLogin] missing jwt.sub or jwt.aud')
			return
		}

		// === Get the salt ===
		// https://docs.sui.io/concepts/cryptography/zklogin#user-salt-management

		// const requestOptions =
		//     config.URL_SALT_SERVICE === 'https://salt.api.mystenlabs.com/get_salt'
		//     ? // dev, using a JSON file (same salt all the time)
		//     {
		//         method: 'GET',
		//     }
		//     : // prod, using an actual salt server
		//     {
		//         method: 'POST',
		//         headers: { 'Content-Type': 'application/json' },
		//         body: JSON.stringify({ jwt }),
		//     };

		// const saltResponse: { salt: string } | null =
		//     await fetch(config.URL_SALT_SERVICE, requestOptions)
		//     .then(res => {
		//         console.debug('[completeZkLogin] salt service success');
		//         return res.json();
		//     })
		//     .catch((error: unknown) => {
		//         console.warn('[completeZkLogin] salt service error:', error);
		//         return null;
		//     });

		// if (!saltResponse) {
		//     return;
		// }

		const userSalt = '1234567899867'

		// === Get a Sui address for the user ===
		// https://docs.sui.io/concepts/cryptography/zklogin#get-the-users-sui-address

		const userAddr = jwtToAddress(jwt, userSalt)

		// === Load and clear the data which beginZkLogin() created before the redirect ===
		const setupData = loadSetupData()
		if (!setupData) {
			console.warn('[completeZkLogin] missing session storage data')
			return
		}
		clearSetupData()
		for (const account of accounts.current) {
			if (userAddr === account.userAddr) {
				console.warn(
					`[completeZkLogin] already logged in with this ${setupData.provider} account`
				)
				return
			}
		}

		// === Get the zero-knowledge proof ===
		// https://docs.sui.io/concepts/cryptography/zklogin#get-the-zero-knowledge-proof

		const ephemeralKeyPair = keypairFromSecretKey(setupData.ephemeralPrivateKey)
		const ephemeralPublicKey = ephemeralKeyPair.getPublicKey()
		const payload = JSON.stringify(
			{
				maxEpoch: setupData.maxEpoch,
				jwtRandomness: setupData.randomness,
				extendedEphemeralPublicKey:
					getExtendedEphemeralPublicKey(ephemeralPublicKey),
				jwt,
				salt: userSalt.toString(),
				keyClaimName: 'sub',
			},
			null,
			2
		)

		console.debug('[completeZkLogin] Requesting ZK proof with:', payload)
		setModalContent('⏳ Requesting ZK proof. This can take a few seconds...')

		const zkProofs = await fetch(process.env.NEXT_PUBLIC_URL_ZK_PROVER, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: payload,
		})
			.then((res) => {
				console.debug('[completeZkLogin] ZK proving service success')
				return res.json()
			})
			.catch((error) => {
				console.warn('[completeZkLogin] ZK proving service error:', error)
				return null
			})
			.finally(() => {
				setModalContent('')
			})

		if (!zkProofs) {
			return
		}

		// === Save data to session storage so sendTransaction() can use it ===
		saveAccount({
			provider: setupData.provider,
			userAddr,
			zkProofs,
			ephemeralPrivateKey: setupData.ephemeralPrivateKey,
			userSalt: userSalt.toString(),
			sub: jwtPayload.sub,
			aud:
				typeof jwtPayload.aud === 'string' ? jwtPayload.aud : jwtPayload.aud[0],
			maxEpoch: setupData.maxEpoch,
		})
		window.location.reload()
	}

	/**
	 * Assemble a zkLogin signature and submit a transaction
	 * https://docs.sui.io/concepts/cryptography/zklogin#assemble-the-zklogin-signature-and-submit-the-transaction
	 */
	async function sendTransaction(account) {
		setModalContent('🚀 Sending transaction...')

		// Sign the transaction bytes with the ephemeral private key
		const txb = new TransactionBlock()
		txb.setSender(account.userAddr)

		const ephemeralKeyPair = keypairFromSecretKey(account.ephemeralPrivateKey)
		const { bytes, signature: userSignature } = await txb.sign({
			client: suiClient,
			signer: ephemeralKeyPair,
		})

		// Generate an address seed by combining userSalt, sub (subject ID), and aud (audience)
		const addressSeed = genAddressSeed(
			window.BigInt(account.userSalt),
			'sub',
			account.sub,
			account.aud
		).toString()

		// Serialize the zkLogin signature by combining the ZK proof (inputs), the maxEpoch,
		// and the ephemeral signature (userSignature)
		const zkLoginSignature = getZkLoginSignature({
			inputs: {
				...account.zkProofs,
				addressSeed,
			},
			maxEpoch: account.maxEpoch,
			userSignature,
		})

		// Execute the transaction
		await suiClient
			.executeTransactionBlock({
				transactionBlock: bytes,
				signature: zkLoginSignature,
				options: {
					showEffects: true,
				},
			})
			.then((result) => {
				console.debug(
					'[sendTransaction] executeTransactionBlock response:',
					result
				)
				fetchBalances([account])
			})
			.catch((error) => {
				console.warn('[sendTransaction] executeTransactionBlock failed:', error)
				return null
			})
			.finally(() => {
				setModalContent('')
			})
	}

	/**
	 * Create a keypair from a base64-encoded secret key
	 */
	function keypairFromSecretKey(privateKeyBase64) {
		const keyPair = decodeSuiPrivateKey(privateKeyBase64)
		return Ed25519Keypair.fromSecretKey(keyPair.secretKey)
	}

	/**
	 * Get the SUI balance for each account
	 */
	async function fetchBalances(accounts) {
		if (accounts.length == 0) {
			return
		}
		const newBalances = new Map()
		for (const account of accounts) {
			const suiBalance = await suiClient.getBalance({
				owner: account.userAddr,
				coinType: '0x2::sui::SUI',
			})
			newBalances.set(
				account.userAddr,
				+suiBalance.totalBalance / 1_000_000_000
			)
		}
		setBalances((prevBalances) => new Map([...prevBalances, ...newBalances]))
	}

	/* Session storage */

	function saveSetupData(data) {
		if (typeof window !== 'undefined') {
			sessionStorage.setItem(setupDataKey, JSON.stringify(data))
		}
	}

	function loadSetupData() {
		if (typeof window !== 'undefined') {
			const dataRaw = sessionStorage.getItem(setupDataKey)
			console.log('dataraw', dataRaw)
			if (!dataRaw) {
				return null
			}
			const data = JSON.parse(dataRaw)
			return data
		}
		// Add a return statement here to cover the case when typeof window is undefined
		return null
	}

	function clearSetupData() {
		if (typeof window !== 'undefined') {
			sessionStorage.removeItem(setupDataKey)
		}
	}

	function saveAccount(account) {
		const newAccounts = [account, ...accounts.current]
		if (typeof window !== 'undefined') {
			sessionStorage.setItem(accountDataKey, JSON.stringify(newAccounts))
			accounts.current = newAccounts
			fetchBalances([account])
		}
	}

	function loadAccounts() {
		if (typeof window !== 'undefined') {
			const dataRaw = sessionStorage.getItem(accountDataKey)
			if (!dataRaw) {
				return []
			}
			try {
				const data = JSON.parse(dataRaw)
				return data
			} catch (error) {
				console.error('Error parsing account data:', error)
				return []
			}
		}
		return []
	}

	function clearState() {
		sessionStorage.clear()
		accounts.current = []
		setBalances(new Map())
		window.location.reload()
	}

	/* HTML */

	const openIdProviders = ['Google']

	return (
		<div className='layout-topbar'>
			<Link href='/launchpad' className='layout-topbar-logo'>
				<Image
					src={`./${
						layoutConfig.colorScheme !== 'light' ? 'dark' : 'Rectangle'
					}.svg`}
					width='60'
					height='60'
					widt={'true'}
					alt='logo'
				/>
				<img
					src='./myriadflow.png'
					style={{ width: '170px', height: '20px' }}
				></img>
			</Link>
			<div
				ref={topbarmenuRef}
				className={classNames('layout-topbar-menu', {
					'layout-topbar-menu-mobile-active': layoutState.profileSidebarVisible,
				})}
			>
				<Toast ref={toast} />
				{/* <a
          onClick={() => (isConnected ? null : showSuccessPro())}
          href={isConnected && !getplan ? "/buySubscription" : "/profile"}
        >
          <span className="font-bold text-white text-2xl">Launch</span>
        </a> */}

				<Link
					// onClick={() => (isConnected ? null : showSuccessPro())}
					href={'/dashboard'}
				>
					<span className='font-bold text-white text-2xl'>Dashboard</span>
				</Link>

				<div>
					<div>
						{/* <Modal content={modalContent} /> */}
						{
							// <div
							//   className="flex border border-gray-300 px-1 py-1 rounded-lg"
							//   style={{ backgroundColor: '#BFCFE7' }}
							// >
							<div className='flex gap-2'>
								<div className='text-xs leading-6 text-gray-700 sm:col-span-2 text-black'>
									<div>
										{accounts.current.length > 0 && (
											<div
												className='flex border border-gray-300 px-1 py-1 rounded-lg'
												style={{ backgroundColor: '#BFCFE7' }}
											>
												<div id='accounts' className='section'>
													{accounts.current.map((acct) => {
														const balance = balances.get(acct.userAddr)
														const explorerLink = makeExplorerUrl(
															NETWORK,
															'address',
															acct.userAddr
														)

														return (
															<div
																className='account flex gap-2 text-xs'
																key={acct.userAddr}
															>
																{/* {avatarUrl && (
																	<img
																		src={avatarUrl}
																		alt='Avatar'
																		style={{ width: 40 }}
																	/> */}
																avatar
																<div>
																	<div>
																		Address:{' '}
																		<a
																			target='_blank'
																			rel='noopener noreferrer'
																			href={explorerLink}
																		>
																			{shortenSuiAddress(
																				acct.userAddr,
																				6,
																				6,
																				'0x',
																				'...'
																			)}
																		</a>
																	</div>

																	<div>
																		Balance:{' '}
																		{typeof balance === 'undefined'
																			? '(loading)'
																			: `${balance} SUI`}
																	</div>

																	<div className='flex justify-between'>
																		<button
																			className='btn-faucet text-green-600 font-bold'
																			onClick={() => {
																				requestSuiFromFaucet(
																					NETWORK,
																					acct.userAddr
																				)
																				setModalContent(
																					'💰 Requesting SUI from faucet. This will take a few seconds...'
																				)
																				setTimeout(() => {
																					setModalContent('')
																				}, 3000)
																			}}
																		>
																			Faucet SUI
																		</button>

																		<button
																			className='text-red-500 font-bold'
																			onClick={() => {
																				clearState()
																			}}
																		>
																			Log Out
																		</button>
																	</div>
																</div>
															</div>
														)
													})}
												</div>
											</div>
										)}
									</div>
								</div>
							</div>

							// </div>
						}
						{accounts.current.length <= 0 && (
							<div>
								{/* <button onClick={()=>{setloginbox(true)}} className="px-4">Login</button> */}
								{openIdProviders.map((provider) => (
									<button
										className={`btn-login ${provider} flex gap-2 border border-white p-2 rounded-lg`}
										onClick={() => {
											beginZkLogin(provider)
										}}
										key={provider}
									>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											x='0px'
											y='0px'
											width='24'
											height='24'
											viewBox='0 0 48 48'
										>
											<path
												fill='#FFC107'
												d='M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z'
											></path>
											<path
												fill='#FF3D00'
												d='M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z'
											></path>
											<path
												fill='#4CAF50'
												d='M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z'
											></path>
											<path
												fill='#1976D2'
												d='M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z'
											></path>
										</svg>
										<span className='text-white text-sm mt-0.5'>
											Login with Google
										</span>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
				<div onClick={() => setToggle(!toggle)}>
					<img className='cursor-pointer' src='/profile.png'></img>
				</div>

				{toggle && (
					<div
						className='profile-drop bg-white p-3'
						style={{
							borderRadius: '10px',
							marginTop: '165px',
							position: 'absolute',
							right: '0px',
							border: '1px solid',
						}}
					>
						<div style={{ color: 'black' }} className='flex gap-2 mt-2 '>
							<div>
								<i className='pi pi-eye'></i>
							</div>
							<Link
								onClick={() => (isConnected ? null : showSuccessPro())}
								href={isConnected ? '/profile' : ''}
								style={{ color: 'black' }}
							>
								<div>
									<div className='font-bold'>View profile</div>
								</div>
							</Link>
						</div>
						<div className='border-bottom-das'></div>

						{localStorage.getItem('profiledetails') && (
							<div
								onClick={logout}
								style={{ color: 'black' }}
								className='flex gap-2 mt-2 p-heading'
							>
								<div>
									<i className='pi pi-sign-out'></i>
								</div>
								<div className=' cursor-pointer'>
									<div className='font-bold '>Logout</div>
								</div>
							</div>
						)}
					</div>
				)}
				<div className='w-1rem h-1rem'>
					<AppConfig className='w-1rem h-1rem' />
				</div>
			</div>
		</div>
	)
}

export default withRouter(AppTopbar)
