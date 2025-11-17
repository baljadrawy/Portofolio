export class SymbolMapper {
  private static symbolMap: Map<string, string> = new Map([
    // Wrapped tokens - map to native tokens
    ['WETH', 'ETH'],
    ['WBTC', 'BTC'],
    ['WMATIC', 'MATIC'],
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
    
    // Bridged tokens
    ['MATIC', 'MATIC'],
    ['POL', 'MATIC'],
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

  static isValidSymbol(symbol: string): boolean {
    if (!symbol || symbol.length === 0) return false;
    
    const normalized = symbol.trim().toUpperCase();
    
    // Filter out obvious scam/spam tokens
    const scamPatterns = [
      /HTTP[S]?:\/\//i,       // Contains URLs
      /WWW\./i,               // Contains www.
      /\.COM/i,               // Contains .com
      /\.IO/i,                // Contains .io
      /\.NET/i,               // Contains .net
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
      /\u200B/,               // Zero-width characters
      /[\u0600-\u06FF]/,      // Arabic characters (uncommon in legit tokens)
      /[\u4E00-\u9FFF]/,      // Chinese characters (uncommon in legit tokens)
    ];
    
    for (const pattern of scamPatterns) {
      if (pattern.test(symbol) || pattern.test(normalized)) {
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

  static cleanAndMapSymbol(symbol: string): string | null {
    if (!this.isValidSymbol(symbol)) {
      return null;
    }
    return this.mapSymbol(symbol);
  }
}
