import { UseWalletProvider } from '@binance-chain/bsc-use-wallet'
import { RefreshContextProvider } from './contexts/RefreshContext'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <UseWalletProvider
      chainId={97}
      connectors={{
        walletconnect: {
          rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/'
        }
      }}
    >
      <RefreshContextProvider>
        <Dashboard />
      </RefreshContextProvider>
    </UseWalletProvider>
  );
}

export default App;
