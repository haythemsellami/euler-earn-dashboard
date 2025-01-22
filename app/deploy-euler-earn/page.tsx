'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { usePublicClient, useWalletClient } from 'wagmi'
import { decodeEventLog, isAddress, parseAbiItem, zeroAddress } from 'viem'
import type { Address } from 'viem'
import { GuideDialog } from '../components/GuideDialog'

interface DeployedVault {
  asset: Address;
  name: string;
  address: Address;
}

export default function DeployEulerEarn() {
  const [deployedAddress, setDeployedAddress] = useState<Address | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deployedVaults, setDeployedVaults] = useState<DeployedVault[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastFetchedChainId, setLastFetchedChainId] = useState<number | null>(null)
  const router = useRouter()
  const { chainId } = useWallet()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const { register, handleSubmit, formState: { errors }, reset } = useForm()

  const fetchDeployedVaults = useCallback(async () => {
    if (!publicClient || !chainId) return;
    if (chainId === lastFetchedChainId && deployedVaults.length > 0) return;

    const factoryAddress = CONTRACT_ADDRESSES.EULER_EARN_FACTORY[chainId as SupportedChainId];
    if (!factoryAddress) {
      setDeployedVaults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Create contract instance
      const factory = {
        address: factoryAddress as Address,
        abi: factoryABI,
      };

      // Get the total number of vaults
      const length = await publicClient.readContract({
        ...factory,
        functionName: 'getEulerEarnVaultsListLength'
      });
      
      // Fetch all vaults
      const vaultAddresses = await publicClient.readContract({
        ...factory,
        functionName: 'getEulerEarnVaultsListSlice',
        args: [BigInt(0), length]
      }) as Address[];

      // Fetch details for each vault
      const vaultDetails = await Promise.all(
        vaultAddresses.map(async (address: Address) => {
          const vault = {
            address,
            abi: earnVaultABI,
          };
          
          try {
            const [name, asset] = await Promise.all([
              publicClient.readContract({
                ...vault,
                functionName: 'name'
              }),
              publicClient.readContract({
                ...vault,
                functionName: 'asset'
              })
            ]);
            
            return {
              address,
              name: name as string,
              asset: asset as Address
            };
          } catch (err) {
            console.error(`Error fetching vault details for ${address}:`, err);
            return {
              address,
              name: 'Error loading vault',
              asset: zeroAddress
            };
          }
        })
      );

      setDeployedVaults(vaultDetails);
      setLastFetchedChainId(chainId);
    } catch (err) {
      console.error('Error fetching vaults:', err);
      setError('Failed to load deployed vaults');
      setDeployedVaults([]);
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, chainId, lastFetchedChainId, deployedVaults.length]);

  useEffect(() => {
    if (!chainId) {
      setDeployedVaults([]);
      setLastFetchedChainId(null);
      return;
    }

    if (chainId !== lastFetchedChainId) {
      fetchDeployedVaults();
    }
  }, [chainId, lastFetchedChainId, fetchDeployedVaults]);

  // Add a separate effect for initial load
  useEffect(() => {
    if (publicClient && chainId && !lastFetchedChainId) {
      fetchDeployedVaults();
    }
  }, [publicClient, chainId, lastFetchedChainId, fetchDeployedVaults]);

  const onSubmit = async (data: any) => {
    setDeployedAddress(null)
    setError(null)

    try {
      if (!walletClient) throw new Error("Please connect your wallet first")
      if (!publicClient) throw new Error("No public client available")
      if (!chainId) throw new Error("Unable to detect network")
      
      // Validate and format inputs
      if (!isAddress(data.asset)) {
        throw new Error("Invalid asset address")
      }

      // Format parameters
      const params = {
        asset: data.asset as Address,
        name: data.name.trim(),
        symbol: data.symbol.trim(),
        initialCashAllocationPoints: BigInt(data.initialCashAllocationPoints),
        smearingPeriod: BigInt(data.smearingPeriod)
      }

      // Log the formatted parameters
      console.log("Deploying with parameters:", params)

      const factoryAddress = CONTRACT_ADDRESSES.EULER_EARN_FACTORY[chainId as SupportedChainId]
      if (!factoryAddress) throw new Error("Factory not deployed on this network")

      // Create contract instance
      const factory = {
        address: factoryAddress as Address,
        abi: factoryABI,
      }

      // Try calling view functions first to validate the asset
      try {
        // Add any view function calls here to validate the asset
        console.log("Asset address:", params.asset)
      } catch (err) {
        console.error("Asset validation failed:", err)
        throw new Error("Invalid asset address or asset not supported")
      }

      // Call the deploy function
      const hash = await walletClient.writeContract({
        ...factory,
        functionName: 'deployEulerEarn',
        args: [
          params.asset,
          params.name,
          params.symbol,
          params.initialCashAllocationPoints,
          params.smearingPeriod
        ]
      })

      console.log("Transaction sent:", hash)
      
      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      
      // Find the deployment event
      const deployEvent = receipt.logs
        .find(log => {
          try {
            const event = decodeEventLog({
              abi: factoryABI,
              data: log.data,
              topics: log.topics,
            })
            return event.eventName === 'DeployEulerEarn'
          } catch {
            return false
          }
        })

      if (!deployEvent) {
        throw new Error("Could not find deployment event in transaction receipt")
      }

      const newVaultAddress = deployEvent.address as Address
      setDeployedAddress(newVaultAddress)

      // Refresh the list of deployed vaults
      await fetchDeployedVaults()

      reset()
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
                    min: { value: 0, message: "Must be non-negative" }
                  })}
                  placeholder="1209600"
                />
                {errors.smearingPeriod && <p className="text-red-500 text-sm mt-1">{errors.smearingPeriod.message as string}</p>}
              </div>
              <Button type="submit" className="w-full">Deploy Euler Earn Vault</Button>
            </form>
          </CardContent>
          <CardFooter>
            {deployedAddress && (
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
            {isLoading ? (
              <div className="text-center py-4">Loading deployed vaults...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Vault Name</TableHead>
                    <TableHead>Earn Vault Address</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployedVaults.map((vault, index) => (
                    <TableRow key={vault.address}>
                      <TableCell className="font-medium">
                        {chainId && getExplorerAddressLink(chainId as SupportedChainId, vault.asset) ? (
                          <a 
                            href={getExplorerAddressLink(chainId as SupportedChainId, vault.asset)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {vault.asset.slice(0, 6)}...{vault.asset.slice(-4)}
                          </a>
                        ) : (
                          <span>{vault.asset.slice(0, 6)}...{vault.asset.slice(-4)}</span>
                        )}
                      </TableCell>
                      <TableCell>{vault.name}</TableCell>
                      <TableCell>
                        {chainId && getExplorerAddressLink(chainId as SupportedChainId, vault.address) ? (
                          <a 
                            href={getExplorerAddressLink(chainId as SupportedChainId, vault.address)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {vault.address.slice(0, 6)}...{vault.address.slice(-4)}
                          </a>
                        ) : (
                          <span>{vault.address.slice(0, 6)}...{vault.address.slice(-4)}</span>
                        )}
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
                  {deployedVaults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        No vaults deployed yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

