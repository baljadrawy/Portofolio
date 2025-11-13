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
const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/api';

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
      const url = `${ETHERSCAN_BASE_URL}?module=account&action=balance&address=${address}&tag=latest&apikey=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Etherscan API error: ${response.status} ${response.statusText}`);
      }
      
      const data: EtherscanBalanceResponse = await response.json();

      if (data.status === '0') {
        throw new Error(`Etherscan error: ${data.message}`);
      }

      if (data.status === '1') {
        const balanceInEth = (parseFloat(data.result) / 1e18).toString();
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
      const url = `${ETHERSCAN_BASE_URL}?module=account&action=tokentx&address=${address}&startblock=0&endblock=999999999&sort=desc&apikey=${this.apiKey}`;
      const response = await fetch(url);
      const data: EtherscanTxListResponse = await response.json();

      if (data.status !== '1' || !Array.isArray(data.result)) {
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
          
          const balanceStr = remainder > BigInt(0)
            ? `${wholePart}.${remainder.toString().padStart(tokenData.decimals, '0').replace(/0+$/, '')}`
            : wholePart.toString();
          
          tokens.push({
            symbol: tokenData.symbol,
            name: tokenData.name,
            balance: balanceStr,
            decimals: tokenData.decimals
          });
        }
      });

      return tokens;
    } catch (error) {
      console.error('Error fetching token balances:', error);
      return [];
    }
  }

  async getTransactions(address: string, limit: number = 100): Promise<EtherscanTransaction[]> {
    try {
      const url = `${ETHERSCAN_BASE_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=999999999&page=1&offset=${limit}&sort=desc&apikey=${this.apiKey}`;
      const response = await fetch(url);
      const data: EtherscanTxListResponse = await response.json();

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
