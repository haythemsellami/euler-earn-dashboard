import { getDefaultConfig, type Chain as RainbowChain } from '@rainbow-me/rainbowkit'
import { SUPPORTED_NETWORKS } from './addresses'
import { http, type Chain } from 'viem'
import { type Config, createConfig } from 'wagmi'
import { mainnet, base, arbitrum } from 'wagmi/chains'

// Convert supported networks to wagmi chains
const customChains = Object.entries(SUPPORTED_NETWORKS).reduce<Chain[]>((acc, [chainId, network]) => {
  const chainIdNum = parseInt(chainId)
  // Skip mainnet, base and arbitrum as they're included from wagmi/chains
  if (chainIdNum === 1 || chainIdNum === 8453 || chainIdNum === 42161) {
    return acc
  }
  return acc
}, [])

// Combine predefined chains with custom chains
const chains = [mainnet, base, arbitrum, ...customChains]

const config = getDefaultConfig({
  appName: 'Euler Earn',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: chains as unknown as [RainbowChain, ...RainbowChain[]],
  ssr: true
})

export default config 