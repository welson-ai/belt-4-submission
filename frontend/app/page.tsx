'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import SwapCard from '@/components/SwapCard'
import { AmmPoolContract, getWalletBalance } from '@/lib/contracts'

export default function Home() {
  const [connected, setConnected] = useState(false)
  const [publicKey, setPublicKey] = useState('')
  const [reserves, setReserves] = useState({ reserve_a: 0, reserve_b: 0 })
  const [balances, setBalances] = useState<{ balance: string; asset: string }[]>([])

  useEffect(() => {
    if (connected && publicKey) {
      loadReserves()
      loadBalances()
    }
  }, [connected, publicKey])

  const loadReserves = async () => {
    try {
      const reservesData = await AmmPoolContract.getReserves()
      setReserves(reservesData)
    } catch (error) {
      console.error('Failed to load reserves:', error)
    }
  }

  const loadBalances = async () => {
    try {
      const balancesData = await getWalletBalance(publicKey)
      setBalances(balancesData)
    } catch (error) {
      console.error('Failed to load balances:', error)
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar 
        connected={connected} 
        publicKey={publicKey} 
        onConnect={setConnected}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            StellarSwap AMM
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Decentralized exchange for Stellar tokens with automated market making.
            Swap tokens instantly with low fees and minimal slippage.
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <SwapCard 
            connected={connected}
            publicKey={publicKey}
            reserves={reserves}
            balances={balances}
            onSwapComplete={() => {
              loadReserves()
              loadBalances()
            }}
          />
        </div>

        {/* Pool Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Token A Reserve</h3>
            <p className="text-2xl font-bold text-gray-900">
              {reserves.reserve_a.toLocaleString()}
            </p>
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Token B Reserve</h3>
            <p className="text-2xl font-bold text-gray-900">
              {reserves.reserve_b.toLocaleString()}
            </p>
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Current Price</h3>
            <p className="text-2xl font-bold text-gray-900">
              {reserves.reserve_a > 0 ? 
                (reserves.reserve_b / reserves.reserve_a).toFixed(4) : 
                '0.0000'
              }
            </p>
          </div>
          
          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-sm font-medium text-gray-500 mb-2">24h Volume</h3>
            <p className="text-2xl font-bold text-gray-900">$0</p>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
            <p className="text-gray-600">Instant swaps powered by Stellar's fast settlement times.</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Low Fees</h3>
            <p className="text-gray-600">Only 0.3% trading fee, the lowest in the market.</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure</h3>
            <p className="text-gray-600">Audited smart contracts and non-custodial trading.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
