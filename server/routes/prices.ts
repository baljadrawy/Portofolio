import type { Express } from "express";
import { storage } from "../storage";
import { CoinMarketCapService } from "../services/coinmarketcap";

const cmcService = new CoinMarketCapService();

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

      const symbols = Array.from(new Set(holdings.map(h => h.symbol)));
      console.log(`[Prices] Fetching prices for ${symbols.length} unique symbols:`, symbols);
      
      const priceMap = await cmcService.getPrices(symbols);
      console.log(`[Prices] Received ${priceMap.size} prices from CoinMarketCap`);
      
      const updates: Array<{ id: string; price: number }> = [];
      
      for (const holding of holdings) {
        const priceData = priceMap.get(holding.symbol);
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

      const updatedHoldings = await storage.getAllHoldings();
      
      let totalValue = 0;
      let totalChange24h = 0;

      for (const holding of updatedHoldings) {
        const priceData = priceMap.get(holding.symbol);
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

      const missingPrices = updatedHoldings.filter(h => {
        const hasPrice = priceMap.has(h.symbol);
        return !hasPrice && parseFloat(h.amount) > 0;
      });

      if (missingPrices.length > 0) {
        console.log(`[Prices] Warning: ${missingPrices.length} holdings missing price data:`, 
          missingPrices.map(h => h.symbol).join(', '));
      }

      if (totalValue > 0) {
        await storage.createPortfolioSnapshot({
          totalValue: totalValue.toString(),
          totalChange24h: totalChange24h.toString()
        });
      }

      res.json({
        message: "Prices updated successfully",
        updated: updates.length,
        totalValue,
        totalChange24h
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
      const priceData = await cmcService.getPrice(symbol);
      
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
