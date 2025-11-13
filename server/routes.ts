import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConnectionSchema, insertHoldingSchema, insertTransactionSchema } from "@shared/schema";
import { etherscanService } from "./services/etherscan";
import { SUPPORTED_CHAINS, NATIVE_TOKENS, CHAIN_NAMES } from "@shared/networks";

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

  // Helper function to delay execution
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper function to process chains sequentially with rate limiting
  async function scanChainsBatched(address: string, chainIds: number[]) {
    const DELAY_BETWEEN_NETWORKS = 700; // 700ms delay between networks (3 calls per network = ~4.3 req/sec)
    const results = [];
    
    for (let i = 0; i < chainIds.length; i++) {
      const chainId = chainIds[i];
      const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
      
      console.log(`[Scan] Processing network ${i + 1}/${chainIds.length}: ${chainName}`);
      
      // Refresh existing connections before each network to avoid duplicates
      const existingConnections = await storage.getAllConnections();
      
      try {
        const walletData = await etherscanService.getWalletData(address, chainId);
        
        const hasNativeBalance = parseFloat(walletData.ethBalance || '0') > 0;
        const hasTokens = walletData.tokens && walletData.tokens.length > 0;
        
        if (hasNativeBalance || hasTokens) {
          const nativeToken = NATIVE_TOKENS[chainId];
          
          const existing = existingConnections.find(
            c => c.address?.toLowerCase() === address.toLowerCase() && c.chainId === chainId
          );
          
          if (existing) {
            console.log(`[Scan] Connection already exists for ${chainName}, skipping`);
            results.push({ status: 'fulfilled', value: { chainId, chainName, connection: existing, created: false, status: 'exists' } });
          } else {
            const connection = await storage.createConnection({
              name: `Wallet - ${chainName}`,
              type: 'wallet',
              address: address,
              chainId: chainId,
              status: 'connected'
            });
            
            console.log(`[Scan] Created connection for ${chainName} (${hasTokens ? walletData.tokens.length : 0} tokens, ${nativeToken.symbol}: ${walletData.ethBalance})`);
            
            results.push({ status: 'fulfilled', value: { chainId, chainName, connection, created: true, status: 'created' } });
          }
        } else {
          console.log(`[Scan] No data found on ${chainName}`);
          results.push({ status: 'fulfilled', value: { chainId, chainName, status: 'empty' } });
        }
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.error(`[Scan] Error scanning ${chainName}:`, errorMsg);
        
        results.push({ status: 'fulfilled', value: { chainId, chainName, status: 'error', error: errorMsg } });
      }
      
      // Add delay between networks (except after the last one)
      if (i < chainIds.length - 1) {
        await delay(DELAY_BETWEEN_NETWORKS);
      }
    }
    
    return results;
  }

  app.post("/api/wallet/scan-all-networks", async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address || typeof address !== 'string') {
        return res.status(400).json({ error: "Invalid wallet address" });
      }

      console.log(`[Scan] Starting multi-network scan for address: ${address}`);
      
      const chainIds = Object.values(SUPPORTED_CHAINS);
      const createdConnections = [];
      const failedNetworks = [];
      const emptyNetworks = [];
      
      console.log(`[Scan] Will scan ${chainIds.length} networks sequentially with 700ms delays to respect Etherscan rate limits`);
      
      const scanResults = await scanChainsBatched(address, chainIds);
      
      for (const result of scanResults) {
        if (result.status === 'fulfilled' && result.value) {
          const val = result.value;
          if (val.status === 'created' || val.status === 'exists') {
            createdConnections.push(val);
          } else if (val.status === 'empty') {
            emptyNetworks.push(val.chainName);
          } else if (val.status === 'error') {
            failedNetworks.push({ network: val.chainName, error: val.error });
          }
        }
      }
      
      const hasFailures = failedNetworks.length > 0;
      const hasData = createdConnections.length > 0;
      
      if (!hasData && !hasFailures) {
        console.log(`[Scan] No data found on any network for address: ${address}`);
        return res.status(200).json({ 
          address,
          connections: [],
          networksScanned: chainIds.length,
          networksWithData: 0,
          failedNetworks: [],
          emptyNetworks,
          message: "This wallet address has no balance or tokens on any supported network" 
        });
      }
      
      if (hasFailures && !hasData) {
        console.log(`[Scan] All networks failed or returned errors`);
        return res.status(503).json({
          address,
          connections: [],
          networksScanned: chainIds.length,
          networksWithData: 0,
          failedNetworks,
          emptyNetworks,
          error: "Unable to scan networks due to API errors. Please try again later.",
          message: "Etherscan API may be temporarily unavailable or rate limited"
        });
      }
      
      console.log(`[Scan] Completed: ${createdConnections.filter(c => c.created).length} new, ${createdConnections.filter(c => !c.created).length} existing connections`);
      
      const response: any = {
        address,
        connections: createdConnections.map(c => c.connection),
        networksScanned: chainIds.length,
        networksWithData: createdConnections.length,
        emptyNetworks,
      };
      
      if (hasFailures) {
        response.failedNetworks = failedNetworks;
        response.warning = `${failedNetworks.length} network(s) failed to scan`;
      }
      
      res.status(201).json(response);
    } catch (error) {
      console.error('[Scan] Error:', error);
      res.status(500).json({ error: "Failed to scan wallet across networks" });
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

  // Sync wallet data from Etherscan
  app.post("/api/wallet/sync/:connectionId", async (req, res) => {
    try {
      const connection = await storage.getConnection(req.params.connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      if (connection.type !== 'wallet' || !connection.address) {
        return res.status(400).json({ error: "Invalid wallet connection" });
      }

      const chainId = connection.chainId || SUPPORTED_CHAINS.ETHEREUM;
      const nativeToken = NATIVE_TOKENS[chainId] || { symbol: 'ETH', name: 'Ethereum' };
      
      console.log(`[Wallet Sync] Starting sync for wallet: ${connection.name} (${connection.address}) on chain ${chainId}`);

      await storage.updateConnection(connection.id, { status: 'syncing' });

      const walletData = await etherscanService.getWalletData(connection.address, chainId);

      console.log(`[Wallet Sync] Received data - ${nativeToken.symbol}: ${walletData.ethBalance}, Tokens: ${walletData.tokens.length}, Transactions: ${walletData.transactions.length}`);
      
      if (walletData.warnings && walletData.warnings.length > 0) {
        console.warn('[Wallet Sync] Warnings:', walletData.warnings);
      }

      await storage.deleteHoldingsByConnection(connection.id);

      if (parseFloat(walletData.ethBalance) > 0) {
        await storage.createHolding({
          connectionId: connection.id,
          symbol: nativeToken.symbol,
          name: nativeToken.name,
          amount: walletData.ethBalance,
          avgCost: '0'
        });
        console.log(`[Wallet Sync] Added ${nativeToken.symbol} holding: ${walletData.ethBalance}`);
      }

      for (const token of walletData.tokens) {
        if (parseFloat(token.balance) > 0) {
          await storage.createHolding({
            connectionId: connection.id,
            symbol: token.symbol,
            name: token.name,
            amount: token.balance,
            avgCost: '0'
          });
          console.log(`[Wallet Sync] Added token: ${token.symbol} (${token.balance})`);
        }
      }

      for (const tx of walletData.transactions.slice(0, 50)) {
        const isIncoming = tx.to.toLowerCase() === connection.address.toLowerCase();
        const nativeValue = (parseFloat(tx.value) / 1e18).toString();
        
        if (parseFloat(nativeValue) > 0) {
          await storage.createTransaction({
            connectionId: connection.id,
            type: isIncoming ? 'buy' : 'sell',
            symbol: nativeToken.symbol,
            amount: nativeValue,
            price: '0',
            total: '0',
            timestamp: new Date(parseInt(tx.timeStamp) * 1000),
            source: connection.name
          });
        }
      }

      await storage.updateConnection(connection.id, { 
        status: walletData.warnings && walletData.warnings.length > 0 ? 'synced' : 'synced',
        lastSync: new Date()
      });

      console.log(`[Wallet Sync] Completed sync for wallet: ${connection.name}`);

      res.json({ 
        success: true,
        ethBalance: walletData.ethBalance,
        tokensCount: walletData.tokens.length,
        transactionsCount: walletData.transactions.length,
        warnings: walletData.warnings
      });
    } catch (error) {
      console.error('[Wallet Sync] Fatal error:', error);
      
      if (req.params.connectionId) {
        await storage.updateConnection(req.params.connectionId, { status: 'error' });
      }
      
      const errorMessage = error instanceof Error ? error.message : "Failed to sync wallet data";
      res.status(500).json({ error: errorMessage });
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
      const symbols = Array.from(new Set(holdings.map(h => h.symbol.toLowerCase())));
      
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
        
        // Validate and clamp 24h percent change to avoid division issues
        // Clamp to [-99.9, +999] to prevent extreme values
        const validChange24hPercent = Math.max(-99.9, Math.min(999, change24hPercent));
        
        // Calculate yesterday's price safely
        // If change is -100%, yesterdayPrice would be infinity, so we clamp
        const yesterdayPrice = validChange24hPercent <= -99.9 
          ? currentPrice * 1000  // Assume it was 1000x higher if it crashed 99.9%
          : currentPrice / (1 + validChange24hPercent / 100);
        
        const valueYesterday = amount * yesterdayPrice;
        const change24hValue = value - valueYesterday;
        
        totalValue += value;
        totalValueYesterday += valueYesterday;
        totalCost += cost;

        // Get network name from connection
        const connection = connections.find(c => c.id === holding.connectionId);
        const chainName = connection?.chainId ? CHAIN_NAMES[connection.chainId] : undefined;

        return {
          ...holding,
          amount,
          avgCost,
          currentPrice,
          change24h: validChange24hPercent,
          change24hValue,
          value,
          profitLoss: value - cost,
          profitLossPercent: cost > 0 ? ((value - cost) / cost) * 100 : 0,
          chainName,
        };
      });

      const totalProfitLoss = totalValue - totalCost;
      const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;
      const change24hValue = totalValue - totalValueYesterday;
      const change24hPercent = totalValueYesterday > 0 ? (change24hValue / totalValueYesterday) * 100 : 0;

      res.json({
        totalValue,
        change24hValue,
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
