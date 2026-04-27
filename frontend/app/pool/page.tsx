'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import PoolCard from '@/components/PoolCard'
import { AmmPoolContract, getWalletBalance } from '@/lib/contracts'

export default function Pool() {
  const [connected, setConnected] = useState(false)
  const [publicKey, setPublicKey] = useState('')
  const [reserves, setReserves] = useState({ reserve_a: 0, reserve_b: 0 })
  const [balances, setBalances] = useState<{ balance: string; asset: string }[]>([])

  useEffect(() => {
    if (connected && publicKey) {
      const loadData = async () => {
        try {
          const reservesData = await AmmPoolContract.getReserves()
          setReserves(reservesData)
          
          const balancesData = await getWalletBalance(publicKey)
          setBalances(balancesData)
        } catch (error) {
          console.error('Failed to load pool data:', error)
        }
      }
      
      loadData()
    }
  }, [connected, publicKey])

  return (
    <div className="min-h-screen">
      <Navbar 
        connected={connected} 
        publicKey={publicKey} 
        onConnect={setConnected}
      />
      
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 lg:py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">Liquidity Pool</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-8">
            Manage your liquidity positions in the StellarSwap AMM pool.
          </p>
        </div>
        
        <PoolCard 
          connected={connected}
          publicKey={publicKey}
          reserves={reserves}
          balances={balances}
          onPoolUpdate={() => {
            // Refresh data when pool operations complete
            if (connected && publicKey) {
              const loadData = async () => {
                try {
                  const reservesData = await AmmPoolContract.getReserves()
                  setReserves(reservesData)
                  
                  const balancesData = await getWalletBalance(publicKey)
                  setBalances(balancesData)
                } catch (error) {
                  console.error('Failed to load pool data:', error)
                }
              }
              
              loadData()
            }
          }}
        />
      </main>
    </div>
  )
}
