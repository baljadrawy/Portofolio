import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConnectionSchema, insertHoldingSchema, insertTransactionSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Connection routes
  app.get("/api/connections", async (_req, res) => {
    try {
      const connections = await storage.getAllConnections();
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch connections" });
    }
  });

  app.post("/api/connections", async (req, res) => {
    try {
      const validatedData = insertConnectionSchema.parse(req.body);
      const connection = await storage.createConnection(validatedData);
      res.status(201).json(connection);
    } catch (error) {
      res.status(400).json({ error: "Invalid connection data" });
    }
  });

  app.delete("/api/connections/:id", async (req, res) => {
    try {
      const success = await storage.deleteConnection(req.params.id);
      if (success) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: "Connection not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete connection" });
    }
  });

  // Holdings routes
  app.get("/api/holdings", async (_req, res) => {
    try {
      const holdings = await storage.getAllHoldings();
      res.json(holdings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch holdings" });
    }
  });

  app.post("/api/holdings", async (req, res) => {
    try {
      const validatedData = insertHoldingSchema.parse(req.body);
      const holding = await storage.createHolding(validatedData);
      res.status(201).json(holding);
    } catch (error) {
      res.status(400).json({ error: "Invalid holding data" });
    }
  });

  // Transactions routes
  app.get("/api/transactions", async (_req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      res.status(400).json({ error: "Invalid transaction data" });
    }
  });

  // Crypto prices from CoinGecko
  app.get("/api/crypto/prices", async (req, res) => {
    try {
      const symbols = req.query.symbols as string;
      if (!symbols) {
        return res.status(400).json({ error: "Symbols parameter required" });
      }

      const symbolList = symbols.split(',').map(s => s.toLowerCase());
      const ids = symbolList.join(',');
      
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch from CoinGecko');
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crypto prices" });
    }
  });

  // Portfolio summary endpoint
  app.get("/api/portfolio/summary", async (_req, res) => {
    try {
      const holdings = await storage.getAllHoldings();
      const connections = await storage.getAllConnections();
      const transactions = await storage.getAllTransactions();

      // Get unique symbols
      const symbols = [...new Set(holdings.map(h => h.symbol.toLowerCase()))];
      
      // Fetch current prices
      let prices: Record<string, { usd: number; usd_24h_change: number }> = {};
      if (symbols.length > 0) {
        const symbolMap: Record<string, string> = {
          'btc': 'bitcoin',
          'eth': 'ethereum',
          'sol': 'solana',
          'ada': 'cardano',
          'matic': 'matic-network',
          'dot': 'polkadot',
          'link': 'chainlink',
          'avax': 'avalanche-2',
        };

        const coinIds = symbols.map(s => symbolMap[s] || s).join(',');
        
        try {
          const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`
          );
          if (response.ok) {
            prices = await response.json();
          }
        } catch (error) {
          console.error('Failed to fetch prices:', error);
        }
      }

      // Calculate portfolio metrics
      let totalValue = 0;
      let totalValueYesterday = 0;
      let totalCost = 0;

      const holdingsWithPrices = holdings.map(holding => {
        const symbolMap: Record<string, string> = {
          'btc': 'bitcoin',
          'eth': 'ethereum',
          'sol': 'solana',
          'ada': 'cardano',
          'matic': 'matic-network',
          'dot': 'polkadot',
          'link': 'chainlink',
          'avax': 'avalanche-2',
        };

        const coinId = symbolMap[holding.symbol.toLowerCase()] || holding.symbol.toLowerCase();
        const priceData = prices[coinId];
        const currentPrice = priceData?.usd || 0;
        const change24hPercent = priceData?.usd_24h_change || 0;
        
        const amount = parseFloat(holding.amount);
        const avgCost = parseFloat(holding.avgCost);
        const value = amount * currentPrice;
        const cost = amount * avgCost;
        
        // Calculate yesterday's price
        const yesterdayPrice = currentPrice / (1 + change24hPercent / 100);
        const valueYesterday = amount * yesterdayPrice;
        
        totalValue += value;
        totalValueYesterday += valueYesterday;
        totalCost += cost;

        return {
          ...holding,
          amount,
          avgCost,
          currentPrice,
          change24h: change24hPercent,
          value,
          profitLoss: value - cost,
          profitLossPercent: cost > 0 ? ((value - cost) / cost) * 100 : 0,
        };
      });

      const totalProfitLoss = totalValue - totalCost;
      const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;
      const change24h = totalValue - totalValueYesterday;
      const change24hPercent = totalValueYesterday > 0 ? (change24h / totalValueYesterday) * 100 : 0;

      res.json({
        totalValue,
        change24h,
        change24hPercent,
        totalProfitLoss,
        totalProfitLossPercent,
        assetsCount: holdings.length,
        connectedSources: connections.length,
        holdings: holdingsWithPrices,
        transactions,
        connections,
      });
    } catch (error) {
      console.error('Portfolio summary error:', error);
      res.status(500).json({ error: "Failed to calculate portfolio summary" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
