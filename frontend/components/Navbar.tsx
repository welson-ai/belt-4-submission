'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, TrendingUp, Users } from 'lucide-react'
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
  ]

  return (
    <>
      <nav className="bg-white/95 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16 lg:h-20">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="group flex items-center space-x-2 sm:space-x-3 transition-all duration-300 hover:scale-105">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:shadow-lg">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:scale-110 transition-transform duration-300" />
                </div>
                <span className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent group-hover:from-gray-800 group-hover:to-gray-600">
                  StellarSwap
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-6 lg:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="group flex items-center space-x-2 px-4 py-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-300 hover:scale-105"
                >
                  <item.icon className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium text-sm sm:text-base">{item.name}</span>
                </Link>
              ))}
            </div>

            {/* Wallet Connect Button */}
            <div className="hidden lg:flex items-center">
              {connected ? (
                <div className="flex items-center space-x-3 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-2xl px-4 py-3 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse-glow"></div>
                  <span className="text-sm font-semibold text-green-800">{formatAddress(publicKey)}</span>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  className="btn-primary hover:shadow-lg transition-all duration-300 hover:scale-105"
                >
                  Connect Wallet
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-3 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-300 hover:scale-105"
              >
                {isMenuOpen ? (
                  <X className="w-6 h-6 sm:w-7 sm:h-7" />
                ) : (
                  <Menu className="w-6 h-6 sm:w-7 sm:h-7" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Overlay */}
      {isMenuOpen && (
        <div className="mobile-menu">
          <div className="flex justify-center items-center h-16">
            <div className="text-white text-lg font-bold">StellarSwap</div>
          </div>
          
          <div className="flex-1 bg-white/95 backdrop-blur-lg">
            <div className="flex flex-col space-y-2 p-4 sm:p-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-300"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="font-medium text-base sm:text-lg">{item.name}</span>
                </Link>
              ))}
              
              <div className="border-t border-gray-200 pt-4 mt-4">
                {connected ? (
                  <div className="flex items-center space-x-3 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-2xl px-4 py-3 mx-auto max-w-sm">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full animate-pulse-glow"></div>
                    <span className="text-sm font-semibold text-green-800">{formatAddress(publicKey)}</span>
                  </div>
                ) : (
                  <button
                    onClick={handleConnect}
                    className="btn-primary w-full hover:shadow-lg transition-all duration-300"
                  >
                    Connect Wallet
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
