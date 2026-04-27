'use client'

import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import SwapCard from '@/components/SwapCard'
import PoolCard from '@/components/PoolCard'
import { AmmPoolContract, getWalletBalance } from '@/lib/contracts'

export default function Home() {
  const [connected, setConnected] = useState(false)
  const [publicKey, setPublicKey] = useState('')
  const [reserves, setReserves] = useState({ reserve_a: 0, reserve_b: 0 })
  const [balances, setBalances] = useState<{ balance: string; asset: string }[]>([])
  const [activeTab, setActiveTab] = useState<'swap' | 'pool'>('swap')

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

            {/* Pool Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-12">
              <div className="stat-card hover:scale-105 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500">Token A Reserve</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                  {reserves.reserve_a.toLocaleString()}
                </p>
              </div>
              
              <div className="stat-card hover:scale-105 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500">Token B Reserve</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                  {reserves.reserve_b.toLocaleString()}
                </p>
              </div>
              
              <div className="stat-card hover:scale-105 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500">Current Price</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                  {reserves.reserve_a > 0 ? 
                    (reserves.reserve_b / reserves.reserve_a).toFixed(4) : 
                    '0.0000'
                  }
                </p>
              </div>
              
              <div className="stat-card hover:scale-105 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-500">24h Volume</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8a2 2 0 012-2v8a2 2 0 01-2 2v8H5V7a2 2 0 00-2-2V3a2 2 0 00-2-2z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">$0</p>
              </div>
            </div>

            {/* Features Section */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-8 mb-12">
              <div className="feature-card group">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-all duration-300">
                  <svg className="w-8 h-8 text-blue-600 group-hover:text-blue-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">Lightning Fast</h3>
                <p className="text-gray-600 leading-relaxed">Instant swaps powered by Stellar&apos;s fast settlement times and blockchain finality.</p>
              </div>
              
              <div className="feature-card group">
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-all duration-300">
                  <svg className="w-8 h-8 text-green-600 group-hover:text-green-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">Low Fees</h3>
                <p className="text-gray-600 leading-relaxed">Only 0.3% trading fee, the lowest in the market. Maximum value for users.</p>
              </div>
              
              <div className="feature-card group">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-all duration-300">
                  <svg className="w-8 h-8 text-purple-600 group-hover:text-purple-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">Secure</h3>
                <p className="text-gray-600 leading-relaxed">Audited smart contracts and non-custodial trading with advanced security measures.</p>
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
      </main>
    </div>
  )
}
