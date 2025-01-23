export const earnVaultABI = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ type: 'string', name: '' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'asset',
    inputs: [],
    outputs: [{ type: 'address', name: '' }],
    stateMutability: 'view'
  }
] as const; 