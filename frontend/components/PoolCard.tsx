'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Minus, TrendingUp, AlertTriangle } from 'lucide-react'
import { AmmPoolContract, getWalletBalance, buildAndSignTransaction, submitTransaction, createToast } from '@/lib/contracts'

interface PoolCardProps {
  connected: boolean
  publicKey: string
  reserves: { reserve_a: number; reserve_b: number }
  balances: { balance: string; asset: string }[]
  onPoolUpdate: () => void
}

export default function PoolCard({ connected, publicKey, reserves, balances, onPoolUpdate }: PoolCardProps) {
  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')
  const [lpTokens, setLpTokens] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const calculateLP = useCallback(async () => {
    try {
      if (!amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0) {
        setLpTokens('')
        return
      }

      const amountANum = parseFloat(amountA)
      const amountBnum = parseFloat(amountB)
      
      // Mock LP calculation - in real implementation, use contract call
      const lpAmount = Math.sqrt(amountANum * amountBnum)
      setLpTokens(lpAmount.toFixed(6))
    } catch (error) {
      console.error('Failed to calculate LP tokens:', error)
      setLpTokens('')
    }
  }, [amountA, amountB])

  const handleAddLiquidity = async () => {
    if (!connected || !amountA || !amountB || isAdding) return

    setIsAdding(true)
    
    try {
      const amountANum = parseFloat(amountA) * 1000000 // Convert to proper units
      const amountBnum = parseFloat(amountB) * 1000000

      const operation = await AmmPoolContract.addLiquidity(
        publicKey,
        amountANum,
        amountBnum,
        Math.floor(parseFloat(lpTokens) * 1000000)
      )

      const { transaction } = await buildAndSignTransaction(publicKey, [operation])
      const txHash = await submitTransaction(transaction)
      
      console.log('Liquidity added:', txHash)
      createToast('success', 'Liquidity added successfully!')
      
      // Reset form
      setAmountA('')
      setAmountB('')
      setLpTokens('')
      onPoolUpdate()
      
    } catch (error) {
      console.error('Failed to add liquidity:', error)
      createToast('error', 'Failed to add liquidity')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveLiquidity = async () => {
    if (!connected || !lpTokens || parseFloat(lpTokens) <= 0 || isRemoving) return

    setIsRemoving(true)
    
    try {
      const lpAmount = Math.floor(parseFloat(lpTokens) * 1000000)

      const operation = await AmmPoolContract.removeLiquidity(
        publicKey,
        lpAmount,
        Math.floor(lpAmount * 0.45), // 45% of token A
        Math.floor(lpAmount * 0.55), // 55% of token B
      )

      const { transaction } = await buildAndSignTransaction(publicKey, [operation])
      const txHash = await submitTransaction(transaction)
      
      console.log('Liquidity removed:', txHash)
      createToast('success', 'Liquidity removed successfully!')
      
      setLpTokens('')
      onPoolUpdate()
      
    } catch (error) {
      console.error('Failed to remove liquidity:', error)
      createToast('error', 'Failed to remove liquidity')
    } finally {
      setIsRemoving(false)
    }
  }

  const getPoolShare = useCallback(() => {
    const totalReserves = reserves.reserve_a + reserves.reserve_b
    if (totalReserves === 0) return '0'
    
    const userReserve = parseFloat(amountA) || 0
    return ((userReserve / totalReserves) * 100).toFixed(2)
  }, [reserves, amountA])

  return (
    <div className="w-full max-w-2xl">
      <div className="glass-card rounded-3xl p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Pool Management</h2>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-2 sm:p-3 hover:bg-gray-100 rounded-xl transition-all duration-300 hover:scale-105"
          >
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
          </button>
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="mb-6 p-4 bg-gray-50 rounded-2xl border-2 border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Advanced Settings</h3>
              <button
                onClick={() => setShowAdvanced(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Slippage Tolerance</label>
                <select className="input-field">
                  <option value="0.1">0.1%</option>
                  <option value="0.5">0.5%</option>
                  <option value="1.0">1.0%</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deadline (minutes)</label>
                <select className="input-field">
                  <option value="5">5 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Pool Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">Your Pool Share</h3>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Plus className="w-3 h-3 text-blue-600" />
                </div>
                <span className="text-lg sm:text-xl font-bold text-blue-900">{getPoolShare()}%</span>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{lpTokens || '0'} LP</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">Total Pool Size</h3>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-lg sm:text-xl font-bold text-green-900">
                  {(reserves.reserve_a + reserves.reserve_b).toLocaleString()}
                </span>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              ${(reserves.reserve_a + reserves.reserve_b).toLocaleString()}
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">24h Volume</h3>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8a2 2 0 012-2v8a2 2 0 01-2 2v8H5V7a2 2 0 00-2-2V3a2 2 0 00-2-2z" />
                  </svg>
                </div>
                <span className="text-lg sm:text-xl font-bold text-purple-900">$0</span>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">$0</p>
          </div>
        </div>

        {/* Add Liquidity */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Liquidity</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Token A Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={amountA}
                  onChange={(e: any) => setAmountA(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  className="input-field text-lg sm:text-xl font-bold"
                  disabled={!connected}
                />
                {connected && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg">
                    Balance: {balances.find(b => b.asset === 'Token A')?.balance || '0'}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Token B Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={amountB}
                  onChange={(e: any) => setAmountB(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  className="input-field text-lg sm:text-xl font-bold"
                  disabled={!connected}
                />
                {connected && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg">
                    Balance: {balances.find(b => b.asset === 'Token B')?.balance || '0'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={calculateLP}
              className="btn-secondary flex-1"
              disabled={!connected || !amountA || !amountB}
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              Calculate LP
            </button>
            
            <button
              onClick={handleAddLiquidity}
              disabled={!connected || !amountA || !amountB || !lpTokens || isAdding}
              className="btn-primary flex-1"
            >
              {isAdding ? (
                <span className="flex items-center justify-center">
                  <div className="loading-spinner w-5 h-5"></div>
                  Adding...
                </span>
              ) : (
                <>
                  <Plus className="w-5 h-5 mr-2" />
                  Add Liquidity
                </>
              )}
            </button>
          </div>
        </div>

        {/* Remove Liquidity */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Remove Liquidity</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">LP Token Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={lpTokens}
                  onChange={(e: any) => setLpTokens(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  className="input-field text-lg sm:text-xl font-bold"
                  disabled={!connected}
                />
                {connected && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg">
                    Balance: {balances.find(b => b.asset === 'LP Token')?.balance || '0'}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleRemoveLiquidity}
              disabled={!connected || !lpTokens || parseFloat(lpTokens) <= 0 || isRemoving}
              className="btn-primary w-full"
            >
              {isRemoving ? (
                <span className="flex items-center justify-center">
                  <div className="loading-spinner w-5 h-5"></div>
                  Removing...
                </span>
              ) : (
                <>
                  <Minus className="w-5 h-5 mr-2" />
                  Remove Liquidity
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
