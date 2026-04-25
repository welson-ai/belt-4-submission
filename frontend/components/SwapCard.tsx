'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (amountIn && reserves.reserve_a > 0 && reserves.reserve_b > 0) {
      calculateOutput()
    } else {
      setAmountOut('')
      setPriceImpact(0)
    }
  }, [amountIn, tokenIn, tokenOut, reserves])

  const calculateOutput = async () => {
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
  }

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
    <div className="w-full max-w-md">
      <div className="glass-card rounded-2xl p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Swap</h2>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slippage Tolerance
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SLIPPAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSlippage(option.value)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    slippage === option.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Swap Interface */}
        <div className="space-y-4">
          {/* Token In */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">From</label>
              <select
                value={tokenIn}
                onChange={(e: any) => setTokenIn(e.target.value)}
                className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="Token A">Token A</option>
                <option value="Token B">Token B</option>
              </select>
            </div>
            <input
              type="number"
              value={amountIn}
              onChange={(e: any) => setAmountIn(e.target.value)}
              placeholder="0.0"
              className="w-full bg-transparent text-2xl font-bold text-gray-900 placeholder-gray-400 border-none focus:outline-none"
              disabled={!connected}
            />
            {connected && (
              <div className="text-sm text-gray-500 mt-1">
                Balance: {balances.find(b => b.asset === tokenIn)?.balance || '0'} {tokenIn}
              </div>
            )}
          </div>

          {/* Swap Button */}
          <div className="flex justify-center">
            <button
              onClick={handleSwapTokens}
              className="p-3 bg-white border-2 border-gray-200 rounded-full hover:bg-gray-50 transition-colors duration-200"
            >
              <ArrowDownUp className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Token Out */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">To</label>
              <select
                value={tokenOut}
                onChange={(e: any) => setTokenOut(e.target.value)}
                className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="Token A">Token A</option>
                <option value="Token B">Token B</option>
              </select>
            </div>
            <input
              type="text"
              value={amountOut}
              placeholder="0.0"
              className="w-full bg-transparent text-2xl font-bold text-gray-900 placeholder-gray-400 border-none focus:outline-none"
              disabled
              readOnly
            />
            {connected && (
              <div className="text-sm text-gray-500 mt-1">
                Balance: {balances.find(b => b.asset === tokenOut)?.balance || '0'} {tokenOut}
              </div>
            )}
          </div>

          {/* Price Impact Warning */}
          {priceImpact > 2 && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                High price impact: {priceImpact.toFixed(2)}%
              </span>
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={!connected || !amountIn || isSwapping || isInsufficientBalance()}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors duration-200 ${
              !connected || !amountIn || isSwapping || isInsufficientBalance()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'btn-primary'
            }`}
          >
            {isSwapping ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Swapping...
              </span>
            ) : !connected ? (
              'Connect Wallet'
            ) : isInsufficientBalance() ? (
              'Insufficient Balance'
            ) : !amountIn ? (
              'Enter Amount'
            ) : (
              `Swap ${tokenIn} → ${tokenOut}`
            )}
          </button>
        </div>

        {/* Swap Info */}
        {amountIn && amountOut && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Price Impact</span>
              <span className={`font-medium ${priceImpact > 2 ? 'text-red-600' : 'text-gray-900'}`}>
                {priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-600">Minimum Received</span>
              <span className="font-medium text-gray-900">
                {(parseFloat(amountOut) * (1 - slippage)).toFixed(6)} {tokenOut}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-600">Slippage Tolerance</span>
              <span className="font-medium text-gray-900">{(slippage * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
