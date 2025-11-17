import type { Express } from "express";
import { storage } from "../storage";
import { CoinMarketCapService, PriceData } from "../services/coinmarketcap";
import { CoinGeckoService } from "../services/coingecko";
import { SymbolMapper } from "../services/symbol-mapper";

const cmcService = new CoinMarketCapService();
const cgService = new CoinGeckoService();

export function registerPriceRoutes(app: Express) {
  app.post("/api/prices/update", async (_req, res) => {
    try {
      console.log('[Prices] Starting price update');
      const holdings = await storage.getAllHoldings();
      console.log(`[Prices] Found ${holdings.length} holdings`);
      
      if (holdings.length === 0) {
        return res.json({ 
          message: "No holdings to update",
          updated: 0 
        });
      }

      // Clean and map symbols
      const symbolSet = new Set<string>();
      const originalToMappedSymbol = new Map<string, string>();
      const scamTokens: string[] = [];
      
      for (const holding of holdings) {
        const originalSymbol = holding.symbol;
        const cleanedSymbol = SymbolMapper.cleanAndMapSymbol(originalSymbol);
        
        if (!cleanedSymbol) {
          scamTokens.push(originalSymbol);
          continue;
        }
        
        symbolSet.add(cleanedSymbol);
        originalToMappedSymbol.set(originalSymbol, cleanedSymbol);
      }
      
      if (scamTokens.length > 0) {
        console.log(`[Prices] Filtered out ${scamTokens.length} scam/spam tokens:`, scamTokens.slice(0, 5).join(', '), scamTokens.length > 5 ? '...' : '');
      }
      
      const symbols = Array.from(symbolSet);
      console.log(`[Prices] Fetching prices for ${symbols.length} unique clean symbols`);
      
      // Try CoinMarketCap first
      let priceMap = new Map<string, PriceData>();
      try {
        priceMap = await cmcService.getPrices(symbols);
        console.log(`[Prices] CoinMarketCap returned ${priceMap.size} prices`);
      } catch (error: any) {
        console.warn('[Prices] CoinMarketCap failed, will try CoinGecko:', error?.message);
      }
      
      // For symbols not found in CoinMarketCap, try CoinGecko
      const missingSymbols = symbols.filter(s => !priceMap.has(s));
      if (missingSymbols.length > 0) {
        console.log(`[Prices] Trying CoinGecko for ${missingSymbols.length} missing symbols`);
        try {
          const cgPrices = await cgService.getPrices(missingSymbols);
          console.log(`[Prices] CoinGecko returned ${cgPrices.size} additional prices`);
          
          // Merge CoinGecko prices into main price map
          const cgPricesArray = Array.from(cgPrices.entries());
          for (const [symbol, priceData] of cgPricesArray) {
            priceMap.set(symbol, priceData);
          }
        } catch (error: any) {
          console.warn('[Prices] CoinGecko also failed:', error?.message);
        }
      }
      
      console.log(`[Prices] Total prices fetched: ${priceMap.size} out of ${symbols.length} symbols`);
      
      // Update holdings with prices (using mapped symbols)
      const updates: Array<{ id: string; price: number }> = [];
      
      for (const holding of holdings) {
        const mappedSymbol = originalToMappedSymbol.get(holding.symbol);
        if (!mappedSymbol) continue; // Skip scam tokens
        
        const priceData = priceMap.get(mappedSymbol);
        if (priceData) {
          updates.push({
            id: holding.id,
            price: priceData.price
          });
        }
      }

      if (updates.length > 0) {
        await storage.updateHoldingsPrices(updates);
        console.log(`[Prices] Updated ${updates.length} holdings with current prices`);
      } else {
        console.log('[Prices] No price updates available');
      }

      // Calculate total portfolio value
      const updatedHoldings = await storage.getAllHoldings();
      
      let totalValue = 0;
      let totalChange24h = 0;

      for (const holding of updatedHoldings) {
        const mappedSymbol = originalToMappedSymbol.get(holding.symbol);
        const priceData = mappedSymbol ? priceMap.get(mappedSymbol) : undefined;
        
        const currentPrice = holding.currentPrice 
          ? (typeof holding.currentPrice === 'string' ? parseFloat(holding.currentPrice) : holding.currentPrice)
          : (priceData?.price || 0);
        
        if (holding.amount && currentPrice > 0) {
          const amount = typeof holding.amount === 'string' ? parseFloat(holding.amount) : holding.amount;
          const value = amount * currentPrice;
          totalValue += value;
          
          if (priceData && priceData.change24h) {
            const change = (priceData.change24h / 100) * value;
            totalChange24h += change;
          }
        }
      }

      // Log missing prices (excluding scam tokens)
      const missingPrices = updatedHoldings.filter(h => {
        const mappedSymbol = originalToMappedSymbol.get(h.symbol);
        if (!mappedSymbol) return false; // Skip scam tokens
        
        const hasPrice = priceMap.has(mappedSymbol);
        return !hasPrice && parseFloat(h.amount) > 0;
      });

      if (missingPrices.length > 0) {
        console.log(`[Prices] Warning: ${missingPrices.length} legitimate holdings still missing price data:`, 
          missingPrices.slice(0, 10).map(h => h.symbol).join(', '),
          missingPrices.length > 10 ? '...' : '');
      }

      // Create portfolio snapshot
      if (totalValue > 0) {
        await storage.createPortfolioSnapshot({
          totalValue: totalValue.toString(),
          totalChange24h: totalChange24h.toString()
        });
      }

      const priceArray = Array.from(priceMap.values());
      
      res.json({
        message: "Prices updated successfully",
        updated: updates.length,
        totalValue,
        totalChange24h,
        scamTokensFiltered: scamTokens.length,
        sources: {
          coinmarketcap: priceArray.filter(p => p.source === 'coinmarketcap').length,
          coingecko: priceArray.filter(p => p.source === 'coingecko').length,
        }
      });
      
    } catch (error: any) {
      console.error('[Prices] Error updating prices:', error);
      res.status(500).json({ 
        error: "Failed to update prices",
        details: error?.message 
      });
    }
  });

  app.get("/api/prices/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      
      // Clean and map the symbol
      const cleanedSymbol = SymbolMapper.cleanAndMapSymbol(symbol);
      
      if (!cleanedSymbol) {
        return res.status(400).json({ error: "Invalid or scam token symbol" });
      }
      
      // Try CoinMarketCap first
      let priceData = await cmcService.getPrice(cleanedSymbol);
      
      // Fallback to CoinGecko if not found
      if (!priceData) {
        priceData = await cgService.getPrice(cleanedSymbol);
      }
      
      if (!priceData) {
        return res.status(404).json({ error: "Price not found for symbol" });
      }

      res.json(priceData);
    } catch (error: any) {
      console.error(`[Prices] Error fetching price for ${req.params.symbol}:`, error);
      res.status(500).json({ 
        error: "Failed to fetch price",
        details: error?.message 
      });
    }
  });

  app.get("/api/portfolio/history", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      const snapshots = await storage.getPortfolioSnapshots(limit);
      
      res.json(snapshots);
    } catch (error: any) {
      console.error('[Portfolio] Error fetching history:', error);
      res.status(500).json({ 
        error: "Failed to fetch portfolio history",
        details: error?.message 
      });
    }
  });
}
