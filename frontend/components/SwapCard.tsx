'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowDownUp, AlertTriangle, Settings } from 'lucide-react'
import { AmmPoolContract, calculatePriceImpact, buildAndSignTransaction, submitTransaction, createToast } from '@/lib/contracts'

interface SwapCardProps {
  connected: boolean
  publicKey: string
  reserves: { reserve_a: number; reserve_b: number }
  balances: { balance: string; asset: string }[]
  onSwapComplete: () => void
}

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 0.001 },
  { label: '0.5%', value: 0.005 },
  { label: '1.0%', value: 0.01 },
]

export default function SwapCard({ connected, publicKey, reserves, balances, onSwapComplete }: SwapCardProps) {
  const [tokenIn, setTokenIn] = useState('Token A')
  const [tokenOut, setTokenOut] = useState('Token B')
  const [amountIn, setAmountIn] = useState('')
  const [amountOut, setAmountOut] = useState('')
  const [slippage, setSlippage] = useState(0.005) // 0.5%
  const [priceImpact, setPriceImpact] = useState(0)
  const [isSwapping, setIsSwapping] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const calculateOutput = useCallback(async () => {
    try {
      const amountInNum = parseFloat(amountIn)
      if (isNaN(amountInNum) || amountInNum <= 0) {
        setAmountOut('')
        setPriceImpact(0)
        return
      }

      // Mock price calculation - in real implementation, use contract call
      const tokenInAddress = tokenIn === 'Token A' ? 'token-a-address' : 'token-b-address'
      const outputAmount = await AmmPoolContract.getPrice(tokenInAddress, amountInNum * 1000000) // Convert to proper units
      const outputFormatted = (outputAmount / 1000000).toFixed(6)
      setAmountOut(outputFormatted)

      // Calculate price impact
      const impact = calculatePriceImpact(amountInNum * 1000000, reserves, tokenInAddress)
      setPriceImpact(impact)
    } catch (error) {
      console.error('Failed to calculate output:', error)
      setAmountOut('')
      setPriceImpact(0)
    }
  }, [amountIn, tokenIn, reserves])

  useEffect(() => {
    if (amountIn && reserves.reserve_a > 0 && reserves.reserve_b > 0) {
      calculateOutput()
    } else {
      setAmountOut('')
      setPriceImpact(0)
    }
  }, [amountIn, tokenIn, tokenOut, reserves, calculateOutput])

  const handleSwapTokens = () => {
    const tempToken = tokenIn
    setTokenIn(tokenOut)
    setTokenOut(tempToken)
    setAmountIn(amountOut)
    setAmountOut(amountIn)
  }

  const handleSwap = async () => {
    if (!connected || !amountIn || !amountOut) return

    setIsSwapping(true)
    
    try {
      // Build swap transaction
      const tokenInAddress = tokenIn === 'Token A' ? 'token-a-address' : 'token-b-address'
      const amountInNum = parseFloat(amountIn) * 1000000 // Convert to proper units
      const minAmountOut = parseFloat(amountOut) * 1000000 * (1 - slippage)

      const operation = await AmmPoolContract.swap(
        publicKey,
        tokenInAddress,
        amountInNum,
        Math.floor(minAmountOut)
      )

      const { transaction } = await buildAndSignTransaction(publicKey, [operation])
      const txHash = await submitTransaction(transaction)
      
      console.log('Swap completed:', txHash)
      onSwapComplete()
      
      // Reset form
      setAmountIn('')
      setAmountOut('')
      setPriceImpact(0)
      
    } catch (error) {
      console.error('Swap failed:', error)
    } finally {
      setIsSwapping(false)
    }
  }

  const isInsufficientBalance = () => {
    if (!amountIn || !connected) return false
    const amountInNum = parseFloat(amountIn)
    const balance = balances.find(b => b.asset === tokenIn)?.balance || '0'
    return amountInNum > parseFloat(balance)
  }

  return (
    <div className="w-full max-w-lg sm:max-w-xl">
      <div className="glass-card rounded-3xl p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Swap</h2>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 sm:p-3 hover:bg-gray-100 rounded-xl transition-all duration-300 hover:scale-105"
          >
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
              <label className="text-sm font-semibold text-gray-700">Slippage Tolerance</label>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {SLIPPAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSlippage(option.value)}
                  className={`py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    slippage === option.value
                      ? 'btn-primary shadow-lg transform scale-105'
                      : 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md hover:scale-105'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Swap Interface */}
        <div className="space-y-6">
          {/* Token Selection */}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Token In */}
            <div className="flex-1">
              <div className="bg-gray-50 rounded-2xl p-4 lg:p-6 border border-gray-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                  <label className="text-sm font-semibold text-gray-700">From</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={tokenIn}
                      onChange={(e: any) => setTokenIn(e.target.value)}
                      className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer py-2 px-3 rounded-xl"
                    >
                      <option value="Token A">Token A</option>
                      <option value="Token B">Token B</option>
                    </select>
                    <button
                      onClick={handleSwapTokens}
                      className="p-2 lg:hidden hover:bg-gray-100 rounded-lg transition-all duration-300 hover:scale-105"
                    >
                      <ArrowDownUp className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amountIn}
                    onChange={(e: any) => setAmountIn(e.target.value)}
                    placeholder="0.0"
                    step="0.000001"
                    className="input-field text-xl sm:text-2xl lg:text-3xl font-bold"
                    disabled={!connected}
                  />
                  {connected && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg">
                      Balance: {balances.find(b => b.asset === tokenIn)?.balance || '0'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Swap Arrow (Desktop Only) */}
            <div className="hidden lg:flex justify-center items-center">
              <button
                onClick={handleSwapTokens}
                className="p-4 bg-white border-2 border-gray-200 rounded-full hover:bg-gray-50 transition-all duration-300 hover:scale-110"
              >
                <ArrowDownUp className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {/* Token Out */}
            <div className="flex-1">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 lg:p-6 border border-gray-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                  <label className="text-sm font-semibold text-gray-700">To</label>
                  <select
                    value={tokenOut}
                    onChange={(e: any) => setTokenOut(e.target.value)}
                    className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer py-2 px-3 rounded-xl"
                  >
                    <option value="Token A">Token A</option>
                    <option value="Token B">Token B</option>
                  </select>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={amountOut}
                    placeholder="0.0"
                    className="input-field text-xl sm:text-2xl lg:text-3xl font-bold"
                    disabled
                    readOnly
                  />
                  {connected && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg">
                      Balance: {balances.find(b => b.asset === tokenOut)?.balance || '0'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Price Impact Warning */}
          {priceImpact > 2 && (
            <div className="flex items-center space-x-3 p-4 bg-red-50 border-2 border-red-200 rounded-2xl animate-pulse-glow">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-red-800">High price impact</span>
                <span className="text-lg font-bold text-red-900">{priceImpact.toFixed(2)}%</span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={handleSwap}
              disabled={!connected || !amountIn || isSwapping || isInsufficientBalance()}
              className={`flex-1 py-4 px-6 rounded-2xl font-bold text-base sm:text-lg transition-all duration-300 ${
                !connected || !amountIn || isSwapping || isInsufficientBalance()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'btn-primary hover:shadow-xl transform hover:scale-105 active:scale-95'
              }`}
            >
              {isSwapping ? (
                <span className="flex items-center justify-center">
                  <div className="loading-spinner w-5 h-5 sm:w-6 sm:h-6"></div>
                  <span className="ml-3">Swapping...</span>
                </span>
              ) : !connected ? (
                <span className="flex items-center justify-center">
                  <div className="w-5 h-5 bg-blue-500 rounded-full mr-2"></div>
                  Connect Wallet
                </span>
              ) : isInsufficientBalance() ? (
                <span className="flex items-center justify-center">
                  <div className="w-5 h-5 bg-red-500 rounded-full mr-2"></div>
                  Insufficient Balance
                </span>
              ) : !amountIn ? (
                <span className="flex items-center justify-center">
                  <div className="w-5 h-5 bg-yellow-500 rounded-full mr-2"></div>
                  Enter Amount
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <div className="w-5 h-5 bg-green-500 rounded-full mr-2"></div>
                  {`Swap ${tokenIn} → ${tokenOut}`}
                </span>
              )}
            </button>
          </div>

          {/* Swap Info */}
          {amountIn && amountOut && (
            <div className="mt-6 pt-6 border-t-2 border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="text-xs font-medium text-gray-500 mb-1">Price Impact</div>
                  <div className={`text-lg sm:text-xl font-bold ${priceImpact > 2 ? 'text-red-600' : priceImpact > 0.5 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {priceImpact.toFixed(2)}%
                  </div>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <div className="text-xs font-medium text-gray-500 mb-1">Minimum Received</div>
                  <div className="text-lg sm:text-xl font-bold text-blue-900">
                    {(parseFloat(amountOut) * (1 - slippage)).toFixed(6)} {tokenOut}
                  </div>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-xl">
                  <div className="text-xs font-medium text-gray-500 mb-1">Slippage Tolerance</div>
                  <div className="text-lg sm:text-xl font-bold text-purple-900">
                    {(slippage * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
