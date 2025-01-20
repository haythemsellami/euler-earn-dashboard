import { SupportedChainId } from './addresses'

export const EXPLORER_URLS: { [key in SupportedChainId]?: string } = {
  1: 'https://etherscan.io',
  137: 'https://polygonscan.com',
  42161: 'https://arbiscan.io',
  8453: 'https://basescan.org',
  57073: 'https://sepolia.etherscan.io'
}

export const getExplorerAddressLink = (chainId: number, address: string): string | null => {
  const explorerUrl = EXPLORER_URLS[chainId as SupportedChainId]
  if (!explorerUrl) return null
  return `${explorerUrl}/address/${address}`
} 