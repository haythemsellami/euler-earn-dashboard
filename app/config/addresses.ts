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
  10: {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL || '',
    blockExplorer: 'https://optimistic.etherscan.io',
    isTestnet: false
  },
  56: {
    name: 'BNB Chain',
    chainId: 56,
    rpcUrl: process.env.NEXT_PUBLIC_BSC_RPC_URL || '',
    blockExplorer: 'https://bscscan.com',
    isTestnet: false
  },
  100: {
    name: 'Gnosis',
    chainId: 100,
    rpcUrl: process.env.NEXT_PUBLIC_GNOSIS_RPC_URL || '',
    blockExplorer: 'https://gnosisscan.io',
    isTestnet: false
  },
  130: {
    name: 'Unichain',
    chainId: 130,
    rpcUrl: process.env.NEXT_PUBLIC_UNICHAIN_RPC_URL || '',
    blockExplorer: 'https://unichain.blockscout.com',
    isTestnet: false
  },
  137: {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || '',
    blockExplorer: 'https://polygonscan.com',
    isTestnet: false
  },
  146: {
    name: 'Sonic',
    chainId: 146,
    rpcUrl: process.env.NEXT_PUBLIC_SONIC_RPC_URL || '',
    blockExplorer: 'https://sonicscan.org',
    isTestnet: false
  },
  480: {
    name: 'World',
    chainId: 480,
    rpcUrl: process.env.NEXT_PUBLIC_WORLD_RPC_URL || '',
    blockExplorer: 'https://worldscan.org',
    isTestnet: false
  },
  1923: {
    name: 'Taiko',
    chainId: 1923,
    rpcUrl: process.env.NEXT_PUBLIC_TAIKO_RPC_URL || '',
    blockExplorer: 'https://explorer.test.taiko.xyz',
    isTestnet: true
  },
  2818: {
    name: 'Morph',
    chainId: 2818,
    rpcUrl: process.env.NEXT_PUBLIC_MORPH_RPC_URL || '',
    blockExplorer: 'https://explorer.morphl2.io',
    isTestnet: false
  },
  8453: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || '',
    blockExplorer: 'https://basescan.org',
    isTestnet: false
  },
  42161: {
    name: 'Arbitrum',
    chainId: 42161,
    rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || '',
    blockExplorer: 'https://arbiscan.io',
    isTestnet: false
  },
  43114: {
    name: 'Avalanche',
    chainId: 43114,
    rpcUrl: process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL || '',
    blockExplorer: 'https://snowtrace.io',
    isTestnet: false
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
  },
  80094: {
    name: 'Bera',
    chainId: 80094,
    rpcUrl: process.env.NEXT_PUBLIC_BERA_RPC_URL || '',
    blockExplorer: 'https://berascan.com',
    isTestnet: false
  },
  21000000: {
    name: 'Corn',
    chainId: 21000000,
    rpcUrl: process.env.NEXT_PUBLIC_CORN_RPC_URL || '',
    blockExplorer: 'https://cornscan.io',
    isTestnet: false
  }
}

export type SupportedChainId = 1 | 10 | 56 | 100 | 130 | 137 | 146 | 480 | 1923 | 2818 | 8453 | 42161 | 43114 | 57073 | 60808 | 80094 | 21000000;

export const CONTRACT_ADDRESSES: {
  EULER_EARN_FACTORY: { [key in SupportedChainId]: string }
} = {
  EULER_EARN_FACTORY: {
    1: '0x9a20d3C0c283646e9701a049a2f8C152Bc1e3427',
    10: '0x317CCF92BEec1B5487C387AEFaCc54F2992165Ce',
    56: '0xd4FffC1e799E714aEd1461C14e95f55b6B3390e8',
    100: '0xE600cACf641e9143fD5e4Bb4157db9C567E908E8',
    130: '0x9efeAc4498d1fA78b750307C2a918Ff491A111DE',
    137: '0x38e3818947a4104Cab38f9B51362E991A970168D',
    146: '0xc8EB6dD027C4Ab1754245F6FdE91B39090C12aDd',
    480: '0xeEB368cCac95171C785cfAd7a099B26078b4F76c',
    1923: '0xf6c81239B4E3c71bFd156223971821438c42Eabc',
    2818: '0x9344a45943993938B628414d820E4a314afC8c2D',
    8453: '0x72bbDB652F2AEC9056115644EfCcDd1986F51f15',
    42161: '0xE141890d98B0a33adC6d10217Ed47daB035D393F',
    43114: '0xe5a94aE6178CFd65856b19A4EB8dD61D85C63E11',
    57073: '0x855A399bE9d3d7afED44346BDe35FD2C8D910668',
    60808: '0x118feebFBaFc7106aE79Dd4d6D2661df4D031B1E',
    80094: '0xDf380dc486a72984fBCBf224dc4e21599485d1B1',
    21000000: '0xEe32De022257ECc34815c8c1F1a1D1c00A356159'
  }
} 