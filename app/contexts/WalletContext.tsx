'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useAccount, useChainId, useWalletClient, useSwitchChain, usePublicClient } from 'wagmi'

interface WalletContextType {
  account: string | null
  chainId: number | null
  isConnecting: boolean
  error: string | null
  switchNetwork: (chainId: number) => Promise<void>
}

const WalletContext = createContext<WalletContextType>({} as WalletContextType)

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnecting: accountConnecting } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync, error: switchError } = useSwitchChain()

  const switchNetworkWrapper = async (targetChainId: number) => {
    if (!switchChainAsync) return
    try {
      await switchChainAsync({ chainId: targetChainId })
    } catch (err) {
      console.error('Error switching network:', err)
      throw err
    }
  }

  const value = {
    account: address || null,
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