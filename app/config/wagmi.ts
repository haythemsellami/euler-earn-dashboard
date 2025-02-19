import { getDefaultConfig, type Chain as RainbowChain } from '@rainbow-me/rainbowkit'
import { SUPPORTED_NETWORKS } from './addresses'
import { type Chain } from 'viem'
import {
  mainnet,
  sepolia,
  optimism,
  optimismSepolia,
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  bsc,
  bscTestnet,
  gnosis,
  avalanche,
  avalancheFuji,
  polygon,
  polygonMumbai,
} from 'wagmi/chains'

// Override RPC URLs for wagmi chains if custom RPCs are provided
const mainnetWithCustomRpc = {
  ...mainnet,
  rpcUrls: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL
    ? {
        ...mainnet.rpcUrls,
        default: { http: [process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL] },
        public: { http: [process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL] },
      }
    : mainnet.rpcUrls,
}

const optimismWithCustomRpc = {
  ...optimism,
  rpcUrls: process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL
    ? {
        ...optimism.rpcUrls,
        default: { http: [process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL] },
        public: { http: [process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL] },
      }
    : optimism.rpcUrls,
}

const bscWithCustomRpc = {
  ...bsc,
  rpcUrls: process.env.NEXT_PUBLIC_BSC_RPC_URL
    ? {
        ...bsc.rpcUrls,
        default: { http: [process.env.NEXT_PUBLIC_BSC_RPC_URL] },
        public: { http: [process.env.NEXT_PUBLIC_BSC_RPC_URL] },
      }
    : bsc.rpcUrls,
}

const gnosisWithCustomRpc = {
  ...gnosis,
  rpcUrls: process.env.NEXT_PUBLIC_GNOSIS_RPC_URL
    ? {
        ...gnosis.rpcUrls,
        default: { http: [process.env.NEXT_PUBLIC_GNOSIS_RPC_URL] },
        public: { http: [process.env.NEXT_PUBLIC_GNOSIS_RPC_URL] },
      }
    : gnosis.rpcUrls,
}

const polygonWithCustomRpc = {
  ...polygon,
  rpcUrls: process.env.NEXT_PUBLIC_POLYGON_RPC_URL
    ? {
        ...polygon.rpcUrls,
        default: { http: [process.env.NEXT_PUBLIC_POLYGON_RPC_URL] },
        public: { http: [process.env.NEXT_PUBLIC_POLYGON_RPC_URL] },
      }
    : polygon.rpcUrls,
}

const baseWithCustomRpc = {
  ...base,
  rpcUrls: process.env.NEXT_PUBLIC_BASE_RPC_URL
    ? {
        ...base.rpcUrls,
        default: { http: [process.env.NEXT_PUBLIC_BASE_RPC_URL] },
        public: { http: [process.env.NEXT_PUBLIC_BASE_RPC_URL] },
      }
    : base.rpcUrls,
}

const arbitrumWithCustomRpc = {
  ...arbitrum,
  rpcUrls: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL
    ? {
        ...arbitrum.rpcUrls,
        default: { http: [process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL] },
        public: { http: [process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL] },
      }
    : arbitrum.rpcUrls,
}

const avalancheWithCustomRpc = {
  ...avalanche,
  rpcUrls: process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL
    ? {
        ...avalanche.rpcUrls,
        default: { http: [process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL] },
        public: { http: [process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL] },
      }
    : avalanche.rpcUrls,
}

// Convert supported networks to wagmi chains
const customChains = Object.entries(SUPPORTED_NETWORKS).reduce<Chain[]>((acc, [chainId, network]) => {
  const chainIdNum = parseInt(chainId)
  // Skip chains that are included from wagmi/chains
  if (
    chainIdNum === mainnet.id || // 1
    chainIdNum === optimism.id || // 10
    chainIdNum === bsc.id || // 56
    chainIdNum === gnosis.id || // 100
    chainIdNum === polygon.id || // 137
    chainIdNum === base.id || // 8453
    chainIdNum === arbitrum.id || // 42161
    chainIdNum === avalanche.id || // 43114
    chainIdNum === sepolia.id || // 11155111
    chainIdNum === optimismSepolia.id || // 11155420
    chainIdNum === arbitrumSepolia.id || // 421614
    chainIdNum === baseSepolia.id // 84532
  ) {
    return acc
  }
  
  // Add the custom chain
  acc.push({
    id: chainIdNum,
    name: network.name,
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [network.rpcUrl] },
      public: { http: [network.rpcUrl] },
    },
    blockExplorers: {
      default: { name: network.name, url: network.blockExplorer },
    },
    testnet: network.isTestnet,
  })
  return acc
}, [])

// Combine predefined chains with custom chains
const chains = [
  mainnetWithCustomRpc,
  optimismWithCustomRpc,
  bscWithCustomRpc,
  gnosisWithCustomRpc,
  polygonWithCustomRpc,
  baseWithCustomRpc,
  arbitrumWithCustomRpc,
  avalancheWithCustomRpc,
  ...customChains
]

const config = getDefaultConfig({
  appName: 'Euler Earn',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: chains as unknown as [RainbowChain, ...RainbowChain[]],
  ssr: true
})

export default config 