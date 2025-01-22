import { getDefaultConfig, type Chain as RainbowChain } from '@rainbow-me/rainbowkit'
import { SUPPORTED_NETWORKS } from './addresses'
import { http, type Chain } from 'viem'
import { type Config, createConfig } from 'wagmi'
import { mainnet, sepolia, type Chain as WagmiChain } from 'wagmi/chains'

// Convert supported networks to wagmi chains
const customChains = Object.entries(SUPPORTED_NETWORKS).reduce<Chain[]>((acc, [chainId, network]) => {
  // Skip mainnet and sepolia as they're included from wagmi/chains
  if (parseInt(chainId) === mainnet.id || parseInt(chainId) === sepolia.id) {
    return acc
  }
  
  acc.push({
    id: parseInt(chainId),
    name: network.name,
    network: network.name.toLowerCase(),
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
    },
    rpcUrls: {
      default: { http: [network.rpcUrl] },
      public: { http: [network.rpcUrl] },
    },
    blockExplorers: {
      default: { name: 'Explorer', url: network.blockExplorer },
    },
    testnet: network.isTestnet
  })
  return acc
}, [])

// Combine predefined chains with custom chains
const chains = [mainnet, sepolia, ...customChains]

const config = getDefaultConfig({
  appName: 'Euler Earn',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: chains as unknown as [RainbowChain, ...RainbowChain[]],
  ssr: true
})

export default config 