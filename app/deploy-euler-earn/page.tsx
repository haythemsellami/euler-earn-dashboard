'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, AlertCircle, Settings } from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { Header } from '../components/Header'
import factoryABI from '../abis/EulerEarnFactory.json'
import earnVaultABI from '../abis/EulerEarn.json'
import { CONTRACT_ADDRESSES, SUPPORTED_NETWORKS, SupportedChainId } from '../config/addresses'
import { getExplorerAddressLink } from '../config/explorer'
import { useChainId, useReadContract, useReadContracts, useWriteContract, useWatchContractEvent } from 'wagmi'
import { isAddress, zeroAddress, type Address, type Abi } from 'viem'
import { GuideDialog } from '../components/GuideDialog'
import { usePublicClient } from 'wagmi'
import erc20ABI from '../abis/ERC20.json'

interface DeployedVault {
  asset: Address;
  name: string;
  address: Address;
}

export default function DeployEulerEarn() {
  const [deployedAddress, setDeployedAddress] = useState<Address | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const router = useRouter()
  const chainId = useChainId()
  const publicClient = usePublicClient()

  const factoryAddress = chainId ? (CONTRACT_ADDRESSES.EULER_EARN_FACTORY[chainId as SupportedChainId] as Address) : undefined

  // Read the list of vaults
  const { data: vaultListLength } = useReadContract({
    address: factoryAddress,
    abi: factoryABI,
    functionName: 'getEulerEarnVaultsListLength'
  })

  // Read vault addresses
  const { data: vaultAddresses } = useReadContract({
    address: factoryAddress,
    abi: factoryABI,
    functionName: 'getEulerEarnVaultsListSlice',
    args: vaultListLength ? [BigInt(0), vaultListLength] : undefined
  }) as { data: Address[] | undefined }

  // Read vault details
  const { data: vaultDetails } = useReadContracts({
    contracts: (vaultAddresses || []).flatMap((address: Address) => [
      {
        address,
        abi: earnVaultABI as Abi,
        functionName: 'name',
      },
      {
        address,
        abi: earnVaultABI as Abi,
        functionName: 'asset',
      },
    ] as const),
  })

  // Transform vault details into DeployedVault[]
  const deployedVaults: DeployedVault[] = vaultAddresses && vaultDetails ? 
    vaultAddresses.map((address: Address, index: number) => ({
      address,
      name: (vaultDetails[index * 2]?.result as string) ?? 'Error loading vault',
      asset: (vaultDetails[index * 2 + 1]?.result as Address) ?? zeroAddress
    })) : []

  // Deploy contract write
  const { writeContract: deployVault, isPending: isDeploying, isSuccess: isDeployed, error: deployError } = useWriteContract()

  // Watch for deployment events
  useWatchContractEvent({
    address: factoryAddress,
    abi: factoryABI,
    eventName: 'DeployEulerEarn',
    onLogs(logs) {
      if (logs[0]) {
        setDeployedAddress(logs[0].address as Address)
      }
    }
  })

  useEffect(() => {
    if (deployError) {
      console.error('Deployment error:', deployError)
      // Check for specific error messages
      if (deployError.message.toLowerCase().includes('user rejected') || 
          deployError.message.toLowerCase().includes('user denied') ||
          deployError.message.toLowerCase().includes('rejected the request')) {
        setError('Transaction was not signed')
      } else if (deployError.message.toLowerCase().includes('invalid asset')) {
        setError('Invalid asset address. Please check the address and try again.')
      } else if (deployError.message.toLowerCase().includes('invalid allocation points')) {
        setError('Invalid initial cash allocation points. Must be greater than 0.')
      } else if (deployError.message.toLowerCase().includes('invalid smearing period')) {
        setError('Invalid smearing period. Must be greater than 0.')
      } else {
        setError(deployError.message || 'Failed to deploy vault')
      }
    }
  }, [deployError])

  const { register, handleSubmit, formState: { errors }, reset } = useForm()

  const onSubmit = async (data: any) => {
    setDeployedAddress(null)
    setError(undefined)

    try {
      if (!chainId) throw new Error("Unable to detect network")
      if (!isAddress(data.asset)) throw new Error("Invalid asset address")
      if (!factoryAddress) throw new Error("Factory not deployed on this network")
      if (!publicClient) throw new Error("No public client available")
      
      // Validate parameters
      if (data.initialCashAllocationPoints <= 0) {
        throw new Error("Initial cash allocation points must be greater than 0")
      }
      if (data.smearingPeriod < 86400) {
        throw new Error("Smearing period must be at least 86400 seconds (1 day)")
      }

      // Validate ERC20 token
      try {
        const assetAddress = data.asset as Address
        const [decimals, symbol] = await Promise.all([
          publicClient.readContract({
            address: assetAddress,
            abi: erc20ABI,
            functionName: 'decimals'
          }),
          publicClient.readContract({
            address: assetAddress,
            abi: erc20ABI,
            functionName: 'symbol'
          })
        ])
        console.log('Asset token details:', { decimals, symbol })
      } catch (err: any) {
        console.error('Error validating ERC20 token:', err)
        if (err.message.toLowerCase().includes('user rejected') || 
            err.message.toLowerCase().includes('user denied') ||
            err.message.toLowerCase().includes('rejected the request')) {
          throw new Error("Transaction was not signed")
        }
        throw new Error("Invalid ERC20 token. Please check the address and try again.")
      }
      
      // Format parameters
      const params = {
        asset: data.asset as Address,
        name: data.name.trim(),
        symbol: data.symbol.trim(),
        initialCashAllocationPoints: BigInt(data.initialCashAllocationPoints),
        smearingPeriod: Number(data.smearingPeriod)
      }

      // Validate name and symbol
      if (params.name.length === 0) {
        throw new Error("Vault name cannot be empty")
      }
      if (params.symbol.length === 0) {
        throw new Error("Vault symbol cannot be empty")
      }
      // Validate smearing period fits in uint24
      if (params.smearingPeriod > 16777215) { // 2^24 - 1
        throw new Error("Smearing period too large. Maximum value is 16777215 seconds (~194 days)")
      }

      console.log('Deploying vault with params:', {
        asset: params.asset,
        name: params.name,
        symbol: params.symbol,
        initialCashAllocationPoints: params.initialCashAllocationPoints.toString(),
        smearingPeriod: params.smearingPeriod.toString()
      })

      deployVault({
        address: factoryAddress,
        abi: factoryABI,
        functionName: 'deployEulerEarn',
        args: [
          params.asset,
          params.name,
          params.symbol,
          params.initialCashAllocationPoints,
          params.smearingPeriod
        ]
      })
    } catch (err: any) {
      console.error("Full error:", err)
      setError(err.message || "Failed to deploy vault")
    }
  }

  const handleConfigure = (address: Address) => {
    router.push(`/configure-vault/${address}`)
  }

  return (
    <div className="container mx-auto p-4">
      <GuideDialog />
      <Header />
      {chainId && !CONTRACT_ADDRESSES.EULER_EARN_FACTORY[chainId as SupportedChainId] && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Network Not Supported</AlertTitle>
          <AlertDescription>
            The Euler Earn Factory is not deployed on this network. Please switch to a supported network.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="w-full lg:w-1/2">
          <CardHeader>
            <CardTitle>Deploy Euler Earn Vault</CardTitle>
            <CardDescription>Fill in the details to deploy a new Euler Earn vault.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="asset">Asset Address</Label>
                <Input 
                  id="asset" 
                  {...register("asset", { required: "Asset address is required" })}
                  placeholder="0x..."
                />
                {errors.asset && <p className="text-red-500 text-sm mt-1">{errors.asset.message as string}</p>}
              </div>
              <div>
                <Label htmlFor="name">Vault Name</Label>
                <Input 
                  id="name" 
                  {...register("name", { required: "Vault name is required" })}
                  placeholder="My Euler Earn Vault"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message as string}</p>}
              </div>
              <div>
                <Label htmlFor="symbol">Vault Symbol</Label>
                <Input 
                  id="symbol" 
                  {...register("symbol", { required: "Vault symbol is required" })}
                  placeholder="MEV"
                />
                {errors.symbol && <p className="text-red-500 text-sm mt-1">{errors.symbol.message as string}</p>}
              </div>
              <div>
                <Label htmlFor="initialCashAllocationPoints">Initial Cash Allocation Points</Label>
                <Input 
                  id="initialCashAllocationPoints" 
                  type="number"
                  {...register("initialCashAllocationPoints", { 
                    required: "Initial cash allocation points are required",
                    min: { value: 0, message: "Must be non-negative" }
                  })}
                  placeholder="1000"
                />
                {errors.initialCashAllocationPoints && <p className="text-red-500 text-sm mt-1">{errors.initialCashAllocationPoints.message as string}</p>}
              </div>
              <div>
                <Label htmlFor="smearingPeriod">Smearing Period (in seconds)</Label>
                <Input 
                  id="smearingPeriod" 
                  type="number"
                  {...register("smearingPeriod", { 
                    required: "Smearing period is required",
                    min: { value: 86400, message: "Must be at least 86400 seconds (1 day)" },
                    max: { value: 16777215, message: "Must not exceed 16777215 seconds (~194 days)" }
                  })}
                  placeholder="86400"
                />
                {errors.smearingPeriod && <p className="text-red-500 text-sm mt-1">{errors.smearingPeriod.message as string}</p>}
                <p className="text-sm text-gray-500 mt-1">
                  Minimum: 86400 seconds (1 day)<br />
                  Maximum: 16777215 seconds (~194 days)
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={isDeploying}>
                {isDeploying ? (
                  <>
                    <span className="mr-2">Deploying Vault...</span>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  </>
                ) : (
                  'Deploy Euler Earn Vault'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            {isDeploying && (
              <Alert>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                <AlertTitle>Deploying</AlertTitle>
                <AlertDescription>
                  Deploying your Euler Earn vault...
                </AlertDescription>
              </Alert>
            )}
            {isDeployed && deployedAddress && (
              <Alert className="w-full">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>
                  Euler Earn vault deployed at: {deployedAddress}
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" className="w-full">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardFooter>
        </Card>

        <Card className="w-full lg:w-1/2">
          <CardHeader>
            <CardTitle>Deployed Euler Earn Vaults</CardTitle>
            <CardDescription>List of all deployed Euler Earn vaults on {chainId && SUPPORTED_NETWORKS[chainId as SupportedChainId]?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            {isDeploying ? (
              <div>Loading...</div>
            ) : deployedVaults.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployedVaults.map((vault) => (
                    <TableRow key={vault.address}>
                      <TableCell>{vault.name}</TableCell>
                      <TableCell>
                        <a 
                          href={getExplorerAddressLink(chainId || 1, vault.address) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                        >
                          {vault.address}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleConfigure(vault.address)}
                        >
                          <Settings className="h-4 w-4" />
                          <span className="sr-only">Configure {vault.name}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div>No vaults deployed yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

