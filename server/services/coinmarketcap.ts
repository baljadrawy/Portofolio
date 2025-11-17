interface CMCQuoteResponse {
  data: {
    [symbol: string]: {
      quote: {
        USD: {
          price: number;
          percent_change_24h: number;
          percent_change_7d: number;
          market_cap: number;
          volume_24h: number;
        };
      };
    };
  };
}

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
}

export class CoinMarketCapService {
  private apiKey: string;
  private baseUrl = 'https://pro-api.coinmarketcap.com/v1';

  constructor() {
    const key = process.env.COINMARKETCAP_API_KEY;
    if (!key) {
      throw new Error('COINMARKETCAP_API_KEY is not configured');
    }
    this.apiKey = key;
  }

  async getPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    if (symbols.length === 0) {
      return new Map();
    }

    const uniqueSymbols = Array.from(new Set(symbols));
    const symbolsParam = uniqueSymbols.join(',');

    try {
      const response = await fetch(
        `${this.baseUrl}/cryptocurrency/quotes/latest?symbol=${symbolsParam}`,
        {
          headers: {
            'X-CMC_PRO_API_KEY': this.apiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`CoinMarketCap API error: ${response.status} - ${errorText}`);
        throw new Error(`CoinMarketCap API error: ${response.status}`);
      }

      const data: CMCQuoteResponse = await response.json();
      const priceMap = new Map<string, PriceData>();

      for (const symbol of uniqueSymbols) {
        const coinData = data.data[symbol];
        if (coinData && coinData.quote && coinData.quote.USD) {
          const usdQuote = coinData.quote.USD;
          priceMap.set(symbol, {
            symbol,
            price: usdQuote.price,
            change24h: usdQuote.percent_change_24h,
            change7d: usdQuote.percent_change_7d,
            marketCap: usdQuote.market_cap,
            volume24h: usdQuote.volume_24h,
          });
        }
      }

      return priceMap;
    } catch (error) {
      console.error('Error fetching prices from CoinMarketCap:', error);
      throw error;
    }
  }

  async getPrice(symbol: string): Promise<PriceData | null> {
    const prices = await this.getPrices([symbol]);
    return prices.get(symbol) || null;
  }
}
