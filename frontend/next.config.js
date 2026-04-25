/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: 'testnet',
    NEXT_PUBLIC_HORIZON_URL: 'https://horizon-testnet.stellar.org',
  },
}

module.exports = nextConfig
