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

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/v2/api';
const ETHEREUM_CHAIN_ID = '1';

export class EtherscanService {
  private apiKey: string;

  constructor() {
    if (!ETHERSCAN_API_KEY) {
      throw new Error('ETHERSCAN_API_KEY is not configured');
    }
    this.apiKey = ETHERSCAN_API_KEY;
  }

  async getEthBalance(address: string): Promise<string> {
    try {
      const url = `${ETHERSCAN_BASE_URL}?chainid=${ETHEREUM_CHAIN_ID}&module=account&action=balance&address=${address}&tag=latest&apikey=${this.apiKey}`;
      console.log(`[Etherscan] Fetching ETH balance for ${address}`);
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
        const balanceInEth = (parseFloat(data.result) / 1e18).toString();
        console.log(`[Etherscan] ETH Balance: ${balanceInEth}`);
        return balanceInEth;
      }
      return '0';
    } catch (error) {
      console.error('Error fetching ETH balance:', error);
      throw error;
    }
  }

  async getTokenBalances(address: string): Promise<TokenInfo[]> {
    try {
      const url = `${ETHERSCAN_BASE_URL}?chainid=${ETHEREUM_CHAIN_ID}&module=account&action=tokenlist&address=${address}&apikey=${this.apiKey}`;
      console.log(`[Etherscan] Fetching token list for ${address}`);
      const response = await fetch(url);
      const data: EtherscanTokenListResponse = await response.json();
      console.log(`[Etherscan] Token list response status: ${data.status}, result count: ${Array.isArray(data.result) ? data.result.length : 0}`);

      if (data.status !== '1' || !Array.isArray(data.result)) {
        console.log(`[Etherscan] No tokens found or API error: ${data.message}`);
        return [];
      }

      const tokens: TokenInfo[] = [];
      
      for (const token of data.result) {
        const balance = BigInt(token.TokenQuantity || '0');
        
        if (balance > BigInt(0)) {
          const decimals = parseInt(token.TokenDivisor || '18');
          
          // Calculate 10^decimals using multiplication to avoid BigInt ** operator
          let divisor = BigInt(1);
          for (let i = 0; i < decimals; i++) {
            divisor *= BigInt(10);
          }
          
          const wholePart = balance / divisor;
          const remainder = balance % divisor;
          
          const balanceStr = remainder > BigInt(0)
            ? `${wholePart}.${remainder.toString().padStart(decimals, '0').replace(/0+$/, '')}`
            : wholePart.toString();
          
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
    } catch (error) {
      console.error('Error fetching token balances:', error);
      return [];
    }
  }

  async getTransactions(address: string, limit: number = 100): Promise<EtherscanTransaction[]> {
    try {
      const url = `${ETHERSCAN_BASE_URL}?chainid=${ETHEREUM_CHAIN_ID}&module=account&action=txlist&address=${address}&startblock=0&endblock=999999999&page=1&offset=${limit}&sort=desc&apikey=${this.apiKey}`;
      console.log(`[Etherscan] Fetching transactions for ${address}`);
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

  async getWalletData(address: string): Promise<WalletData> {
    const warnings: string[] = [];
    
    const results = await Promise.allSettled([
      this.getEthBalance(address),
      this.getTokenBalances(address),
      this.getTransactions(address, 50)
    ]);

    const ethBalance = results[0].status === 'fulfilled' 
      ? results[0].value 
      : (() => {
          warnings.push(`Failed to fetch ETH balance: ${results[0].reason?.message || 'Unknown error'}`);
          return '0';
        })();

    const tokens = results[1].status === 'fulfilled' 
      ? results[1].value 
      : (() => {
          warnings.push(`Failed to fetch token balances: ${results[1].reason?.message || 'Unknown error'}`);
          return [];
        })();

    const transactions = results[2].status === 'fulfilled' 
      ? results[2].value 
      : (() => {
          warnings.push(`Failed to fetch transactions: ${results[2].reason?.message || 'Unknown error'}`);
          return [];
        })();

    return {
      ethBalance,
      tokens,
      transactions,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

export const etherscanService = new EtherscanService();
