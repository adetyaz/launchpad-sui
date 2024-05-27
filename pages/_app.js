import { LayoutProvider } from '../layout/context/layoutcontext'

import 'primereact/resources/primereact.css'
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'
import '../styles/layout/layout.scss'
import '../styles/demo/Demos.scss'

import '../styles/demo/LoadingSpinner.css'
import '../node_modules/react-toastify/dist/ReactToastify.css'

export default function MyApp({ Component, pageProps }) {
	return (
		// <ApolloProvider client={client}>

		<LayoutProvider>
			<Component {...pageProps} />
		</LayoutProvider>

		// </ApolloProvider>
	)
}
