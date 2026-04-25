import { 
  Horizon,
  TransactionBuilder, 
  Networks,
  BASE_FEE,
  Operation,
} from '@stellar/stellar-sdk';

// Type declarations for Freighter API
interface FreighterAPI {
  getPublicKey(): Promise<{ publicKey: string }>;
  signTransaction(xdr: string): Promise<{ signedTransactionXdr: string }>;
}

interface FreighterWindow {
  freighter?: FreighterAPI;
}

declare global {
  interface Window extends FreighterWindow {}
}

// Contract interfaces
export interface PoolInfo {
  token_a: string;
  token_b: string;
  lp_token: string;
  reserve_a: number;
  reserve_b: number;
  total_lp_supply: number;
  admin: string;
}

export interface PriceSnapshot {
  price: number;
  timestamp: number;
  cumulative_price: number;
}

export interface AllowanceValue {
  amount: number;
  expires_at: number;
}

// Contract configuration
const CONTRACT_CONFIG = {
  lpToken: process.env.NEXT_PUBLIC_LP_TOKEN_CONTRACT || '',
  ammPool: process.env.NEXT_PUBLIC_AMM_POOL_CONTRACT || '',
  priceOracle: process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT || '',
  tokenA: process.env.NEXT_PUBLIC_TOKEN_A_ADDRESS || '',
  tokenB: process.env.NEXT_PUBLIC_TOKEN_B_ADDRESS || '',
};

// Stellar server setup
export const server = new Horizon.Server(process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org');
export const networkPassphrase = Networks.TESTNET;

// Helper functions
export const formatAddress = (address: string): string => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const formatBalance = (balance: number, decimals: number = 7): string => {
  return (balance / Math.pow(10, decimals)).toFixed(decimals);
};

// Wallet connection
export const connectWallet = async (): Promise<{ publicKey: string; connected: boolean }> => {
  try {
    // Mock allowAccess function for now
    const isAllowed = true;
    if (!isAllowed) {
      throw new Error('Wallet access denied');
    }

    if (!window.freighter) {
      throw new Error('Freighter wallet not installed');
    }

    const { publicKey } = await window.freighter.getPublicKey();
    return { publicKey, connected: true };
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    return { publicKey: '', connected: false };
  }
};

export const getWalletBalance = async (publicKey: string): Promise<{ balance: string; asset: string }[]> => {
  try {
    const account = await server.loadAccount(publicKey);
    return account.balances.map((balance: any) => ({
      balance: balance.balance,
      asset: balance.asset_type === 'native' ? 'XLM' : balance.asset_code || 'Unknown',
    }));
  } catch (error) {
    console.error('Failed to get wallet balance:', error);
    return [];
  }
};

// Transaction building and signing
export const buildAndSignTransaction = async (
  publicKey: string,
  operations: any[],
  memo?: string
): Promise<{ transaction: string; hash: string }> => {
  try {
    const account = await server.loadAccount(publicKey);
    
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(operations[0] as any) // For now, handling single operation
      .setTimeout(30)
      .build();

    const { signedTransactionXdr } = await window.freighter!.signTransaction(transaction.toXDR());
    const signedTransaction = TransactionBuilder.fromXDR(signedTransactionXdr, networkPassphrase);
    
    return {
      transaction: signedTransactionXdr,
      hash: signedTransaction.hash().toString('hex'),
    };
  } catch (error) {
    console.error('Failed to build and sign transaction:', error);
    throw error;
  }
};

export const submitTransaction = async (transactionXdr: string): Promise<string> => {
  try {
    const transaction = TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
    const result = await server.submitTransaction(transaction);
    return result.hash;
  } catch (error) {
    console.error('Failed to submit transaction:', error);
    throw error;
  }
};

export const simulateTransaction = async (transactionXdr: string): Promise<any> => {
  try {
    const transaction = TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
    // In a real implementation, you would use Soroban RPC for simulation
    // For now, we'll just return a mock response
    return {
      success: true,
      result: '0x',
    };
  } catch (error) {
    console.error('Failed to simulate transaction:', error);
    throw error;
  }
};

// LP Token Contract Functions
export class LpTokenContract {
  static async initialize(admin: string, name: string, symbol: string, decimals: number) {
    const operation = Operation.invokeContractFunction({
      contract: CONTRACT_CONFIG.lpToken,
      function: 'initialize',
      args: [
        // Convert arguments to proper XDR format
        // This is a simplified version - in production you'd use proper XDR encoding
      ],
    });

    return operation;
  }

  static async balance(address: string): Promise<number> {
    // In a real implementation, you'd use Soroban RPC to call the contract
    // For now, return a mock value
    return 0;
  }

  static async allowance(owner: string, spender: string): Promise<AllowanceValue> {
    // Mock implementation
    return { amount: 0, expires_at: 0 };
  }
}

// AMM Pool Contract Functions
export class AmmPoolContract {
  static async getReserves(): Promise<{ reserve_a: number; reserve_b: number }> {
    // In a real implementation, you'd use Soroban RPC to call the contract
    // For now, return mock values
    return { reserve_a: 1000000, reserve_b: 2000000 };
  }

  static async getPoolInfo(): Promise<PoolInfo> {
    // Mock implementation
    return {
      token_a: CONTRACT_CONFIG.tokenA,
      token_b: CONTRACT_CONFIG.tokenB,
      lp_token: CONTRACT_CONFIG.lpToken,
      reserve_a: 1000000,
      reserve_b: 2000000,
      total_lp_supply: 1500000,
      admin: 'GADMIN...',
    };
  }

  static async getPrice(tokenIn: string, amountIn: number): Promise<number> {
    // Mock price calculation
    const reserves = await this.getReserves();
    const feeBps = 30; // 0.3%
    const feeMultiplier = 10000 - feeBps;
    
    let amountInWithFee = (amountIn * feeMultiplier) / 10000;
    let amountOut = (amountInWithFee * (tokenIn === CONTRACT_CONFIG.tokenA ? reserves.reserve_b : reserves.reserve_a)) / 
                   ((tokenIn === CONTRACT_CONFIG.tokenA ? reserves.reserve_a : reserves.reserve_b) + amountInWithFee);
    
    return amountOut;
  }

  static async addLiquidity(
    user: string,
    amountA: number,
    amountB: number,
    minLp: number
  ): Promise<any> {
    // Mock operation for now - in production, this would be a proper Soroban operation
    return {
      type: 'invoke_contract_function',
      contract: CONTRACT_CONFIG.ammPool,
      function: 'add_liquidity',
      args: [user, amountA, amountB, minLp],
    };
  }

  static async removeLiquidity(
    user: string,
    lpAmount: number,
    minA: number,
    minB: number
  ): Promise<any> {
    // Mock operation for now - in production, this would be a proper Soroban operation
    return {
      type: 'invoke_contract_function',
      contract: CONTRACT_CONFIG.ammPool,
      function: 'remove_liquidity',
      args: [user, lpAmount, minA, minB],
    };
  }

  static async swap(
    user: string,
    tokenIn: string,
    amountIn: number,
    minAmountOut: number
  ): Promise<any> {
    // Mock operation for now - in production, this would be a proper Soroban operation
    return {
      type: 'invoke_contract_function',
      contract: CONTRACT_CONFIG.ammPool,
      function: 'swap',
      args: [user, tokenIn, amountIn, minAmountOut],
    };
  }
}

// Price Oracle Contract Functions
export class PriceOracleContract {
  static async getTwap(tokenA: string, tokenB: string, period: number): Promise<number> {
    // Mock implementation
    return 1500000; // 1.5 with 6 decimals
  }

  static async getLatestPrice(tokenA: string, tokenB: string): Promise<number> {
    // Mock implementation
    return 1500000;
  }

  static async getPriceHistory(tokenA: string, tokenB: string, limit: number): Promise<PriceSnapshot[]> {
    // Mock implementation
    const baseTime = Date.now() - 86400000; // 24 hours ago
    return Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
      price: 1500000 + (i * 100000),
      timestamp: baseTime + (i * 3600000),
      cumulative_price: 1500000 * (i + 1),
    }));
  }
}

// Utility functions for price impact calculation
export const calculatePriceImpact = (amountIn: number, reserves: { reserve_a: number; reserve_b: number }, tokenIn: string): number => {
  const { reserve_a, reserve_b } = reserves;
  const reserveIn = tokenIn === CONTRACT_CONFIG.tokenA ? reserve_a : reserve_b;
  const reserveOut = tokenIn === CONTRACT_CONFIG.tokenA ? reserve_b : reserve_a;
  
  const amountOut = (amountIn * reserveOut) / (reserveIn + amountIn);
  const marketPrice = reserveOut / reserveIn;
  const executionPrice = amountOut / amountIn;
  
  const priceImpact = Math.abs((marketPrice - executionPrice) / marketPrice) * 100;
  
  return priceImpact;
};

// Toast notification types
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'pending';
  title: string;
  message: string;
  duration?: number;
}

export const createToast = (type: ToastMessage['type'], title: string, message: string): ToastMessage => ({
  id: Math.random().toString(36).substr(2, 9),
  type,
  title,
  message,
  duration: type === 'pending' ? 0 : 5000,
});
