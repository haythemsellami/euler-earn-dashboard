'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { ethers } from 'ethers'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, AlertCircle, Settings } from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { WalletButton } from '../components/WalletButton'
import factoryABI from '../abis/EulerEarnFactory.json'
import earnVaultABI from '../abis/EulerEarn.json'
import { CONTRACT_ADDRESSES, SUPPORTED_NETWORKS, SupportedChainId } from '../config/addresses'
import { getExplorerAddressLink } from '../config/explorer'

interface DeployedVault {
  asset: string;
  name: string;
  address: string;
}

export default function DeployEulerEarn() {
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deployedVaults, setDeployedVaults] = useState<DeployedVault[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { signer, provider, chainId } = useWallet()

  const { register, handleSubmit, formState: { errors }, reset } = useForm()

  const fetchDeployedVaults = async () => {
    if (!provider || !chainId) return;

    setIsLoading(true)
    try {
      const factoryAddress = CONTRACT_ADDRESSES.EULER_EARN_FACTORY[chainId as SupportedChainId]
      if (!factoryAddress) return;

      const factory = new ethers.Contract(
        factoryAddress,
        factoryABI,
        provider
      )

      // Get the total number of vaults
      const length = await factory.getEulerEarnVaultsListLength()
      
      // Fetch all vaults
      const vaultAddresses = await factory.getEulerEarnVaultsListSlice(0, length)

      // Fetch details for each vault
      const vaultDetails = await Promise.all(
        vaultAddresses.map(async (address: string) => {
          const vault = new ethers.Contract(
            address,
            earnVaultABI,
            provider
          )
          
          try {
            const [name, asset] = await Promise.all([
              vault.name(),
              vault.asset()
            ])
            
            return {
              address,
              name,
              asset
            }
          } catch (err) {
            console.error(`Error fetching vault details for ${address}:`, err)
            return {
              address,
              name: 'Error loading vault',
              asset: 'Unknown'
            }
          }
        })
      )

      setDeployedVaults(vaultDetails)
    } catch (err) {
      console.error('Error fetching vaults:', err)
      setError('Failed to load deployed vaults')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch vaults when provider or chainId changes
  useEffect(() => {
    fetchDeployedVaults()
  }, [provider, chainId])

  // Update the onSubmit function to refresh the list after deployment
  const onSubmit = async (data: any) => {
    setDeployedAddress(null)
    setError(null)

    try {
      if (!signer) throw new Error("Please connect your wallet first")
      if (!chainId) throw new Error("Unable to detect network")
      
      // Validate and format inputs
      if (!ethers.isAddress(data.asset)) {
        throw new Error("Invalid asset address")
      }

      // Format parameters
      const params = {
        asset: data.asset,
        name: data.name.trim(),
        symbol: data.symbol.trim(),
        initialCashAllocationPoints: parseInt(data.initialCashAllocationPoints),
        smearingPeriod: parseInt(data.smearingPeriod)
      }

      // Log the formatted parameters
      console.log("Deploying with parameters:", params)

      const factoryAddress = CONTRACT_ADDRESSES.EULER_EARN_FACTORY[chainId as SupportedChainId]
      const factory = new ethers.Contract(
        factoryAddress,
        new ethers.Interface(factoryABI),
        signer
      )

      // Try calling view functions first to validate the asset
      try {
        // Add any view function calls here to validate the asset
        console.log("Asset address:", params.asset)
      } catch (err) {
        console.error("Asset validation failed:", err)
        throw new Error("Invalid asset address or asset not supported")
      }

      // Estimate gas first
      const estimatedGas = await factory.deployEulerEarn.estimateGas(
        params.asset,
        params.name,
        params.symbol,
        params.initialCashAllocationPoints,
        params.smearingPeriod
      )

      // Add 30% buffer to gas estimate
      const gasLimit = estimatedGas * BigInt(130) / BigInt(100)

      // Call the deploy function with calculated gas limit
      const tx = await factory.deployEulerEarn(
        params.asset,
        params.name,
        params.symbol,
        params.initialCashAllocationPoints,
        params.smearingPeriod,
        { gasLimit }
      )

      console.log("Transaction sent:", tx.hash)
      const receipt = await tx.wait()
      
      const deployEvent = receipt.logs
        .map((log: any) => {
          try {
            return factory.interface.parseLog(log)
          } catch {
            return null
          }
        })
        .find((event: any) => event && event.name === 'DeployEulerEarn')

      if (!deployEvent) {
        throw new Error("Could not find deployment event in transaction receipt")
      }

      const newVaultAddress = deployEvent.args._eulerEarnVault
      setDeployedAddress(newVaultAddress)

      // Refresh the list of deployed vaults
      await fetchDeployedVaults()

      reset()
    } catch (err: any) {
      console.error("Full error:", err)
      setError(err.message || "Failed to deploy vault")
    }
  }

  const handleConfigure = (address: string) => {
    router.push(`/configure-vault/${address}`)
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Euler Earn Vault Deployment</h1>
        <WalletButton />
      </div>
      {chainId && SUPPORTED_NETWORKS[chainId] && (
        <Alert className="mb-4">
          <AlertTitle>Connected Network</AlertTitle>
          <AlertDescription>
            {SUPPORTED_NETWORKS[chainId].name} {SUPPORTED_NETWORKS[chainId].isTestnet ? '(Testnet)' : ''}
          </AlertDescription>
        </Alert>
      )}
      {chainId && !CONTRACT_ADDRESSES.EULER_EARN_FACTORY[chainId] && (
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
            <CardDescription>List of all deployed Euler Earn vaults on {chainId && SUPPORTED_NETWORKS[chainId]?.name}</CardDescription>
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
                        {getExplorerAddressLink(chainId!, vault.asset) ? (
                          <a 
                            href={getExplorerAddressLink(chainId!, vault.asset)!}
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
                        {getExplorerAddressLink(chainId!, vault.address) ? (
                          <a 
                            href={getExplorerAddressLink(chainId!, vault.address)!}
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

