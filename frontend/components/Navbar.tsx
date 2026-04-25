'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, TrendingUp, Users, BarChart3 } from 'lucide-react'
import { connectWallet, formatAddress } from '@/lib/contracts'

interface NavbarProps {
  connected: boolean
  publicKey: string
  onConnect: (connected: boolean, publicKey: string) => void
}

export default function Navbar({ connected, publicKey, onConnect }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleConnect = async () => {
    try {
      const result = await connectWallet()
      onConnect(result.connected, result.publicKey)
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  const navigation = [
    { name: 'Swap', href: '/', icon: TrendingUp },
    { name: 'Pool', href: '/pool', icon: Users },
    { name: 'Oracle', href: '/oracle', icon: BarChart3 },
  ]

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">StellarSwap</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                <item.icon className="w-4 h-4" />
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Wallet Connect Button */}
          <div className="hidden md:flex items-center">
            {connected ? (
              <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-800">
                  {formatAddress(publicKey)}
                </span>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="btn-primary"
              >
                Connect Wallet
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="flex flex-col space-y-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-50 transition-colors duration-200"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              ))}
              
              <div className="border-t border-gray-200 pt-3 mt-2">
                {connected ? (
                  <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mx-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-800">
                      {formatAddress(publicKey)}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleConnect}
                    className="btn-primary mx-3 w-full"
                  >
                    Connect Wallet
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
