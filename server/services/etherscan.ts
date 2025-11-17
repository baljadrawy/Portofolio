interface EtherscanBalanceResponse {
  status: string;
  message: string;
  result: string;
}

interface EtherscanTokenBalance {
  TokenAddress: string;
  TokenName: string;
  TokenSymbol: string;
  TokenQuantity: string;
  TokenDivisor: string;
}

interface EtherscanTokenListResponse {
  status: string;
  message: string;
  result: EtherscanTokenBalance[];
}

interface EtherscanTransaction {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
}

interface EtherscanTxListResponse {
  status: string;
  message: string;
  result: EtherscanTransaction[];
}

interface TokenInfo {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
}

interface WalletData {
  ethBalance: string;
  tokens: TokenInfo[];
  transactions: EtherscanTransaction[];
  warnings?: string[];
}

import { SUPPORTED_CHAINS, CHAIN_NAMES, NATIVE_TOKENS } from "@shared/networks";

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/v2/api';

export { SUPPORTED_CHAINS, CHAIN_NAMES, NATIVE_TOKENS };

export class EtherscanService {
  private apiKey: string;

  constructor() {
    if (!ETHERSCAN_API_KEY) {
      throw new Error('ETHERSCAN_API_KEY is not configured');
    }
    this.apiKey = ETHERSCAN_API_KEY;
  }

  async getNativeBalance(address: string, chainId: number = SUPPORTED_CHAINS.ETHEREUM): Promise<string> {
    try {
      const url = `${ETHERSCAN_BASE_URL}?chainid=${chainId}&module=account&action=balance&address=${address}&tag=latest&apikey=${this.apiKey}`;
      const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
      console.log(`[Etherscan] Fetching native balance for ${address} on ${chainName}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Etherscan API error: ${response.status} ${response.statusText}`);
      }
      
      const data: EtherscanBalanceResponse = await response.json();
      console.log(`[Etherscan] Balance response:`, data);

      if (data.status === '0') {
        throw new Error(`Etherscan error: ${data.message}`);
      }

      if (data.status === '1') {
        const balanceInNative = (parseFloat(data.result) / 1e18).toString();
        const nativeSymbol = NATIVE_TOKENS[chainId]?.symbol || 'NATIVE';
        console.log(`[Etherscan] ${nativeSymbol} Balance: ${balanceInNative}`);
        return balanceInNative;
      }
      return '0';
    } catch (error) {
      console.error('Error fetching native balance:', error);
      throw error;
    }
  }

  async getTokenBalances(address: string, chainId: number = SUPPORTED_CHAINS.ETHEREUM): Promise<TokenInfo[]> {
    try {
      const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
      const url = `${ETHERSCAN_BASE_URL}?chainid=${chainId}&module=account&action=addresstokenbalance&address=${address}&page=1&offset=10000&apikey=${this.apiKey}`;
      console.log(`[Etherscan] Fetching token balances for ${address} on ${chainName}`);
      const response = await fetch(url);
      const data: EtherscanTokenListResponse = await response.json();
      console.log(`[Etherscan] Token balance response status: ${data.status}, message: ${data.message}, result count: ${Array.isArray(data.result) ? data.result.length : 0}`);

      if (data.status === '1' && Array.isArray(data.result) && data.result.length > 0) {
        const tokens: TokenInfo[] = [];
        
        for (const token of data.result) {
          const balance = BigInt(token.TokenQuantity || '0');
          
          if (balance > BigInt(0)) {
            const decimals = parseInt(token.TokenDivisor || '18');
            
            let divisor = BigInt(1);
            for (let i = 0; i < decimals; i++) {
              divisor *= BigInt(10);
            }
            
            const wholePart = balance / divisor;
            const remainder = balance % divisor;
            
            let balanceStr: string;
            if (remainder > BigInt(0)) {
              const decimalPart = remainder.toString().padStart(decimals, '0');
              const trimmedDecimal = decimalPart.substring(0, 8).replace(/0+$/, '');
              balanceStr = trimmedDecimal ? `${wholePart}.${trimmedDecimal}` : wholePart.toString();
            } else {
              balanceStr = wholePart.toString();
            }
            
            tokens.push({
              symbol: token.TokenSymbol || 'UNKNOWN',
              name: token.TokenName || 'Unknown Token',
              balance: balanceStr,
              decimals: decimals
            });
            
            console.log(`[Etherscan] Found token: ${token.TokenSymbol} - Balance: ${balanceStr}`);
          }
        }

        console.log(`[Etherscan] Total tokens with balance: ${tokens.length}`);
        return tokens;
      }

      console.log(`[Etherscan] addresstokenbalance failed, falling back to tokentx method`);
      return await this.getTokenBalancesFromTransactions(address, chainId);
    } catch (error) {
      console.error('Error fetching token balances:', error);
      return [];
    }
  }

  private async getTokenBalancesFromTransactions(address: string, chainId: number): Promise<TokenInfo[]> {
    try {
      const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
      // Fetch ALL token transactions (using high offset to get maximum results)
      const url = `${ETHERSCAN_BASE_URL}?chainid=${chainId}&module=account&action=tokentx&address=${address}&startblock=0&endblock=999999999&page=1&offset=10000&sort=desc&apikey=${this.apiKey}`;
      console.log(`[Etherscan] Fetching token transactions for ${address} on ${chainName} (fallback method)`);
      const response = await fetch(url);
      const data: EtherscanTxListResponse = await response.json();
      console.log(`[Etherscan] Token TX response status: ${data.status}, result count: ${Array.isArray(data.result) ? data.result.length : 0}`);

      if (data.status !== '1' || !Array.isArray(data.result)) {
        console.log(`[Etherscan] No token transactions found`);
        return [];
      }

      const tokenMap = new Map<string, { symbol: string; name: string; decimals: number; balance: bigint }>();

      for (const tx of data.result) {
        const tokenAddress = (tx as any).contractAddress?.toLowerCase();
        const tokenSymbol = (tx as any).tokenSymbol || 'UNKNOWN';
        const tokenName = (tx as any).tokenName || 'Unknown Token';
        const tokenDecimal = parseInt((tx as any).tokenDecimal || '18');
        const value = BigInt((tx as any).value || '0');
        const from = tx.from.toLowerCase();
        const to = tx.to.toLowerCase();
        const userAddress = address.toLowerCase();

        if (!tokenAddress) continue;

        if (!tokenMap.has(tokenAddress)) {
          tokenMap.set(tokenAddress, {
            symbol: tokenSymbol,
            name: tokenName,
            decimals: tokenDecimal,
            balance: BigInt(0)
          });
        }

        const tokenData = tokenMap.get(tokenAddress)!;

        if (to === userAddress) {
          tokenData.balance += value;
        }
        if (from === userAddress) {
          tokenData.balance -= value;
        }
      }

      const tokens: TokenInfo[] = [];
      tokenMap.forEach((tokenData) => {
        if (tokenData.balance > BigInt(0)) {
          // Calculate 10^decimals using multiplication to avoid BigInt ** operator
          let divisor = BigInt(1);
          for (let i = 0; i < tokenData.decimals; i++) {
            divisor *= BigInt(10);
          }
          
          const wholePart = tokenData.balance / divisor;
          const remainder = tokenData.balance % divisor;
          
          let balanceStr: string;
          if (remainder > BigInt(0)) {
            const decimalPart = remainder.toString().padStart(tokenData.decimals, '0');
            const trimmedDecimal = decimalPart.substring(0, 8).replace(/0+$/, '');
            balanceStr = trimmedDecimal ? `${wholePart}.${trimmedDecimal}` : wholePart.toString();
          } else {
            balanceStr = wholePart.toString();
          }
          
          tokens.push({
            symbol: tokenData.symbol,
            name: tokenData.name,
            balance: balanceStr,
            decimals: tokenData.decimals
          });
          
          console.log(`[Etherscan] Calculated token from TX: ${tokenData.symbol} - Balance: ${balanceStr}`);
        }
      });

      console.log(`[Etherscan] Total tokens calculated from transactions: ${tokens.length}`);
      return tokens;
    } catch (error) {
      console.error('Error calculating token balances from transactions:', error);
      return [];
    }
  }

  async getTransactions(address: string, chainId: number = SUPPORTED_CHAINS.ETHEREUM, limit: number = 100, startBlock: number = 0): Promise<EtherscanTransaction[]> {
    try {
      const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
      const url = `${ETHERSCAN_BASE_URL}?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=999999999&page=1&offset=${limit}&sort=desc&apikey=${this.apiKey}`;
      console.log(`[Etherscan] Fetching transactions for ${address} on ${chainName} from block ${startBlock}`);
      const response = await fetch(url);
      const data: EtherscanTxListResponse = await response.json();
      console.log(`[Etherscan] Transactions response status: ${data.status}, result count: ${Array.isArray(data.result) ? data.result.length : 0}`);

      if (data.status === '1' && Array.isArray(data.result)) {
        return data.result;
      }
      return [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  }

  async getWalletData(address: string, chainId: number = SUPPORTED_CHAINS.ETHEREUM): Promise<WalletData> {
    const warnings: string[] = [];
    const nativeToken = NATIVE_TOKENS[chainId] || { symbol: 'NATIVE', name: 'Native Token' };
    const DELAY_BETWEEN_CALLS = 250; // 250ms delay between API calls to respect rate limits
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    let ethBalance = '0';
    try {
      ethBalance = await this.getNativeBalance(address, chainId);
    } catch (error: any) {
      warnings.push(`Failed to fetch ${nativeToken.symbol} balance: ${error?.message || 'Unknown error'}`);
    }
    
    await delay(DELAY_BETWEEN_CALLS);
    
    let tokens: TokenInfo[] = [];
    try {
      tokens = await this.getTokenBalances(address, chainId);
    } catch (error: any) {
      warnings.push(`Failed to fetch token balances: ${error?.message || 'Unknown error'}`);
    }
    
    await delay(DELAY_BETWEEN_CALLS);
    
    let transactions: EtherscanTransaction[] = [];
    try {
      transactions = await this.getTransactions(address, chainId, 50);
    } catch (error: any) {
      warnings.push(`Failed to fetch transactions: ${error?.message || 'Unknown error'}`);
    }

    return {
      ethBalance,
      tokens,
      transactions,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  async getWalletDataIncremental(
    address: string, 
    chainId: number, 
    lastBlockScanned?: number | null, 
    lastTokenScan?: Date | null
  ): Promise<WalletData & { highestBlock?: number; shouldUpdateTokens: boolean }> {
    const warnings: string[] = [];
    const nativeToken = NATIVE_TOKENS[chainId] || { symbol: 'NATIVE', name: 'Native Token' };
    const DELAY_BETWEEN_CALLS = 250;
    const TOKEN_SCAN_INTERVAL_HOURS = 24;
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    let ethBalance = '0';
    try {
      ethBalance = await this.getNativeBalance(address, chainId);
    } catch (error: any) {
      warnings.push(`Failed to fetch ${nativeToken.symbol} balance: ${error?.message || 'Unknown error'}`);
    }
    
    await delay(DELAY_BETWEEN_CALLS);
    
    const shouldScanTokens = !lastTokenScan || 
      (Date.now() - new Date(lastTokenScan).getTime()) > TOKEN_SCAN_INTERVAL_HOURS * 60 * 60 * 1000;
    
    let tokens: TokenInfo[] = [];
    if (shouldScanTokens) {
      console.log('[Etherscan] Token scan needed (>24h since last scan or first time)');
      try {
        tokens = await this.getTokenBalances(address, chainId);
      } catch (error: any) {
        warnings.push(`Failed to fetch token balances: ${error?.message || 'Unknown error'}`);
      }
      await delay(DELAY_BETWEEN_CALLS);
    } else {
      console.log('[Etherscan] Skipping token scan (scanned within last 24h)');
    }
    
    const startBlock = lastBlockScanned ? lastBlockScanned + 1 : 0;
    console.log(`[Etherscan] Fetching transactions from block ${startBlock} (incremental: ${lastBlockScanned ? 'yes' : 'no'})`);
    
    let transactions: EtherscanTransaction[] = [];
    let highestBlock: number;
    
    try {
      transactions = await this.getTransactions(address, chainId, 1000, startBlock);
      
      if (transactions.length > 0) {
        const blocks = transactions.map(tx => parseInt(tx.blockNumber)).filter(b => !isNaN(b));
        if (blocks.length > 0) {
          highestBlock = Math.max(...blocks);
          console.log(`[Etherscan] Highest block in new transactions: ${highestBlock}`);
        } else {
          highestBlock = lastBlockScanned || 0;
        }
      } else {
        highestBlock = lastBlockScanned || 0;
        console.log('[Etherscan] No new transactions, keeping lastBlockScanned unchanged');
      }
    } catch (error: any) {
      warnings.push(`Failed to fetch transactions: ${error?.message || 'Unknown error'}`);
      highestBlock = lastBlockScanned || 0;
    }

    return {
      ethBalance,
      tokens,
      transactions,
      warnings: warnings.length > 0 ? warnings : undefined,
      highestBlock,
      shouldUpdateTokens: shouldScanTokens
    };
  }
}

export const etherscanService = new EtherscanService();
