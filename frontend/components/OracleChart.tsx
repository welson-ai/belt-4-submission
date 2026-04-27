'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { PriceOracleContract } from '@/lib/contracts'

interface OracleChartProps {
  connected: boolean
  publicKey: string
}

interface PriceData {
  timestamp: number
  price: number
  cumulative_price: number
}

interface TimeWindow {
  label: string
  value: number
  color: string
}

export default function OracleChart({ connected, publicKey }: OracleChartProps) {
  const [priceHistory, setPriceHistory] = useState<PriceData[]>([])
  const [selectedPair, setSelectedPair] = useState('Token A/Token B')
  const [timeWindow, setTimeWindow] = useState(3600) // 1 hour
  const [isLoading, setIsLoading] = useState(false)

  const timeWindows: TimeWindow[] = [
    { label: '5 minutes', value: 300, color: 'blue' },
    { label: '15 minutes', value: 900, color: 'green' },
    { label: '30 minutes', value: 1800, color: 'purple' },
    { label: '1 hour', value: 3600, color: 'orange' },
    { label: '6 hours', value: 21600, color: 'red' },
    { label: '24 hours', value: 86400, color: 'indigo' },
  ]

  const loadPriceHistory = useCallback(async () => {
    if (!connected) return

    setIsLoading(true)
    try {
      const history = await PriceOracleContract.getPriceHistory('token-a-address', 'token-b-address', 50)
      setPriceHistory(history)
    } catch (error) {
      console.error('Failed to load price history:', error)
    } finally {
      setIsLoading(false)
    }
  }, [connected])

  const getTWAP = useCallback(() => {
    if (priceHistory.length === 0) return 0

    const now = Date.now()
    const windowStart = now - timeWindow * 1000
    
    let filteredData = priceHistory.filter(data => data.timestamp >= windowStart)
    if (filteredData.length < 2) return 0

    // Calculate TWAP
    let totalCumulative = 0
    let totalTime = 0
    let previousTimestamp = filteredData[0].timestamp

    for (let i = 0; i < filteredData.length; i++) {
      const current = filteredData[i]
      const timeDelta = current.timestamp - previousTimestamp
      
      if (timeDelta > 0) {
        totalCumulative += current.cumulative_price * timeDelta
        totalTime += timeDelta
      }
      
      previousTimestamp = current.timestamp
    }

    return totalTime > 0 ? totalCumulative / totalTime : 0
  }, [priceHistory, timeWindow])

  const getCurrentPrice = useCallback(() => {
    if (priceHistory.length === 0) return 0
    return priceHistory[priceHistory.length - 1]?.price || 0
  }, [priceHistory])

  const getPriceChange = useCallback(() => {
    if (priceHistory.length < 2) return { change: 0, direction: 'neutral' }
    
    const current = getCurrentPrice()
    const previous = priceHistory[priceHistory.length - 2]?.price || current
    
    if (current === previous) return { change: 0, direction: 'neutral' }
    
    const change = ((current - previous) / previous) * 100
    return {
      change,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    }
  }, [priceHistory])

  const formatPrice = useCallback((price: number) => {
    return (price / 1000000).toFixed(6)
  }, [])

  const formatTimestamp = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }, [])

  const getChartData = useCallback(() => {
    return priceHistory.slice(-20).map(data => ({
      time: formatTimestamp(data.timestamp),
      price: formatPrice(data.price)
    }))
  }, [priceHistory])

  return (
    <div className="w-full max-w-6xl">
      <div className="glass-card rounded-3xl p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Price Oracle</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-600">Live Price Feed</span>
            </div>
            {isLoading && (
              <div className="loading-spinner w-4 h-4"></div>
            )}
          </div>
        </div>

        {/* Pair Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Trading Pair</label>
          <select
            value={selectedPair}
            onChange={(e: any) => setSelectedPair(e.target.value)}
            className="input-field"
            disabled={!connected}
          >
            <option value="Token A/Token B">Token A / Token B</option>
            <option value="Token A/Token C">Token A / Token C</option>
            <option value="Token B/Token C">Token B / Token C</option>
          </select>
        </div>

        {/* Current Price Display */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 mb-8">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">Current Price</h3>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <span className="text-xs text-gray-500">Token A → Token B</span>
              </div>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-blue-900">
              {formatPrice(getCurrentPrice())}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              1 Token A = {formatPrice(getCurrentPrice())} Token B
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">24h Change</h3>
              <div className="flex items-center gap-2">
                {(() => {
                  const change = getPriceChange()
                  if (change.direction === 'up') {
                    return <TrendingUp className="w-5 h-5 text-green-600" />
                  } else if (change.direction === 'down') {
                    return <TrendingDown className="w-5 h-5 text-red-600" />
                  } else {
                    return <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                  }
                })()}
                <span className={`text-sm font-medium ${
                  change.direction === 'up' ? 'text-green-600' : 
                  change.direction === 'down' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {change.change > 0 ? '+' : ''}{Math.abs(change.change).toFixed(2)}%
                </span>
              </div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900">
              {formatPrice(getCurrentPrice())}
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">TWAP ({timeWindows.find(w => w.value === timeWindow)?.label || '1h'})</h3>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                <span className="text-xs text-gray-500">Time-weighted average</span>
              </div>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-purple-900">
              {formatPrice(getTWAP())}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {timeWindows.find(w => w.value === timeWindow)?.label || '1h'} average price
            </div>
          </div>
        </div>

        {/* Time Window Selection */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Time Window</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            {timeWindows.map((window) => (
              <button
                key={window.value}
                onClick={() => setTimeWindow(window.value)}
                className={`p-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  timeWindow === window.value
                    ? 'btn-primary shadow-lg transform scale-105'
                    : 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md hover:scale-105'
                }`}
              >
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full bg-${window.color}-100`}></div>
                  <span>{window.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-center">
          <button
            onClick={loadPriceHistory}
            disabled={!connected || isLoading}
            className="btn-secondary hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <BarChart3 className="w-5 h-5 mr-2" />
            {isLoading ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>

        {/* Price Chart */}
        {priceHistory.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Price History (Last 20 points)</h3>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <div className="h-64 sm:h-80 lg:h-96">
                {/* Simple chart visualization */}
                <div className="h-full flex items-end space-x-1">
                  {getChartData().map((point, index) => (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center"
                      title={`${point.time} - ${point.price}`}
                    >
                      <div className="h-2 bg-blue-500 rounded-t"></div>
                      <div className="text-xs text-gray-600 mt-1">{point.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="stat-card">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Data Points</h3>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">{priceHistory.length}</div>
          </div>
          
          <div className="stat-card">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Time Range</h3>
            <div className="text-lg sm:text-xl font-bold text-gray-900">
              {priceHistory.length > 1 ? 
                `${formatTimestamp(priceHistory[0]?.timestamp || 0)} - ${formatTimestamp(priceHistory[priceHistory.length - 1]?.timestamp || 0)}` : 
                'No data'
              }
            </div>
          </div>

          <div className="stat-card">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Price Range</h3>
            <div className="text-lg sm:text-xl font-bold text-gray-900">
              {priceHistory.length > 1 ? 
                `${Math.min(...priceHistory.map(p => p.price))} - ${Math.max(...priceHistory.map(p => p.price))}` : 
                'No data'
              }
            </div>
          </div>

          <div className="stat-card">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Last Update</h3>
            <div className="text-lg sm:text-xl font-bold text-gray-900">
              {priceHistory.length > 0 ? 
                formatTimestamp(priceHistory[priceHistory.length - 1]?.timestamp || 0) : 
                'Never'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
