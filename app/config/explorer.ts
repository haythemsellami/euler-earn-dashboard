import { SupportedChainId } from './addresses'

export const EXPLORER_URLS: { [key in SupportedChainId]?: string } = {
  1: 'https://etherscan.io',
  10: 'https://optimistic.etherscan.io',
  56: 'https://bscscan.com',
  100: 'https://gnosisscan.io',
  130: 'https://unichain.blockscout.com',
  137: 'https://polygonscan.com',
  146: 'https://sonicscan.org',
  480: 'https://worldscan.org',
  1923: 'https://explorer.test.taiko.xyz',
  2818: 'https://explorer.morphl2.io',
  8453: 'https://basescan.org',
  42161: 'https://arbiscan.io',
  43114: 'https://snowtrace.io',
  57073: 'https://sepolia.etherscan.io',
  60808: 'https://explorer.test.taiko.xyz',
  80094: 'https://berascan.com',
  21000000: 'https://cornscan.io'
}

export const getExplorerAddressLink = (chainId: number, address: string): string | null => {
  const explorerUrl = EXPLORER_URLS[chainId as SupportedChainId]
  if (!explorerUrl) return null
  return `${explorerUrl}/address/${address}`
} 