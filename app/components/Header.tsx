'use client'

import { WalletButton } from './WalletButton'

export function Header() {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold">Euler Earn Dashboard</h1>
      <WalletButton />
    </div>
  )
} 