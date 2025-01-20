'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { BrowserProvider, JsonRpcSigner, ethers } from 'ethers'
import { SUPPORTED_NETWORKS } from '../config/addresses'

interface WalletContextType {
  account: string | null
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  chainId: number | null
  connectWallet: () => Promise<void>
  switchNetwork: (chainId: number) => Promise<void>
  isConnecting: boolean
  error: string | null
}

const WalletContext = createContext<WalletContextType>({} as WalletContextType)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const switchNetwork = async (targetChainId: number) => {
    setError(null)
    try {
      // @ts-expect-error - ethereum is injected by metamask
      if (!window.ethereum) throw new Error("Please install MetaMask")
      
      const network = SUPPORTED_NETWORKS[targetChainId]
      if (!network) throw new Error("Unsupported network")

      try {
        // Try switching to the network
        // @ts-expect-error - ethereum is injected by metamask
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        })
      } catch (switchError: any) {
        // If the network is not added to MetaMask, add it
        if (switchError.code === 4902) {
          // @ts-expect-error - ethereum is injected by metamask
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${targetChainId.toString(16)}`,
                chainName: network.name,
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [network.rpcUrl],
                blockExplorerUrls: [network.blockExplorer],
              },
            ],
          })
        } else {
          throw switchError
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch network")
    }
  }

  const connectWallet = async () => {
    setIsConnecting(true)
    setError(null)
    try {
      // @ts-expect-error - ethereum is injected by metamask
      if (!window.ethereum) {
        throw new Error("Please install MetaMask to use this app")
      }

      // @ts-expect-error - ethereum is injected by metamask
      const provider = new BrowserProvider(window.ethereum)
      const accounts = await provider.send("eth_requestAccounts", [])
      
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()
      const currentChainId = Number(network.chainId)
      
      setProvider(provider)
      setSigner(signer)
      setAccount(accounts[0])
      setChainId(currentChainId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet")
    }
    setIsConnecting(false)
  }

  useEffect(() => {
    // @ts-expect-error - ethereum is injected by metamask
    if (window.ethereum) {
      // @ts-expect-error - ethereum is injected by metamask
      window.ethereum.on('accountsChanged', async (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0])
          // Refresh signer when account changes
          if (provider) {
            const newSigner = await provider.getSigner()
            setSigner(newSigner)
          }
        } else {
          setAccount(null)
          setSigner(null)
        }
      })

      // @ts-expect-error - ethereum is injected by metamask
      window.ethereum.on('chainChanged', (_chainId: string) => {
        window.location.reload()
      })
    }

    return () => {
      // @ts-expect-error - ethereum is injected by metamask
      if (window.ethereum) {
        // @ts-expect-error - ethereum is injected by metamask
        window.ethereum.removeAllListeners('accountsChanged')
        // @ts-expect-error - ethereum is injected by metamask
        window.ethereum.removeAllListeners('chainChanged')
      }
    }
  }, [provider])

  return (
    <WalletContext.Provider value={{
      account,
      provider,
      signer,
      chainId,
      connectWallet,
      switchNetwork,
      isConnecting,
      error
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
} 