#!/bin/bash

set -e

echo "🚀 Deploying StellarSwap AMM contracts to testnet..."

# Check if required environment variables are set
if [ -z "$STELLAR_SECRET_KEY" ]; then
    echo "❌ STELLAR_SECRET_KEY environment variable is not set"
    exit 1
fi

if [ -z "$NETWORK_PASSPHRASE" ]; then
    echo "❌ NETWORK_PASSPHRASE environment variable is not set"
    exit 1
fi

# Network configuration
NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org:443"
HORIZON_URL="https://horizon-testnet.stellar.org"

echo "📡 Network: $NETWORK"
echo "🔗 RPC URL: $RPC_URL"
echo "🌐 Horizon URL: $HORIZON_URL"

# Function to deploy contract
deploy_contract() {
    local contract_name=$1
    local contract_path=$2
    
    echo "📦 Deploying $contract_name..."
    
    # Deploy the contract
    contract_id=$(soroban contract deploy \
        --wasm $contract_path \
        --source $STELLAR_SECRET_KEY \
        --network $NETWORK \
        --rpc-url $RPC_URL)
    
    echo "✅ $contract_name deployed at: $contract_id"
    echo "$contract_id" > .${contract_name}_address
    
    return 0
}

# Function to initialize contract
initialize_contract() {
    local contract_name=$1
    local contract_id=$2
    shift 2
    local args="$@"
    
    echo "🔧 Initializing $contract_name..."
    
    soroban contract invoke \
        --id $contract_id \
        --source $STELLAR_SECRET_KEY \
        --network $NETWORK \
        --rpc-url $RPC_URL \
        -- $args
    
    echo "✅ $contract_name initialized"
}

# Build contracts
echo "🔨 Building contracts..."
soroban contract build contracts/price_oracle
soroban contract build contracts/lp_token
soroban contract build contracts/amm_pool

# Deploy contracts in order
echo ""
echo "📋 Step 1: Deploying Price Oracle"
ORACLE_ID=$(deploy_contract "price_oracle" "contracts/price_oracle/target/wasm32-unknown-unknown/release/price_oracle.wasm")

# Initialize oracle
initialize_contract "price_oracle" $ORACLE_ID "initialize" "--id" "$(soroban keys address $STELLAR_SECRET_KEY)"

echo ""
echo "📋 Step 2: Deploying LP Token"
LP_TOKEN_ID=$(deploy_contract "lp_token" "contracts/lp_token/target/wasm32-unknown-unknown/release/lp_token.wasm")

# Initialize LP token
initialize_contract "lp_token" $LP_TOKEN_ID "initialize" \
    "--id" "$(soroban keys address $STELLAR_SECRET_KEY)" \
    "--str" "StellarSwap LP Token" \
    "--str" "SLPT" \
    "--u32" "7"

echo ""
echo "📋 Step 3: Deploying AMM Pool"
AMM_POOL_ID=$(deploy_contract "amm_pool" "contracts/amm_pool/target/wasm32-unknown-unknown/release/amm_pool.wasm")

# Initialize AMM pool
initialize_contract "amm_pool" $AMM_POOL_ID "initialize" \
    "--id" "$(soroban keys address $STELLAR_SECRET_KEY)" \
    "--id" "$(soroban keys address $STELLAR_SECRET_KEY)" \
    "--id" "$(soroban keys address $STELLAR_SECRET_KEY)" \
    "--id" "$ORACLE_ID"

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📄 Contract Addresses:"
echo "├── Price Oracle: $ORACLE_ID"
echo "├── LP Token: $LP_TOKEN_ID"
echo "└── AMM Pool: $AMM_POOL_ID"
echo ""
echo "💡 Save these addresses in your frontend .env.local file:"
echo "NEXT_PUBLIC_PRICE_ORACLE_CONTRACT=$ORACLE_ID"
echo "NEXT_PUBLIC_LP_TOKEN_CONTRACT=$LP_TOKEN_ID"
echo "NEXT_PUBLIC_AMM_POOL_CONTRACT=$AMM_POOL_ID"
echo ""
# Save contract addresses for CI
cat > deployed_addresses.json << EOF
{
  "oracle": "$ORACLE_ID",
  "lp_token": "$LP_TOKEN_ID", 
  "amm_pool": "$AMM_POOL_ID",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "📋 Contract addresses saved to deployed_addresses.json"

echo "🔍 Verify contracts on Stellar Explorer:"
echo "https://stellar.expert/explorer/testnet/contract/$ORACLE_ID"
echo "https://stellar.expert/explorer/testnet/contract/$LP_TOKEN_ID"
echo "https://stellar.expert/explorer/testnet/contract/$AMM_POOL_ID"
