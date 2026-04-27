'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import OracleChart from '@/components/OracleChart'

export default function Oracle() {
  const [connected, setConnected] = useState(false)
  const [publicKey, setPublicKey] = useState('')

  return (
    <div className="min-h-screen">
      <Navbar 
        connected={connected} 
        publicKey={publicKey} 
        onConnect={setConnected}
      />
      
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 lg:py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">Price Oracle</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-8">
            Real-time price feeds and time-weighted average calculations for reliable trading data.
          </p>
        </div>
        
        <OracleChart 
          connected={connected}
          publicKey={publicKey}
        />
      </main>
    </div>
  )
}
