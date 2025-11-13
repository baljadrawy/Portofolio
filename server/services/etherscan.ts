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
      const data: EtherscanBalanceResponse = await response.json();

      if (data.status === '1') {
        const balanceInEth = (parseFloat(data.result) / 1e18).toString();
        return balanceInEth;
      }
      return '0';
    } catch (error) {
      console.error('Error fetching ETH balance:', error);
      return '0';
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
          const balanceStr = (Number(tokenData.balance) / Math.pow(10, tokenData.decimals)).toString();
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
    const [ethBalance, tokens, transactions] = await Promise.all([
      this.getEthBalance(address),
      this.getTokenBalances(address),
      this.getTransactions(address, 50)
    ]);

    return {
      ethBalance,
      tokens,
      transactions
    };
  }
}

export const etherscanService = new EtherscanService();
