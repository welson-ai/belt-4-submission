'use client'

import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import SwapCard from '@/components/SwapCard'
import PoolCard from '@/components/PoolCard'
import OracleChart from '@/components/OracleChart'
import { AmmPoolContract, getWalletBalance } from '@/lib/contracts'

export default function Home() {
  const [connected, setConnected] = useState(false)
  const [publicKey, setPublicKey] = useState('')
  const [reserves, setReserves] = useState({ reserve_a: 0, reserve_b: 0 })
  const [balances, setBalances] = useState<{ balance: string; asset: string }[]>([])
  const [activeTab, setActiveTab] = useState<'swap' | 'pool' | 'oracle'>('swap')

  const loadReserves = async () => {
    try {
      const reservesData = await AmmPoolContract.getReserves()
      setReserves(reservesData)
    } catch (error) {
      console.error('Failed to load reserves:', error)
    }
  }

  const loadBalances = useCallback(async () => {
    try {
      const balancesData = await getWalletBalance(publicKey)
      setBalances(balancesData)
    } catch (error) {
      console.error('Failed to load balances:', error)
    }
  }, [publicKey])

  useEffect(() => {
    if (connected && publicKey) {
      loadReserves()
      loadBalances()
    }
  }, [connected, publicKey, loadBalances])

  return (
    <div className="min-h-screen">
      <Navbar 
        connected={connected} 
        publicKey={publicKey} 
        onConnect={setConnected}
      />
      
      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            <button
              onClick={() => setActiveTab('swap')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === 'swap' 
                  ? 'bg-white text-blue-600 shadow-lg' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Swap
            </button>
            <button
              onClick={() => setActiveTab('pool')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === 'pool' 
                  ? 'bg-white text-blue-600 shadow-lg' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Pool
            </button>
            <button
              onClick={() => setActiveTab('oracle')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === 'oracle' 
                  ? 'bg-white text-blue-600 shadow-lg' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Oracle
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 lg:py-12">
        {/* Swap Tab */}
        {activeTab === 'swap' && (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center mb-12 lg:mb-16">
              <div className="mb-6 lg:mb-8">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4 lg:mb-6">
                  StellarSwap AMM
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-3xl lg:max-w-4xl mx-auto leading-relaxed">
                  Decentralized exchange for Stellar tokens with automated market making.
                  <span className="hidden sm:inline lg:block">Swap tokens instantly with low fees and minimal slippage.</span>
                </p>
              </div>
              
              <div className="flex justify-center">
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
            </div>
          </div>
        )}

        {/* Pool Tab */}
        {activeTab === 'pool' && (
          <div className="space-y-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Liquidity Management</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Add or remove liquidity from the AMM pool and earn LP tokens.
              </p>
            </div>
            
            <PoolCard 
              connected={connected}
              publicKey={publicKey}
              reserves={reserves}
              balances={balances}
              onPoolUpdate={() => {
                loadReserves()
                loadBalances()
              }}
            />
          </div>
        )}

        {/* Oracle Tab */}
        {activeTab === 'oracle' && (
          <div className="space-y-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Price Oracle</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Real-time price feeds and time-weighted average calculations for reliable trading data.
              </p>
            </div>
            
            <OracleChart 
              connected={connected}
              publicKey={publicKey}
            />
          </div>
        )}
      </main>
    </div>
  )
}
