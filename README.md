# StellarSwap - AMM DEX on Stellar

A production-ready Automated Market Maker (AMM) decentralized exchange built on Stellar using Soroban smart contracts.

## 🌟 Features

- **Constant Product AMM**: Uniswap V2 style x * y = k formula
- **Low Fees**: Only 0.3% trading fee
- **TWAP Oracle**: Time-weighted average price oracle for reliable price feeds
- **Inter-Contract Calls**: Seamless integration between contracts
- **Mobile Responsive**: Beautiful UI that works on all devices
- **Non-Custodial**: Users maintain control of their funds
- **Freighter Integration**: Easy wallet connection

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   LP Token      │    │   AMM Pool      │    │  Price Oracle   │
│   Contract      │◄──►│   Contract      │◄──►│   Contract      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                         ┌─────────────────┐
                         │   Frontend      │
                         │   (Next.js)     │
                         └─────────────────┘
```

### Smart Contracts

#### 1. LP Token Contract (`contracts/lp_token/`)
- Custom fungible token following Stellar token interface
- Functions: `initialize`, `mint`, `burn`, `transfer`, `balance`, `allowance`, `approve`
- Access control: Only Pool contract can mint/burn tokens
- Events: Emits events on mint, burn, transfer operations

#### 2. AMM Pool Contract (`contracts/amm_pool/`)
- Constant product formula: x * y = k
- 0.3% swap fee (30 basis points)
- Inter-contract calls to LP token for liquidity management
- Functions: `initialize`, `add_liquidity`, `remove_liquidity`, `swap`, `get_price`, `get_reserves`
- Calls oracle after each swap to record price data

#### 3. Price Oracle Contract (`contracts/price_oracle/`)
- Time-weighted average price (TWAP) calculations
- Stores price history for up to 100 snapshots
- Functions: `initialize`, `record_price`, `get_twap`, `get_latest_price`, `get_price_history`

### Frontend

- **Framework**: Next.js 14 + TypeScript + Tailwind CSS
- **Wallet Integration**: Freighter wallet SDK
- **Stellar SDK**: @stellar/stellar-sdk for blockchain interactions
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Pages**:
  - `/` - Swap interface with price calculation and slippage control
  - `/pool` - Add/Remove liquidity management
  - `/oracle` - Price charts from TWAP oracle data

## 🚀 Quick Start

### Prerequisites

- Rust 1.70+ and Soroban CLI
- Node.js 20+
- Freighter wallet extension

### 1. Clone and Setup

```bash
git clone <repository-url>
cd stellar-amm-dex
```

### 2. Build and Test Contracts

```bash
# Build all contracts
soroban contract build contracts/lp_token
soroban contract build contracts/amm_pool
soroban contract build contracts/price_oracle

# Run tests
cargo test
```

### 3. Deploy to Testnet

```bash
# Make deploy script executable
chmod +x scripts/deploy.sh

# Set environment variables
export STELLAR_SECRET_KEY="your-secret-key"
export NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Deploy contracts
./scripts/deploy.sh
```

### 4. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local

# Add contract addresses to .env.local:
# NEXT_PUBLIC_LP_TOKEN_CONTRACT=<deployed-lp-token-address>
# NEXT_PUBLIC_AMM_POOL_CONTRACT=<deployed-amm-pool-address>
# NEXT_PUBLIC_PRICE_ORACLE_CONTRACT=<deployed-oracle-address>

# Run development server
npm run dev
```

Visit `http://localhost:3000` to use the DEX.

## 📱 Usage

### Adding Liquidity

1. Connect your Freighter wallet
2. Navigate to the Pool page
3. Enter amounts for both tokens
4. Set minimum LP tokens you're willing to receive
5. Approve and submit transaction

### Swapping Tokens

1. Connect your Freighter wallet
2. Select input and output tokens
3. Enter amount to swap
4. Adjust slippage tolerance if needed
5. Review price impact warning
6. Submit transaction

### Viewing Price Data

1. Navigate to the Oracle page
2. View TWAP charts and price history
3. Monitor price trends over time

## 🔧 Development

### Contract Testing

```bash
# Run all contract tests
cargo test

# Run specific contract tests
cargo test -p lp_token
cargo test -p amm_pool
cargo test -p price_oracle
```

### Frontend Development

```bash
cd frontend

# Type checking
npm run type-check

# Linting
npm run lint

# Build
npm run build
```

### CI/CD

The project includes GitHub Actions for:

- **Contract Pipeline**: Format check, clippy, tests, and build
- **Frontend Pipeline**: Type checking, linting, and build
- **Deploy Pipeline**: Manual deployment to testnet

## 📊 Contract Addresses (Testnet)

*After deployment, update these addresses:*

- **LP Token**: `TBD`
- **AMM Pool**: `TBD` 
- **Price Oracle**: `TBD`

## 🔒 Security

- All contracts include access controls and input validation
- Inter-contract calls use proper Soroban invoke patterns
- Frontend uses secure wallet connection patterns
- Contracts are designed to prevent common attack vectors:
  - Reentrancy protection
  - Integer overflow/underflow checks
  - Access control enforcement
  - Slippage protection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and code comments
- **Issues**: Open an issue on GitHub for bugs or feature requests
- **Discord**: Join our community for support and discussions

## 🗺️ Roadmap

- [ ] Multi-token pool support
- [ ] Concentrated liquidity positions
- [ ] Governance token
- [ ] Yield farming incentives
- [ ] Advanced order types
- [ ] Cross-chain bridges

## 📈 Performance

- **Swap Execution**: ~3-5 seconds on Stellar Testnet
- **Price Updates**: Real-time via oracle
- **UI Responsiveness**: <100ms interactions
- **Mobile Optimization**: Full responsive design

---

**Built with ❤️ for the Stellar ecosystem**
