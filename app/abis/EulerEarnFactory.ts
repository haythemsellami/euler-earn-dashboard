export const factoryABI = [
  {
    type: 'function',
    name: 'getEulerEarnVaultsListLength',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getEulerEarnVaultsListSlice',
    inputs: [
      { type: 'uint256', name: 'start' },
      { type: 'uint256', name: 'end' }
    ],
    outputs: [{ type: 'address[]', name: '' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'deployEulerEarn',
    inputs: [
      { type: 'address', name: 'asset' },
      { type: 'string', name: 'name' },
      { type: 'string', name: 'symbol' },
      { type: 'uint256', name: 'initialCashAllocationPoints' },
      { type: 'uint256', name: 'smearingPeriod' }
    ],
    outputs: [{ type: 'address', name: '' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'event',
    name: 'DeployEulerEarn',
    inputs: [
      { type: 'address', name: 'vault', indexed: true },
      { type: 'address', name: 'asset', indexed: true },
      { type: 'address', name: 'deployer', indexed: true }
    ],
    anonymous: false
  }
] as const; 