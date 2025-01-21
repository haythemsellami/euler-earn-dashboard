export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  isTestnet: boolean;
}

export const SUPPORTED_NETWORKS: { [chainId: number]: NetworkConfig } = {
  1: {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || '',
    blockExplorer: 'https://etherscan.io',
    isTestnet: false
  },
  137: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || '',
    blockExplorer: 'https://polygonscan.com',
    isTestnet: false
  },
  42161: {
    name: 'Arbitrum',
    chainId: 42161,
    rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || '',
    blockExplorer: 'https://arbiscan.io',
    isTestnet: false
  },
  8453: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || '',
    blockExplorer: 'https://basescan.org',
    isTestnet: false
  },
  1923: {
    name: 'Taiko',
    chainId: 1923,
    rpcUrl: process.env.NEXT_PUBLIC_TAIKO_RPC_URL || '',
    blockExplorer: 'https://explorer.test.taiko.xyz',
    isTestnet: true
  },
  57073: {
    name: 'Sepolia',
    chainId: 57073,
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || '',
    blockExplorer: 'https://sepolia.etherscan.io',
    isTestnet: true
  },
  60808: {
    name: 'Taiko Testnet',
    chainId: 60808,
    rpcUrl: process.env.NEXT_PUBLIC_TAIKO_TESTNET_RPC_URL || '',
    blockExplorer: 'https://explorer.test.taiko.xyz',
    isTestnet: true
  }
}

export type SupportedChainId = 1 | 137 | 1923 | 57073 | 60808 | 8453 | 42161;

export const CONTRACT_ADDRESSES: {
  EULER_EARN_FACTORY: { [key in SupportedChainId]: string }
} = {
  EULER_EARN_FACTORY: {
    1: '0x9a20d3C0c283646e9701a049a2f8C152Bc1e3427',
    137: '0x38e3818947a4104Cab38f9B51362E991A970168D',
    1923: '0xf6c81239B4E3c71bFd156223971821438c42Eabc',
    57073: '0x855A399bE9d3d7afED44346BDe35FD2C8D910668',
    60808: '0x118feebFBaFc7106aE79Dd4d6D2661df4D031B1E',
    8453: '0x72bbDB652F2AEC9056115644EfCcDd1986F51f15',
    42161: '0xE141890d98B0a33adC6d10217Ed47daB035D393F'
  }
} 