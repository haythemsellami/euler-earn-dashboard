'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useWallet } from '../../contexts/WalletContext'
import { Header } from '../../components/Header'
import earnVaultABI from '@/app/abis/EulerEarn.json'
import erc20ABI from '@/app/abis/ERC20.json'
import { useNotification } from '@/hooks/useNotification'
import { getExplorerAddressLink } from '../../config/explorer'
import { useToast } from "@/components/ui/use-toast"
import { usePublicClient, useWalletClient } from 'wagmi'
import { decodeEventLog, isAddress, zeroAddress, keccak256, toHex } from 'viem'
import type { Address } from 'viem'
import { ConfigGuideDialog } from '../../components/ConfigGuideDialog'

const roles = [
  "DEFAULT_ADMIN_ROLE",
  "GUARDIAN_ADMIN",
  "STRATEGY_OPERATOR_ADMIN",
  "EULER_EARN_MANAGER_ADMIN",
  "WITHDRAWAL_QUEUE_MANAGER_ADMIN",
  "REBALANCER_ADMIN",
  "GUARDIAN",
  "STRATEGY_OPERATOR",
  "EULER_EARN_MANAGER",
  "WITHDRAWAL_QUEUE_MANAGER",
  "REBALANCER"
]

// Add mapping for admin roles
const roleToAdminRole: Record<string, string> = {
  "GUARDIAN": "GUARDIAN_ADMIN",
  "STRATEGY_OPERATOR": "STRATEGY_OPERATOR_ADMIN",
  "EULER_EARN_MANAGER": "EULER_EARN_MANAGER_ADMIN",
  "WITHDRAWAL_QUEUE_MANAGER": "WITHDRAWAL_QUEUE_MANAGER_ADMIN",
  "REBALANCER": "REBALANCER_ADMIN",
  // Admin roles are managed by DEFAULT_ADMIN_ROLE
  "GUARDIAN_ADMIN": "DEFAULT_ADMIN_ROLE",
  "STRATEGY_OPERATOR_ADMIN": "DEFAULT_ADMIN_ROLE",
  "EULER_EARN_MANAGER_ADMIN": "DEFAULT_ADMIN_ROLE",
  "WITHDRAWAL_QUEUE_MANAGER_ADMIN": "DEFAULT_ADMIN_ROLE",
  "REBALANCER_ADMIN": "DEFAULT_ADMIN_ROLE",
  "DEFAULT_ADMIN_ROLE": "DEFAULT_ADMIN_ROLE"
}

// Mock function to generate random addresses
const generateRandomAddress = () => {
  return '0x' + [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
}

// Update the getRoleOwners function to fetch from contract
const getRoleOwners = async (role: string, publicClient: any, vaultAddress: Address) => {
  try {
    // Get role hash - use 0x00 for DEFAULT_ADMIN_ROLE
    const roleHash = role === "DEFAULT_ADMIN_ROLE" ? 
      "0x0000000000000000000000000000000000000000000000000000000000000000" :  // 0x00 for DEFAULT_ADMIN_ROLE
      keccak256(toHex(role))
    
    const vault = {
      address: vaultAddress,
      abi: earnVaultABI,
    }

    // Get role members count
    const memberCount = await publicClient.readContract({
      ...vault,
      functionName: 'getRoleMemberCount',
      args: [roleHash]
    })
    
    if (memberCount === BigInt(0)) {
      return [zeroAddress]
    }

    // Get all members for the role
    const owners = await Promise.all(
      Array.from({ length: Number(memberCount) }, (_, i) => 
        publicClient.readContract({
          ...vault,
          functionName: 'getRoleMember',
          args: [roleHash, BigInt(i)]
        })
      )
    )

    return owners
  } catch (err) {
    console.error(`Error fetching owners for role ${role}:`, err)
    return [zeroAddress]
  }
}

// Add type for strategy details from contract
type StrategyDetails = {
  allocationPoints: bigint;
  allocated: bigint;
  cap: bigint;
  status: number;
}

const StrategyStatus = {
  Inactive: 'inactive',
  Active: 'active',
  Emergency: 'emergency'
} as const;

type StrategyStatus = typeof StrategyStatus[keyof typeof StrategyStatus];

type Strategy = {
  address: Address;
  name: string;
  status: StrategyStatus;
  allocationPoints: bigint;
  allocated: bigint;
  assetDecimals: number;
  assetSymbol: string;
  cap: bigint;
};

// Add helper function to resolve AmountCap
const resolveAmountCap = (amountCap: bigint) => {
  // Convert BigInt to number since we're dealing with uint16
  const cap = Number(amountCap)
  
  if (cap === 0) return BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935') // max uint256

  // Extract exponent (least significant 6 bits)
  const exponent = cap & 63
  // Extract mantissa (most significant 10 bits)
  const mantissa = cap >> 6

  // Calculate: 10^exponent * mantissa / 100
  return BigInt(Math.floor(Math.pow(10, exponent) * mantissa / 100))
}

// Add function to calculate total allocation points
const getTotalAllocationPoints = (strategies: Strategy[]): bigint => {
  return strategies.reduce((total: bigint, strategy: Strategy) => total + strategy.allocationPoints, BigInt(0))
}

const isCashReserve = (address: Address) => {
  return address === zeroAddress;
};

// Helper function to format amount with decimals
const formatAmount = (amount: bigint, decimals: number) => {
  // Calculate divisor using BigInt
  let divisor = BigInt(1);
  for (let i = 0; i < decimals; i++) {
    divisor = divisor * BigInt(10);
  }
  
  const beforeDecimal = amount / divisor
  const afterDecimal = amount % divisor
  
  // Convert after decimal to string and pad with leading zeros
  let afterDecimalStr = afterDecimal.toString();
  // Pad with leading zeros if necessary
  while (afterDecimalStr.length < decimals) {
    afterDecimalStr = '0' + afterDecimalStr;
  }
  
  // Trim trailing zeros after decimal
  const trimmedAfterDecimal = afterDecimalStr.replace(/0+$/, '')
  
  // If there are no significant digits after decimal, return just the whole number
  if (trimmedAfterDecimal === '') {
    return beforeDecimal.toString()
  }
  
  return `${beforeDecimal}.${trimmedAfterDecimal}`
}

// Helper function to convert amount to AmountCap uint16
const convertToAmountCap = (amount: string, decimals: number): number => {
  if (!amount || amount === '0') return 0 // Special case: no cap

  // Calculate 10^decimals without using Math.pow
  let decimalMultiplier = BigInt(1)
  for (let i = 0; i < decimals; i++) {
    decimalMultiplier = decimalMultiplier * BigInt(10)
  }
  
  // Convert amount to base units (e.g., 3 USDC = 3000000)
  const baseUnits = BigInt(Math.floor(parseFloat(amount) * Number(decimalMultiplier)))
  
  // Find appropriate exponent and mantissa
  // We need: mantissa * 10^exponent / 100 = baseUnits
  // Start with mantissa = baseUnits * 100 to account for the division in the formula
  let mantissa = Number(baseUnits * BigInt(100))
  let exponent = 0
  
  // Adjust mantissa to fit in 10 bits (max 1023)
  while (mantissa > 1023) {
    mantissa = Math.floor(mantissa / 10)
    exponent++
  }
  
  // Combine into uint16: mantissa in top 10 bits, exponent in bottom 6 bits
  const result = (mantissa << 6) | exponent
  
  // Verify the result (for debugging)
  const resultMantissa = result >> 6
  const resultExponent = result & 0x3f
  
  // Calculate verification value using string operations to avoid BigInt/Number mixing
  let verificationValue = BigInt(resultMantissa)
  for (let i = 0; i < resultExponent; i++) {
    verificationValue = verificationValue * BigInt(10)
  }
  verificationValue = verificationValue / BigInt(100)
  
  console.log('Debug Cap Conversion:', {
    input: amount,
    baseUnits: baseUnits.toString(),
    mantissa,
    exponent,
    result,
    resultMantissa,
    resultExponent,
    reconstructed: verificationValue.toString()
  })
  
  return result
}

// Add function to get strategy status from number
const getStrategyStatus = (status: number): StrategyStatus => {
  switch (status) {
    case 0:
      return StrategyStatus.Inactive;
    case 1:
      return StrategyStatus.Active;
    case 2:
      return StrategyStatus.Emergency;
    default:
      return StrategyStatus.Inactive;
  }
}

// Update the status display in the UI
const getStatusDisplay = (status: StrategyStatus): { text: string; className: string } => {
  switch (status) {
    case StrategyStatus.Active:
      return { text: 'Active', className: 'text-green-600' };
    case StrategyStatus.Emergency:
      return { text: 'Emergency', className: 'text-red-600' };
    case StrategyStatus.Inactive:
      return { text: 'Inactive', className: 'text-gray-600' };
  }
}

// Update the strategy list filtering
const getActiveStrategies = (strategies: Strategy[]) => 
  strategies.filter(strategy => strategy.status === StrategyStatus.Active && !isCashReserve(strategy.address));

// Update the strategy status checks
const isStrategyActive = (strategy: Strategy) => strategy.status === StrategyStatus.Active;
const isStrategyEmergency = (strategy: Strategy) => strategy.status === StrategyStatus.Emergency;
const isStrategyInactive = (strategy: Strategy) => strategy.status === StrategyStatus.Inactive;

// Update the emergency toggle button text
const getEmergencyToggleText = (strategy: Strategy, isProcessing: boolean) => {
  if (isProcessing) {
    return strategy.status === StrategyStatus.Active ? 'Setting Emergency...' : 'Setting Active...';
  }
  return strategy.status === StrategyStatus.Active ? 'Set Emergency' : 'Set Active';
};

export default function ConfigureVault({ params: { address } }: { params: { address: string } }) {
  const { toast } = useToast();
  const { chainId } = useWallet();
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [roleOwners, setRoleOwners] = useState<Record<string, Address[]>>({});
  const [isLoadingOwners, setIsLoadingOwners] = useState(true);
  const [selectedStrategies, setSelectedStrategies] = useState<{ id: Address; order: number }[]>([]);
  const { showNotification, NotificationDialog } = useNotification()

  const [selectedRole, setSelectedRole] = useState<string>('')
  const [newAddress, setNewAddress] = useState<string>('')
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(true)
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({})
  const [newStrategyAddress, setNewStrategyAddress] = useState('')
  const [newStrategyAllocationPoints, setNewStrategyAllocationPoints] = useState('')
  const [adjustingStrategy, setAdjustingStrategy] = useState<Address | null>(null)
  const [newAllocationPoints, setNewAllocationPoints] = useState('')
  const [settingCapStrategy, setSettingCapStrategy] = useState<Address | null>(null)
  const [newCap, setNewCap] = useState('')
  const [earnStrategies, setEarnStrategies] = useState<Strategy[]>([])
  const [vaultName, setVaultName] = useState<string>('')
  const [vaultAsset, setVaultAsset] = useState<{ address: Address; symbol: string }>({ address: zeroAddress, symbol: '' })
  const [availableRoles, setAvailableRoles] = useState<string[]>([])

  // Add function to check if an address has a role
  const checkHasRole = async (role: string, account: Address) => {
    if (!publicClient || !address) return false;

    try {
      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      const roleHash = role === "DEFAULT_ADMIN_ROLE" ? 
        "0x0000000000000000000000000000000000000000000000000000000000000000" :
        keccak256(toHex(role));
      
      return await publicClient.readContract({
        ...vault,
        functionName: 'hasRole',
        args: [roleHash, account]
      });
    } catch (err) {
      console.error(`Error checking role ${role} for account ${account}:`, err);
      return false;
    }
  };

  // Add function to update available roles
  const updateAvailableRoles = useCallback(async () => {
    if (!walletClient || !address) return;

    try {
      const availableRoles = await Promise.all(
        Object.values(roles).map(async (role) => {
          const hasRole = await checkHasRole(role, walletClient.account.address);
          return { role, hasRole };
        })
      );

      setAvailableRoles(
        availableRoles
          .filter(({ hasRole }) => hasRole)
          .map(({ role }) => role)
      );
    } catch (error) {
      console.error('Error checking roles:', error);
    }
  }, [walletClient, address]);

  // Add effect to update available roles when signer changes
  useEffect(() => {
    if (walletClient && address) {
      updateAvailableRoles();
    }
  }, [walletClient, address, updateAvailableRoles]);

  // Add effect to fetch strategies
  const fetchStrategies = useCallback(async () => {
    if (!publicClient || !address) return;

    try {
      setIsLoadingStrategies(true);
      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      console.log('Fetching strategies for vault:', address.toString());

      const asset = await publicClient.readContract({
        ...vault,
        functionName: 'asset'
      }) as Address;

      const assetContract = {
        address: asset,
        abi: erc20ABI,
      }

      const [assetSymbol, assetDecimals] = await Promise.all([
        publicClient.readContract({
          ...assetContract,
          functionName: 'symbol'
        }),
        publicClient.readContract({
          ...assetContract,
          functionName: 'decimals'
        })
      ]);

      console.log('Asset details:', { asset, assetSymbol, assetDecimals });

      // Get cash reserve (address 0) details first
      const cashReserveStrategy = await publicClient.readContract({
        ...vault,
        functionName: 'getStrategy',
        args: [zeroAddress]
      }) as StrategyDetails;

      const [totalAssetsAllocatable, totalAllocated] = await Promise.all([
        publicClient.readContract({
          ...vault,
          functionName: 'totalAssetsAllocatable'
        }),
        publicClient.readContract({
          ...vault,
          functionName: 'totalAllocated'
        })
      ]);

      const cashReserveAllocated = (totalAssetsAllocatable as bigint) - (totalAllocated as bigint);
      console.log('Cash reserve details:', {
        ...cashReserveStrategy,
        actualAllocated: cashReserveAllocated.toString()
      });

      const formattedCashReserve: Strategy = {
        address: zeroAddress,
        name: "Cash Reserve",
        status: StrategyStatus.Active,
        allocationPoints: cashReserveStrategy.allocationPoints,
        allocated: cashReserveAllocated,
        assetDecimals: Number(assetDecimals),
        assetSymbol: assetSymbol as string,
        cap: cashReserveStrategy.cap,
      };

      // Get other strategies from withdrawal queue
      const strategyAddresses = await publicClient.readContract({
        ...vault,
        functionName: 'withdrawalQueue'
      }) as Address[];

      console.log('Strategy addresses from withdrawal queue:', strategyAddresses);

      const strategies = await Promise.all(
        strategyAddresses.map(async (strategyAddress) => {
          console.log('Fetching details for strategy:', strategyAddress);
          const strategyDetails = await publicClient.readContract({
            ...vault,
            functionName: 'getStrategy',
            args: [strategyAddress]
          }) as StrategyDetails;

          const strategyContract = {
            address: strategyAddress,
            abi: earnVaultABI,
          }

          let name;
          try {
            name = await publicClient.readContract({
              ...strategyContract,
              functionName: 'name'
            }) as string;
          } catch (err) {
            console.warn('Failed to get strategy name:', err);
            name = `Strategy ${strategyAddress.slice(0, 6)}...${strategyAddress.slice(-4)}`;
          }

          console.log('Strategy details:', {
            address: strategyAddress,
            name,
            status: strategyDetails.status,
            allocationPoints: strategyDetails.allocationPoints.toString(),
            allocated: strategyDetails.allocated.toString(),
            cap: strategyDetails.cap.toString()
          });

          return {
            address: strategyAddress,
            name,
            status: getStrategyStatus(Number(strategyDetails.status)),
            allocationPoints: strategyDetails.allocationPoints,
            allocated: strategyDetails.allocated,
            assetDecimals: Number(assetDecimals),
            assetSymbol: assetSymbol as string,
            cap: strategyDetails.cap,
          };
        })
      );

      console.log('All strategies:', [formattedCashReserve, ...strategies]);
      setEarnStrategies([formattedCashReserve, ...strategies]);
    } catch (error) {
      console.error('Error fetching strategies:', error);
      toast({
        title: "Error",
        description: "Failed to fetch strategies",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStrategies(false);
    }
  }, [publicClient, address]);

  // Add useEffect to fetch strategies
  useEffect(() => {
    if (walletClient && address) {
      fetchStrategies();
    }
  }, [walletClient, address, fetchStrategies]);

  // Add useEffect to fetch role owners
  const fetchRoleOwners = useCallback(async () => {
    if (!publicClient || !address) return;

    setIsLoadingOwners(true);
    try {
      const ownersMap = await Promise.all(
        roles.map(async (role) => {
          const owners = await getRoleOwners(role, publicClient, address as Address);
          return [role, owners];
        })
      );

      setRoleOwners(Object.fromEntries(ownersMap));
    } catch (err) {
      console.error('Error fetching role owners:', err);
    } finally {
      setIsLoadingOwners(false);
    }
  }, [publicClient, address]);

  useEffect(() => {
    if (publicClient && address) {
      fetchRoleOwners();
    }
  }, [publicClient, address, fetchRoleOwners]);

  // Add useEffect to fetch vault details
  useEffect(() => {
    const fetchVaultDetails = async () => {
      if (!publicClient || !address) return;

      try {
        const vault = {
          address: address as Address,
          abi: earnVaultABI,
        }

        const [name, assetAddress] = await Promise.all([
          publicClient.readContract({
            ...vault,
            functionName: 'name'
          }),
          publicClient.readContract({
            ...vault,
            functionName: 'asset'
          })
        ]);

        const assetContract = {
          address: assetAddress as Address,
          abi: erc20ABI,
        }

        const assetSymbol = await publicClient.readContract({
          ...assetContract,
          functionName: 'symbol'
        });

        setVaultName(name as string);
        setVaultAsset({ address: assetAddress as Address, symbol: assetSymbol as string });
      } catch (err) {
        console.error('Error fetching vault details:', err);
      }
    };

    fetchVaultDetails();
  }, [publicClient, address]);

  const handleGrantRole = async () => {
    if (!selectedRole || !newAddress || !walletClient || !address) return;

    try {
      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      // Get role hash - use 0x00 for DEFAULT_ADMIN_ROLE
      const roleHash = selectedRole === "DEFAULT_ADMIN_ROLE" ? 
        "0x0000000000000000000000000000000000000000000000000000000000000000" :
        keccak256(toHex(selectedRole))

      setIsProcessing(prev => ({ ...prev, 'grant-role': true }))

      const hash = await walletClient.writeContract({
        ...vault,
        functionName: 'grantRole',
        args: [roleHash, newAddress as Address]
      })

      await publicClient?.waitForTransactionReceipt({ hash })

      // Refresh the role owners
      const owners = await getRoleOwners(selectedRole, publicClient!, address as Address)
      setRoleOwners(prev => ({
        ...prev,
        [selectedRole]: owners
      }))

      setNewAddress('')
      showNotification('Success', `Role ${selectedRole} granted to ${newAddress}`, 'success')
    } catch (err: any) {
      console.error('Error granting role:', err)
      showNotification('Error', `Failed to grant role: ${err.message}`, 'error')
    } finally {
      setIsProcessing(prev => ({ ...prev, 'grant-role': false }))
    }
  }

  const handleRevokeRole = async () => {
    if (!selectedRole || !newAddress || !walletClient || !address) return;

    try {
      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      // Get role hash - use 0x00 for DEFAULT_ADMIN_ROLE
      const roleHash = selectedRole === "DEFAULT_ADMIN_ROLE" ? 
        "0x0000000000000000000000000000000000000000000000000000000000000000" :
        keccak256(toHex(selectedRole))

      setIsProcessing(prev => ({ ...prev, 'revoke-role': true }))

      const hash = await walletClient.writeContract({
        ...vault,
        functionName: 'revokeRole',
        args: [roleHash, newAddress as Address]
      })

      await publicClient?.waitForTransactionReceipt({ hash })

      // Refresh the role owners
      const owners = await getRoleOwners(selectedRole, publicClient!, address as Address)
      setRoleOwners(prev => ({
        ...prev,
        [selectedRole]: owners
      }))

      setNewAddress('')
      showNotification('Success', `Role ${selectedRole} revoked from ${newAddress}`, 'success')
    } catch (err: any) {
      console.error('Error revoking role:', err)
      showNotification('Error', `Failed to revoke role: ${err.message}`, 'error')
    } finally {
      setIsProcessing(prev => ({ ...prev, 'revoke-role': false }))
    }
  }

  const handleStrategySelect = (strategyAddress: Address) => {
    setSelectedStrategies((prev) => {
      const exists = prev.find((s) => s.id === strategyAddress);
      if (exists) {
        // Remove the strategy and reorder remaining ones
        const filtered = prev.filter((s) => s.id !== strategyAddress);
        return filtered.map((s, i) => ({ ...s, order: i + 1 }));
      } else {
        // Add the strategy with next order number
        return [...prev, { id: strategyAddress, order: prev.length + 1 }];
      }
    });
  };

  const handleConfirmRebalance = async () => {
    if (!selectedStrategies.length || !walletClient || !address) {
      toast({
        title: "Error",
        description: "Please select at least one strategy to rebalance",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(prev => ({ ...prev, 'rebalance': true }))

      // Sort by order and get addresses
      const orderedAddresses = selectedStrategies
        .sort((a, b) => a.order - b.order)
        .map(s => s.id);

      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      const hash = await walletClient.writeContract({
        ...vault,
        functionName: 'rebalance',
        args: [orderedAddresses]
      })

      await publicClient?.waitForTransactionReceipt({ hash })

      showNotification('Success', 'Rebalance operation completed successfully', 'success')

      // Clear selection after successful rebalance
      setSelectedStrategies([])
      
      // Refresh strategies to get updated allocations
      await fetchStrategies()

    } catch (error: any) {
      console.error('Rebalance error:', error)
      
      // Handle specific error cases
      if (error.message.toLowerCase().includes('invalid strategy order')) {
        showNotification('Error', 'Invalid strategy order. Please check your selection.', 'error')
      } else if (error.message.toLowerCase().includes('strategy not active')) {
        showNotification('Error', 'One or more selected strategies are not active.', 'error')
      } else {
        showNotification('Error', 'Failed to rebalance strategies. Please try again.', 'error')
      }
    } finally {
      setIsProcessing(prev => ({ ...prev, 'rebalance': false }))
    }
  }

  const handleHarvest = async () => {
    if (!walletClient || !address) return;

    try {
      setIsProcessing(prev => ({ ...prev, 'harvest': true }))

      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      const hash = await walletClient.writeContract({
        ...vault,
        functionName: 'harvest'
      })

      await publicClient?.waitForTransactionReceipt({ hash })
      
      showNotification('Success', 'Harvest completed successfully', 'success')
    } catch (err: any) {
      console.error("Error during harvest:", err)
      showNotification('Error', `Harvest failed: ${err.message}`, 'error')
    } finally {
      setIsProcessing(prev => ({ ...prev, 'harvest': false }))
    }
  }

  const handleGulp = async () => {
    if (!walletClient || !address) return;

    try {
      setIsProcessing(prev => ({ ...prev, 'gulp': true }))
      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      const hash = await walletClient.writeContract({
        ...vault,
        functionName: 'gulp'
      })

      await publicClient?.waitForTransactionReceipt({ hash })
      
      showNotification('Success', 'Gulp completed successfully', 'success')
      
      // Refresh strategies to get updated allocations
      await fetchStrategies()
    } catch (err: any) {
      console.error("Error during gulp:", err)
      showNotification('Error', `Gulp failed: ${err.message}`, 'error')
    } finally {
      setIsProcessing(prev => ({ ...prev, 'gulp': false }))
    }
  }

  const handleAddStrategy = async () => {
    if (!walletClient || !address || !newStrategyAddress || !newStrategyAllocationPoints) return;
    
    setIsProcessing(prev => ({ ...prev, 'add-strategy': true }))
    
    try {
      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      // Convert allocation points to BigNumber
      const allocationPoints = BigInt(newStrategyAllocationPoints)

      // Call addStrategy
      const hash = await walletClient.writeContract({
        ...vault,
        functionName: 'addStrategy',
        args: [newStrategyAddress as Address, allocationPoints]
      })
      
      await publicClient?.waitForTransactionReceipt({ hash })
      
      showNotification('Success', 'Strategy has been added successfully', 'success')
      // Clear inputs
      setNewStrategyAddress('')
      setNewStrategyAllocationPoints('')
      await fetchStrategies() // Refresh list
      
    } catch (err: any) {
      console.error("Error adding strategy:", err)
      
      // Check for specific error messages in the revert
      if (err.message.toLowerCase().includes("strategy already exists")) {
        showNotification('Error', 'This strategy has already been added to the vault.', 'error')
      } else if (err.message.toLowerCase().includes("invalid strategy")) {
        showNotification('Error', 'Invalid strategy address. Please check the address and try again.', 'error')
      } else {
        showNotification('Error', 'Failed to add strategy. Please try again.', 'error')
      }
    } finally {
      setIsProcessing(prev => ({ ...prev, 'add-strategy': false }))
    }
  }

  const handleRemoveStrategy = async (strategyAddress: Address) => {
    if (!walletClient || !address) return;
    
    setIsProcessing(prev => ({ ...prev, [`remove-${strategyAddress}`]: true }))
    
    try {
      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      // Call removeStrategy
      const hash = await walletClient.writeContract({
        ...vault,
        functionName: 'removeStrategy',
        args: [strategyAddress]
      })
      
      await publicClient?.waitForTransactionReceipt({ hash })
      
      showNotification('Success', 'Strategy has been removed successfully', 'success')
      await fetchStrategies() // Refresh list
      
    } catch (err: any) {
      console.error("Error removing strategy:", err)
      
      // Check for specific error messages in the revert
      if (err.message.toLowerCase().includes("strategy has funds")) {
        showNotification('Error', 'Cannot remove strategy while it has allocated funds. Please rebalance to remove all funds first.', 'error')
      } else {
        showNotification('Error', 'Failed to remove strategy. Please try again.', 'error')
      }
    } finally {
      setIsProcessing(prev => ({ ...prev, [`remove-${strategyAddress}`]: false }))
    }
  }

  const handleToggleEmergencyStatus = async (strategyAddress: Address) => {
    if (!walletClient || !address) return;
    
    const currentStatus = earnStrategies.find(s => s.address === strategyAddress)?.status
    setIsProcessing(prev => ({ ...prev, [`toggle-${strategyAddress}`]: true }))
    
    try {
      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      // Call toggleStrategyEmergencyStatus
      const hash = await walletClient.writeContract({
        ...vault,
        functionName: 'toggleStrategyEmergencyStatus',
        args: [strategyAddress]
      })
      
      await publicClient?.waitForTransactionReceipt({ hash })
      
      showNotification('Success', `Strategy emergency status has been ${currentStatus === 'active' ? 'enabled' : 'disabled'}`, 'success')
      await fetchStrategies() // Refresh list
      
    } catch (err: any) {
      console.error("Error toggling strategy status:", err)
      showNotification('Error', 'Failed to toggle strategy emergency status. Please try again.', 'error')
    } finally {
      setIsProcessing(prev => ({ ...prev, [`toggle-${strategyAddress}`]: false }))
    }
  }

  const handleAdjustAllocationPoints = async () => {
    if (!walletClient || !address || !adjustingStrategy || !newAllocationPoints) return;
    
    setIsProcessing(prev => ({ ...prev, [`adjust-${adjustingStrategy}`]: true }))
    
    try {
      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      const points = BigInt(newAllocationPoints)
      
      // Prevent setting 0 allocation points for cash reserve
      if (isCashReserve(adjustingStrategy) && points === BigInt(0)) {
        throw new Error("Cash reserve allocation points cannot be set to 0")
      }

      const hash = await walletClient.writeContract({
        ...vault,
        functionName: 'adjustAllocationPoints',
        args: [adjustingStrategy, points]
      })

      await publicClient?.waitForTransactionReceipt({ hash })
      
      showNotification('Success', 'Allocation points adjusted successfully', 'success')
      setAdjustingStrategy(null)
      setNewAllocationPoints('')
      await fetchStrategies()
      
    } catch (err: any) {
      console.error("Error adjusting allocation points:", err)
      if (err.message.includes("Cash reserve allocation points cannot be set to 0")) {
        showNotification('Error', 'Cash reserve allocation points cannot be set to 0', 'error')
      } else {
        showNotification('Error', 'Failed to adjust allocation points. Please try again.', 'error')
      }
    } finally {
      setIsProcessing(prev => ({ ...prev, [`adjust-${adjustingStrategy}`]: false }))
    }
  }

  const handleSetStrategyCap = async () => {
    if (!walletClient || !address || !settingCapStrategy || !newCap) return;
    
    setIsProcessing(prev => ({ ...prev, [`cap-${settingCapStrategy}`]: true }))
    
    try {
      const vault = {
        address: address as Address,
        abi: earnVaultABI,
      }

      // Get strategy details to know the decimals
      const strategy = earnStrategies.find(s => s.address === settingCapStrategy)
      if (!strategy) throw new Error('Strategy not found')

      // Convert amount to AmountCap uint16
      const capValue = convertToAmountCap(newCap, strategy.assetDecimals)
      
      const hash = await walletClient.writeContract({
        ...vault,
        functionName: 'setStrategyCap',
        args: [settingCapStrategy, capValue]
      })

      await publicClient?.waitForTransactionReceipt({ hash })
      
      showNotification('Success', 'Strategy cap set successfully', 'success')
      setSettingCapStrategy(null)
      setNewCap('')
      await fetchStrategies()
      
    } catch (err: any) {
      console.error("Error setting strategy cap:", err)
      if (err.message.toLowerCase().includes("strategy should be active")) {
        showNotification('Error', 'Strategy must be active to set cap', 'error')
      } else if (err.message.toLowerCase().includes("no cap on cash reserve")) {
        showNotification('Error', 'Cannot set cap on cash reserve strategy', 'error')
      } else if (err.message.toLowerCase().includes("strategy cap exceed max")) {
        showNotification('Error', 'Cap amount exceeds maximum allowed value', 'error')
      } else {
        showNotification('Error', 'Failed to set strategy cap. Please try again.', 'error')
      }
    } finally {
      setIsProcessing(prev => ({ ...prev, [`cap-${settingCapStrategy}`]: false }))
    }
  }

  const getEarnVaultContract = (address: Address) => {
    if (!walletClient) throw new Error("No wallet client available");
    return {
      address,
      abi: earnVaultABI,
    };
  };

  return (
    <div className="container mx-auto p-4">
      <ConfigGuideDialog />
      <div className="flex flex-col space-y-8 mb-8">
        <div className="flex flex-col space-y-4">
          <Link href="/deploy-euler-earn" className="inline-flex items-center text-blue-600 hover:text-blue-800">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
          <Header />
        </div>
      </div>
      <NotificationDialog />
      <Card className="mb-6">
        <CardHeader>
          <CardDescription className="space-y-2">
            <div>
              Name:{' '}
              <span className="text-foreground">
                {vaultName || 'Loading...'}
              </span>
            </div>
            <div>
              Asset:{' '}
              {vaultAsset.address && chainId && getExplorerAddressLink(chainId, vaultAsset.address) ? (
                <a 
                  href={getExplorerAddressLink(chainId, vaultAsset.address) || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  {vaultAsset.symbol} ({vaultAsset.address.slice(0, 6)}...{vaultAsset.address.slice(-4)})
                </a>
              ) : (
                <span className="text-foreground">
                  {vaultAsset.symbol || 'Loading...'}
                </span>
              )}
            </div>
            <div>
              Vault Address:{' '}
              {address && chainId && getExplorerAddressLink(chainId, address.toString()) ? (
                <a 
                  href={getExplorerAddressLink(chainId, address.toString()) || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  {address.toString()}
                </a>
              ) : (
                address
              )}
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2 className="text-xl font-semibold mb-4">Current Role Owners</h2>
          {isLoadingOwners ? (
            <div className="text-center py-4">Loading role owners...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Owner Addresses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role}>
                    <TableCell className="font-medium">{role}</TableCell>
                    <TableCell>
                      {roleOwners[role]?.map((owner, index) => (
                        <div key={index} className="mb-1">
                          {owner === '0x0000000000000000000000000000000000000000' ? (
                            <span className="text-gray-500">No owner assigned</span>
                          ) : chainId && getExplorerAddressLink(chainId, owner) ? (
                            <a 
                              href={getExplorerAddressLink(chainId, owner) || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {owner.slice(0, 6)}...{owner.slice(-4)}
                            </a>
                          ) : (
                            <span>{owner.slice(0, 6)}...{owner.slice(-4)}</span>
                          )}
                        </div>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Manage Role Owners</CardTitle>
          <CardDescription>Set or remove addresses for roles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-2">
                <Select onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Input
                  placeholder="Enter address"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                onClick={handleGrantRole} 
                disabled={isProcessing['grant-role']}
              >
                {isProcessing['grant-role'] ? (
                  <>
                    <span className="mr-2">Granting Role...</span>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  </>
                ) : (
                  'Grant Role'
                )}
              </Button>
              <Button 
                onClick={handleRevokeRole} 
                variant="outline"
                disabled={isProcessing['revoke-role']}
              >
                {isProcessing['revoke-role'] ? (
                  <>
                    <span className="mr-2">Revoking Role...</span>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  </>
                ) : (
                  'Revoke Role'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Strategies</CardTitle>
          <CardDescription>Manage vault strategies</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStrategies ? (
            <div className="text-center py-4">Loading strategies...</div>
          ) : (
            <>
              <div className="mb-4">
                <span className="text-lg font-medium">
                  Total Allocation Points: {getTotalAllocationPoints(earnStrategies).toString()}
                </span>
              </div>
              <div className="space-y-4">
                {/* Strategies section */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Allocation</TableHead>
                      <TableHead>Cap Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnStrategies
                      .sort((a, b) => {
                        // Cash reserve (0x0) always comes first
                        if (isCashReserve(a.address)) return -1;
                        if (isCashReserve(b.address)) return 1;
                        return 0;
                      })
                      .map((strategy) => {
                        const totalPoints = getTotalAllocationPoints(earnStrategies);
                        const allocationPercentage = totalPoints > BigInt(0)
                          ? Number((strategy.allocationPoints * BigInt(10000)) / totalPoints) / 100 
                          : 0;
                        const capAmount = resolveAmountCap(strategy.cap);
                        const maxUint256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935');
                        
                        return (
                          <TableRow key={strategy.address}>
                            <TableCell className="font-medium">
                              {isCashReserve(strategy.address) ? "Cash Reserve" : strategy.name}
                              <div className="text-sm text-gray-500">
                                {chainId && getExplorerAddressLink(chainId, strategy.address) ? (
                                  <a 
                                    href={getExplorerAddressLink(chainId, strategy.address) || '#'} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    {strategy.address.slice(0, 6)}...{strategy.address.slice(-4)}
                                  </a>
                                ) : (
                                  <span>{strategy.address.slice(0, 6)}...{strategy.address.slice(-4)}</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400">
                                Allocated: {formatAmount(strategy.allocated, strategy.assetDecimals)} {strategy.assetSymbol}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={getStatusDisplay(strategy.status).className}>
                                {getStatusDisplay(strategy.status).text}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div>
                                {strategy.allocationPoints.toString()} points
                              </div>
                              <div className="text-sm text-gray-500">
                                {allocationPercentage.toFixed(2)}%
                              </div>
                            </TableCell>
                            <TableCell>
                              {capAmount === maxUint256 ? (
                                <span className="text-gray-500">No cap</span>
                              ) : (
                                <span>{formatAmount(capAmount, strategy.assetDecimals)} {strategy.assetSymbol}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                {/* Show adjust points for both cash reserve and active strategies */}
                                {(isCashReserve(strategy.address) || strategy.status !== 'inactive') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAdjustingStrategy(strategy.address)}
                                    disabled={isProcessing[`adjust-${strategy.address}`]}
                                  >
                                    {isProcessing[`adjust-${strategy.address}`] ? 'Adjusting...' : 'Adjust Points'}
                                  </Button>
                                )}
                                {!isCashReserve(strategy.address) && strategy.status !== 'inactive' && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSettingCapStrategy(strategy.address)}
                                      disabled={isProcessing[`cap-${strategy.address}`]}
                                    >
                                      {isProcessing[`cap-${strategy.address}`] ? 'Setting Cap...' : 'Set Cap'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRemoveStrategy(strategy.address)}
                                      disabled={
                                        isProcessing[`remove-${strategy.address}`] ||
                                        strategy.allocated > BigInt(0) ||
                                        isStrategyEmergency(strategy)
                                      }
                                    >
                                      {isProcessing[`remove-${strategy.address}`] ? 'Removing...' : 'Remove'}
                                    </Button>
                                  </>
                                )}
                                {!isCashReserve(strategy.address) && (
                                  <>
                                    {isStrategyActive(strategy) && (
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleToggleEmergencyStatus(strategy.address)}
                                        disabled={isProcessing[`toggle-${strategy.address}`]}
                                      >
                                        {getEmergencyToggleText(strategy, isProcessing[`toggle-${strategy.address}`])}
                                      </Button>
                                    )}
                                    {isStrategyEmergency(strategy) && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleToggleEmergencyStatus(strategy.address)}
                                        disabled={isProcessing[`toggle-${strategy.address}`]}
                                      >
                                        {getEmergencyToggleText(strategy, isProcessing[`toggle-${strategy.address}`])}
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {earnStrategies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          No strategies added yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              
              <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Add New Strategy</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Input
                      placeholder="Strategy Address"
                      value={newStrategyAddress}
                      onChange={(e) => setNewStrategyAddress(e.target.value)}
                      disabled={isProcessing['add-strategy']}
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Allocation Points"
                      type="number"
                      min="0"
                      value={newStrategyAllocationPoints}
                      onChange={(e) => setNewStrategyAllocationPoints(e.target.value)}
                      disabled={isProcessing['add-strategy']}
                    />
                  </div>
                  <div className="col-span-3">
                    <Button 
                      className="w-full"
                      onClick={handleAddStrategy}
                      disabled={
                        isProcessing['add-strategy'] || 
                        !newStrategyAddress || 
                        !newStrategyAllocationPoints
                      }
                    >
                      {isProcessing['add-strategy'] ? (
                        <>
                          <span className="mr-2">Adding Strategy...</span>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                        </>
                      ) : (
                        'Add Strategy'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Vault Operations</CardTitle>
          <CardDescription>Perform rebalance, harvest, or gulp operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button disabled={isProcessing['rebalance']}>
                  {isProcessing['rebalance'] ? (
                    <>
                      <span className="mr-2">Rebalancing...</span>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                    </>
                  ) : (
                    'Rebalance'
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rebalance Strategies</DialogTitle>
                  <DialogDescription>
                    Select strategies to rebalance. The order of selection matters.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {earnStrategies
                    .filter(strategy => isStrategyActive(strategy) && !isCashReserve(strategy.address))
                    .map((strategy) => {
                      const selected = selectedStrategies.find(s => s.id === strategy.address);
                      return (
                        <div key={strategy.address} className="flex items-center space-x-2">
                          <Checkbox
                            id={`strategy-${strategy.address}`}
                            checked={!!selected}
                            onCheckedChange={() => handleStrategySelect(strategy.address)}
                          />
                          <label
                            htmlFor={`strategy-${strategy.address}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            <span className="flex items-center gap-2">
                              {strategy.name}
                              {selected && (
                                <span className="text-sm font-semibold text-blue-600">
                                  (Order: {selected.order})
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-gray-500 block mt-1">
                              {strategy.address.slice(0, 6)}...{strategy.address.slice(-4)}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  {earnStrategies.filter(strategy => isStrategyActive(strategy) && !isCashReserve(strategy.address)).length === 0 && (
                    <div className="text-center text-gray-500">
                      No active strategies available for rebalancing
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button 
                    onClick={handleConfirmRebalance}
                    disabled={selectedStrategies.length === 0}
                  >
                    Confirm Rebalance
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button 
              onClick={handleHarvest}
              disabled={isProcessing['harvest']}
            >
              {isProcessing['harvest'] ? (
                <>
                  <span className="mr-2">Harvesting...</span>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                </>
              ) : (
                'Harvest'
              )}
            </Button>
            <Button 
              onClick={handleGulp}
              disabled={isProcessing['gulp']}
            >
              {isProcessing['gulp'] ? (
                <>
                  <span className="mr-2">Processing...</span>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                </>
              ) : (
                'Gulp'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Adjust Allocation Points Dialog */}
      <Dialog open={!!adjustingStrategy} onOpenChange={() => setAdjustingStrategy(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Allocation Points</DialogTitle>
            <DialogDescription>
              Enter new allocation points for the strategy
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="New Allocation Points"
              type="number"
              min="0"
              value={newAllocationPoints}
              onChange={(e) => setNewAllocationPoints(e.target.value)}
              disabled={isProcessing[`adjust-${adjustingStrategy}`]}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleAdjustAllocationPoints}
              disabled={isProcessing[`adjust-${adjustingStrategy}`]}
            >
              {isProcessing[`adjust-${adjustingStrategy}`] ? (
                <>
                  <span className="mr-2">Adjusting...</span>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Set Cap Dialog */}
      <Dialog open={!!settingCapStrategy} onOpenChange={() => setSettingCapStrategy(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Strategy Cap</DialogTitle>
            <DialogDescription>
              Enter new cap amount (0 for no cap)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder={`Cap Amount in ${earnStrategies.find(s => s.address === settingCapStrategy)?.assetSymbol || 'tokens'}`}
              type="number"
              min="0"
              step="any"
              value={newCap}
              onChange={(e) => setNewCap(e.target.value)}
              disabled={isProcessing[`cap-${settingCapStrategy}`]}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSetStrategyCap}
              disabled={isProcessing[`cap-${settingCapStrategy}`]}
            >
              {isProcessing[`cap-${settingCapStrategy}`] ? (
                <>
                  <span className="mr-2">Setting Cap...</span>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}