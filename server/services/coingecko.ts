interface CoinGeckoPrice {
  usd: number;
  usd_24h_change?: number;
  usd_market_cap?: number;
  usd_24h_vol?: number;
}

interface CoinGeckoPriceResponse {
  [coinId: string]: CoinGeckoPrice;
}

export interface PriceData {
  symbol: string;
  price: number;
  change24h?: number;
  marketCap?: number;
  volume24h?: number;
  source: 'coingecko' | 'coinmarketcap';
}

export class CoinGeckoService {
  private baseUrl = 'https://api.coingecko.com/api/v3';
  
  private symbolToCoinIdMap: Map<string, string> = new Map([
    ['BTC', 'bitcoin'],
    ['ETH', 'ethereum'],
    ['USDT', 'tether'],
    ['USDC', 'usd-coin'],
    ['BNB', 'binancecoin'],
    ['MATIC', 'matic-network'],
    ['AVAX', 'avalanche-2'],
    ['FTM', 'fantom'],
    ['DAI', 'dai'],
    ['LINK', 'chainlink'],
    ['UNI', 'uniswap'],
    ['AAVE', 'aave'],
    ['CRV', 'curve-dao-token'],
    ['SNX', 'synthetix-network-token'],
    ['SUSHI', 'sushi'],
    ['COMP', 'compound-governance-token'],
    ['MKR', 'maker'],
    ['YFI', 'yearn-finance'],
    ['SOL', 'solana'],
    ['DOT', 'polkadot'],
    ['ADA', 'cardano'],
    ['XRP', 'ripple'],
    ['DOGE', 'dogecoin'],
    ['SHIB', 'shiba-inu'],
    ['WETH', 'ethereum'],
    ['WBTC', 'wrapped-bitcoin'],
    ['WMATIC', 'matic-network'],
    ['WAVAX', 'avalanche-2'],
    ['WBNB', 'binancecoin'],
    ['WFTM', 'fantom'],
    ['ARB', 'arbitrum'],
    ['OP', 'optimism'],
    ['PEPE', 'pepe'],
    ['GLMR', 'moonbeam'],
    ['MOVR', 'moonriver'],
    ['CELO', 'celo'],
    ['XDAI', 'xdai'],
    ['GNO', 'gnosis'],
  ]);

  async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    if (symbols.length === 0) {
      return new Map();
    }

    const priceMap = new Map<string, PriceData>();
    
    // Map symbols to CoinGecko IDs
    const symbolToIdMapping = new Map<string, string>();
    const coinIds: string[] = [];
    
    for (const symbol of symbols) {
      const normalizedSymbol = symbol.trim().toUpperCase();
      const coinId = this.symbolToCoinIdMap.get(normalizedSymbol);
      if (coinId) {
        symbolToIdMapping.set(coinId, normalizedSymbol);
        coinIds.push(coinId);
      }
    }

    if (coinIds.length === 0) {
      console.log('[CoinGecko] No mappable symbols found');
      return priceMap;
    }

    const uniqueCoinIds = Array.from(new Set(coinIds));
    console.log(`[CoinGecko] Fetching prices for ${uniqueCoinIds.length} coins`);

    try {
      const idsParam = uniqueCoinIds.join(',');
      const response = await fetch(
        `${this.baseUrl}/simple/price?ids=${idsParam}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`CoinGecko API error: ${response.status} - ${errorText}`);
        
        // CoinGecko free tier has rate limits, return empty instead of throwing
        if (response.status === 429) {
          console.warn('[CoinGecko] Rate limit reached, skipping');
          return priceMap;
        }
        
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data: CoinGeckoPriceResponse = await response.json();

      for (const [coinId, priceInfo] of Object.entries(data)) {
        const symbol = symbolToIdMapping.get(coinId);
        if (symbol && priceInfo.usd) {
          priceMap.set(symbol, {
            symbol,
            price: priceInfo.usd,
            change24h: priceInfo.usd_24h_change,
            marketCap: priceInfo.usd_market_cap,
            volume24h: priceInfo.usd_24h_vol,
            source: 'coingecko',
          });
        }
      }

      console.log(`[CoinGecko] Successfully fetched ${priceMap.size} prices`);
      return priceMap;
    } catch (error) {
      console.error('[CoinGecko] Error fetching prices:', error);
      // Return empty map instead of throwing to allow fallback to other sources
      return new Map();
    }
  }

  async getPrice(symbol: string): Promise<PriceData | null> {
    const prices = await this.getPrices([symbol]);
    return prices.get(symbol.toUpperCase()) || null;
  }
}
