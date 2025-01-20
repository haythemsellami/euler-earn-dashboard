'use client'

import { Button } from "@/components/ui/button"
import { useWallet } from "../contexts/WalletContext"

export function WalletButton() {
  const { account, connectWallet, isConnecting, error } = useWallet()

  return (
    <div>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <Button 
        onClick={connectWallet} 
        disabled={isConnecting}
        variant={account ? "outline" : "default"}
      >
        {isConnecting 
          ? "Connecting..." 
          : account 
            ? `${account.slice(0, 6)}...${account.slice(-4)}` 
            : "Connect Wallet"}
      </Button>
    </div>
  )
} 