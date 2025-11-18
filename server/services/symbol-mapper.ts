export class SymbolMapper {
  // Known scam token patterns (symbol + name combinations)
  private static scamTokens = new Set([
    'GME', // GameStop meme token scams
    'COC', // CorgiCash and similar scam airdrops
    'NC', // Node scams
    'DEBANK', // DeBank badge scams
    'NODEPAY', // NodePay scams
  ]);

  private static symbolMap: Map<string, string> = new Map([
    // Wrapped tokens - map to native tokens
    ['WETH', 'ETH'],
    ['WBTC', 'BTC'],
    ['WMATIC', 'POL'],  // Polygon rebranded from MATIC to POL
    ['WAVAX', 'AVAX'],
    ['WBNB', 'BNB'],
    ['WFTM', 'FTM'],
    ['WGLMR', 'GLMR'],
    ['WMOVR', 'MOVR'],
    ['WCELO', 'CELO'],
    ['WXDAI', 'DAI'],
    
    // Wrapped ETH variants
    ['WETH.E', 'ETH'],
    ['WETH.B', 'ETH'],
    ['WETHAVAX', 'ETH'],
    
    // Stablecoins - map all variants to primary symbol
    ['USDT', 'USDT'],
    ['USDC', 'USDC'],
    ['USDC.E', 'USDC'],
    ['USDCE', 'USDC'],
    ['DAI', 'DAI'],
    ['BUSD', 'BUSD'],
    ['TUSD', 'TUSD'],
    ['UST', 'UST'],
    
    // Bridged tokens and rebrands
    ['MATIC', 'POL'],  // Polygon rebranded from MATIC to POL
    ['POL', 'POL'],
    ['AVAX', 'AVAX'],
    ['FTM', 'FTM'],
    ['GLMR', 'GLMR'],
    ['MOVR', 'MOVR'],
    
    // Common alternative names
    ['BNB', 'BNB'],
    ['BSC', 'BNB'],
  ]);

  static mapSymbol(symbol: string): string {
    const normalized = symbol.trim().toUpperCase();
    return this.symbolMap.get(normalized) || normalized;
  }

  static isValidSymbol(symbol: string, name?: string): boolean {
    if (!symbol || symbol.length === 0) return false;
    
    const normalized = symbol.trim().toUpperCase();
    
    // Check against known scam tokens
    if (this.scamTokens.has(normalized)) {
      return false;
    }
    
    // Filter out obvious scam/spam tokens by symbol
    const scamPatterns = [
      /HTTP[S]?:\/\//i,       // Contains URLs
      /WWW\./i,               // Contains www.
      /\.COM/i,               // Contains .com
      /\.IO/i,                // Contains .io
      /\.NET/i,               // Contains .net
      /\.VIP/i,               // Contains .vip
      /\.XYZ/i,               // Contains .xyz
      /\.TOP/i,               // Contains .top
      /\.PRO/i,               // Contains .pro
      /\.ME/i,                // Contains .me
      /\.ORG/i,               // Contains .org
      /\.INFO/i,              // Contains .info
      /\.ONLINE/i,            // Contains .online
      /CLAIM/i,               // Claim airdrop scams
      /AIRDROP/i,             // Airdrop scams
      /REWARD/i,              // Reward scams
      /VISIT/i,               // Visit website scams
      /ADS:/i,                // Advertisement tokens
      /\$USDT.*CLAIM/i,       // USDT claim scams
      /&GT;/i,                // HTML entities
      /&LT;/i,
      /\[WWW\./i,             // URLs in brackets
      /SWAP FOR \$/i,         // Swap scams
      /LOOT-/i,               // Loot scams
      /GET-/i,                // Get scams
      /REDEEM/i,              // Redeem scams
      /VERIFY/i,              // Verify scams
      /ELIGIBLE/i,            // Eligible scams
      /T\.LY\//i,             // URL shorteners
      /BIT\.LY/i,             // URL shorteners
      /GETDROPS/i,            // GetDrops scam site
      /THECHILIZ/i,           // TheChiliz scam
      /GIFT TOKEN/i,          // Gift token scams
      /BADGE/i,               // Badge scams
      /\u200B/,               // Zero-width characters
      /[\u0600-\u06FF]/,      // Arabic characters (uncommon in legit tokens)
      /[\u4E00-\u9FFF]/,      // Chinese characters (uncommon in legit tokens)
    ];
    
    for (const pattern of scamPatterns) {
      if (pattern.test(symbol) || pattern.test(normalized)) {
        return false;
      }
      // Also check name if provided
      if (name && pattern.test(name)) {
        return false;
      }
    }
    
    // Must be reasonable length
    if (normalized.length > 20) return false;
    
    // Must contain mostly alphanumeric characters
    const validChars = /^[A-Z0-9._-]+$/;
    if (!validChars.test(normalized)) return false;
    
    return true;
  }

  static cleanAndMapSymbol(symbol: string, name?: string): string | null {
    if (!this.isValidSymbol(symbol, name)) {
      return null;
    }
    return this.mapSymbol(symbol);
  }
}
