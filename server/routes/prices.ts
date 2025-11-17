import type { Express } from "express";
import { storage } from "../storage";
import { CoinMarketCapService } from "../services/coinmarketcap";

const cmcService = new CoinMarketCapService();

export function registerPriceRoutes(app: Express) {
  app.post("/api/prices/update", async (_req, res) => {
    try {
      const holdings = await storage.getAllHoldings();
      
      if (holdings.length === 0) {
        return res.json({ 
          message: "No holdings to update",
          updated: 0 
        });
      }

      const symbols = Array.from(new Set(holdings.map(h => h.symbol)));
      
      console.log(`[Prices] Fetching prices for ${symbols.length} unique symbols`);
      
      const priceMap = await cmcService.getPrices(symbols);
      
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

      await storage.updateHoldingsPrices(updates);
      
      console.log(`[Prices] Updated ${updates.length} holdings with current prices`);

      const totalValue = holdings.reduce((sum, holding) => {
        const priceData = priceMap.get(holding.symbol);
        if (priceData) {
          const value = parseFloat(holding.amount) * priceData.price;
          return sum + value;
        }
        return sum;
      }, 0);

      const totalChange24h = holdings.reduce((sum, holding) => {
        const priceData = priceMap.get(holding.symbol);
        if (priceData) {
          const value = parseFloat(holding.amount) * priceData.price;
          const change = (priceData.change24h / 100) * value;
          return sum + change;
        }
        return sum;
      }, 0);

      await storage.createPortfolioSnapshot({
        totalValue: totalValue.toString(),
        totalChange24h: totalChange24h.toString()
      });

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
