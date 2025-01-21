'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useAccount, useChainId, useWalletClient, useSwitchChain } from 'wagmi'
import { createPublicClient, http, PublicClient, WalletClient } from 'viem'
import { SUPPORTED_NETWORKS } from '../config/addresses'

// Helper to create a viem Public Client
const createViemPublicClient = (rpcUrl: string): PublicClient => {
  return createPublicClient({
    transport: http(rpcUrl)
  })
}

interface WalletContextType {
  account: string | null
  publicClient: PublicClient | null
  walletClient: WalletClient | null
  chainId: number | null
  isConnecting: boolean
  error: string | null
  switchNetwork: (chainId: number) => Promise<void>
}

const WalletContext = createContext<WalletContextType>({} as WalletContextType)

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnecting: accountConnecting } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync, error: switchError } = useSwitchChain()

  // Create public client based on current chain
  const publicClient = chainId && SUPPORTED_NETWORKS[chainId]?.rpcUrl
    ? createViemPublicClient(SUPPORTED_NETWORKS[chainId].rpcUrl)
    : null

  const switchNetworkWrapper = async (targetChainId: number) => {
    if (!switchChainAsync) return
    if (!SUPPORTED_NETWORKS[targetChainId]) throw new Error("Unsupported network")
    
    try {
      await switchChainAsync({ chainId: targetChainId })
    } catch (err) {
      console.error('Error switching network:', err)
      throw err
    }
  }

  const value = {
    account: address || null,
    publicClient,
    walletClient: walletClient || null,
    chainId,
    isConnecting: accountConnecting,
    error: switchError?.message || null,
    switchNetwork: switchNetworkWrapper
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
} 