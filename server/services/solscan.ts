const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY;
const SOLSCAN_BASE_URL = 'https://pro-api.solscan.io';

interface TokenAccount {
  token_account: string;
  token_address: string;
  amount: number;
  token_decimals: number;
  owner: string;
}

interface TokenAccountsResponse {
  success: boolean;
  data: TokenAccount[];
}

interface AccountDetail {
  account: string;
  lamports: number;
  type: string;
  executable: boolean;
  owner: string;
  rentEpoch: number;
}

interface AccountDetailResponse {
  success: boolean;
  data: AccountDetail;
}

interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
}

interface TokenMetadataResponse {
  success: boolean;
  data: TokenMetadata;
}

export interface SolanaWalletData {
  address: string;
  solBalance: string;
  tokens: Array<{
    symbol: string;
    name: string;
    balance: string;
    contractAddress: string;
    decimals: number;
  }>;
}

class SolscanService {
  private async makeRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    if (!SOLSCAN_API_KEY) {
      throw new Error('SOLSCAN_API_KEY is not configured');
    }

    const url = new URL(`${SOLSCAN_BASE_URL}${endpoint}`);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key].toString());
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'token': SOLSCAN_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Solscan API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Solscan API returned unsuccessful response');
    }

    return data;
  }

  async getAccountDetail(address: string): Promise<AccountDetailResponse> {
    return this.makeRequest<AccountDetailResponse>('/v2.0/account/detail', { address });
  }

  async getTokenAccounts(address: string): Promise<TokenAccountsResponse> {
    return this.makeRequest<TokenAccountsResponse>('/v2.0/account/token-accounts', {
      address,
      type: 'token',
      hide_zero: true,
      page_size: 40,
    });
  }

  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadataResponse> {
    return this.makeRequest<TokenMetadataResponse>('/v2.0/token/meta', {
      address: tokenAddress,
    });
  }

  async getWalletData(address: string): Promise<SolanaWalletData> {
    try {
      const [accountDetail, tokenAccounts] = await Promise.all([
        this.getAccountDetail(address),
        this.getTokenAccounts(address),
      ]);

      const solBalance = (accountDetail.data.lamports / 1_000_000_000).toFixed(9);

      const tokens = await Promise.all(
        tokenAccounts.data.map(async (token) => {
          try {
            const metadata = await this.getTokenMetadata(token.token_address);
            return {
              symbol: metadata.data.symbol || 'UNKNOWN',
              name: metadata.data.name || 'Unknown Token',
              balance: (token.amount / Math.pow(10, token.token_decimals)).toString(),
              contractAddress: token.token_address,
              decimals: token.token_decimals,
            };
          } catch (error) {
            console.error(`Failed to fetch metadata for token ${token.token_address}:`, error);
            return {
              symbol: 'UNKNOWN',
              name: 'Unknown Token',
              balance: (token.amount / Math.pow(10, token.token_decimals)).toString(),
              contractAddress: token.token_address,
              decimals: token.token_decimals,
            };
          }
        })
      );

      return {
        address,
        solBalance,
        tokens: tokens.filter(t => parseFloat(t.balance) > 0),
      };
    } catch (error) {
      console.error(`Error fetching Solana wallet data for ${address}:`, error);
      throw error;
    }
  }
}

export const solscanService = new SolscanService();
