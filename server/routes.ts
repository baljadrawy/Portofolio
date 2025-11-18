import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConnectionSchema, insertHoldingSchema, insertTransactionSchema } from "@shared/schema";
import { etherscanService } from "./services/etherscan";
import { solscanService } from "./services/solscan";
import { binanceService } from "./services/binance";
import { SUPPORTED_CHAINS, NATIVE_TOKENS, CHAIN_NAMES, NON_EVM_NETWORKS, NON_EVM_NETWORK_NAMES, NON_EVM_NATIVE_TOKENS } from "@shared/networks";
import { registerPriceRoutes } from "./routes/prices";
import { SymbolMapper } from "./services/symbol-mapper";

export async function registerRoutes(app: Express): Promise<Server> {
  registerPriceRoutes(app);
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
      
      // Security: Reject any attempt to store API keys
      if ('apiKey' in req.body || 'apiSecret' in req.body) {
        return res.status(400).json({ 
          error: "API keys cannot be stored. Provide credentials during sync operations only." 
        });
      }
      
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
  async function scanChainsBatched(address: string, chainIds: number[], customName?: string) {
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
          
          let connection;
          let isNew = false;
          
          if (existing) {
            console.log(`[Scan] Connection already exists for ${chainName}, will refresh holdings`);
            connection = existing;
            
            // Clear existing holdings and transactions for refresh
            await storage.deleteHoldingsByConnection(connection.id);
            console.log(`[Scan] Cleared old holdings for ${chainName}`);
          } else {
            const walletName = customName ? `${customName} - ${chainName}` : `Wallet - ${chainName}`;
            connection = await storage.createConnection({
              name: walletName,
              type: 'wallet',
              address: address,
              chainId: chainId,
              status: 'connected'
            });
            isNew = true;
            console.log(`[Scan] Created new connection for ${chainName}`);
          }
          
          console.log(`[Scan] Processing ${chainName}: ${hasTokens ? walletData.tokens.length : 0} tokens, ${nativeToken.symbol}: ${walletData.ethBalance}`);
          
          // Create holdings for native token
          if (parseFloat(walletData.ethBalance) > 0) {
            await storage.createHolding({
              connectionId: connection.id,
              symbol: nativeToken.symbol,
              name: nativeToken.name,
              amount: walletData.ethBalance,
              avgCost: '0'
            });
            console.log(`[Scan] Created ${nativeToken.symbol} holding: ${walletData.ethBalance}`);
          }
          
          // Create holdings for tokens
          for (const token of walletData.tokens) {
            if (parseFloat(token.balance) > 0) {
              await storage.createHolding({
                connectionId: connection.id,
                symbol: token.symbol,
                name: token.name,
                amount: token.balance,
                avgCost: '0'
              });
              console.log(`[Scan] Created token holding: ${token.symbol} (${token.balance})`);
            }
          }
          
          // Create transactions (limit to first 50)
          for (const tx of walletData.transactions.slice(0, 50)) {
            const isIncoming = tx.to.toLowerCase() === address.toLowerCase();
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
          
          // Update connection with sync metadata
          if (walletData.transactions.length > 0) {
            const blocks = walletData.transactions.map(tx => parseInt(tx.blockNumber)).filter(b => !isNaN(b));
            const highestBlock = blocks.length > 0 ? Math.max(...blocks) : 0;
            
            await storage.updateConnection(connection.id, {
              lastBlockScanned: highestBlock,
              lastTokenScan: new Date(),
              lastSync: new Date(),
              status: 'synced'
            });
          } else {
            await storage.updateConnection(connection.id, {
              lastTokenScan: new Date(),
              lastSync: new Date(),
              status: 'synced'
            });
          }
          
          results.push({ status: 'fulfilled', value: { chainId, chainName, connection, created: isNew, status: isNew ? 'created' : 'refreshed' } });
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
      const { address, name } = req.body;
      
      if (!address || typeof address !== 'string') {
        return res.status(400).json({ error: "Invalid wallet address" });
      }

      console.log(`[Scan] Starting multi-network scan for address: ${address}`);
      
      const chainIds = Object.values(SUPPORTED_CHAINS);
      const createdConnections = [];
      const failedNetworks = [];
      const emptyNetworks = [];
      
      console.log(`[Scan] Will scan ${chainIds.length} networks sequentially with 700ms delays to respect Etherscan rate limits`);
      
      const scanResults = await scanChainsBatched(address, chainIds, name);
      
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

  // Solana wallet scan endpoint
  app.post("/api/wallet/scan-solana", async (req, res) => {
    try {
      const { address, name } = req.body;
      
      if (!address || typeof address !== 'string') {
        return res.status(400).json({ error: "Invalid Solana wallet address" });
      }

      console.log(`[Solana Scan] Starting scan for address: ${address}`);
      
      const existingConnections = await storage.getAllConnections();
      const existing = existingConnections.find(
        c => c.address?.toLowerCase() === address.toLowerCase() && 
             c.chainNamespace === 'solana'
      );
      
      if (existing) {
        console.log(`[Solana Scan] Connection already exists, skipping`);
        return res.status(200).json({ 
          connection: existing,
          message: "Solana wallet already connected",
          alreadyExists: true
        });
      }
      
      const walletData = await solscanService.getWalletData(address);
      
      const hasNativeBalance = parseFloat(walletData.solBalance || '0') > 0;
      const hasTokens = walletData.tokens && walletData.tokens.length > 0;
      
      if (!hasNativeBalance && !hasTokens) {
        console.log(`[Solana Scan] No data found for address: ${address}`);
        return res.status(200).json({ 
          address,
          connection: null,
          message: "This Solana wallet has no balance or tokens"
        });
      }
      
      const walletName = name ? `${name} - Solana` : 'Wallet - Solana';
      const connection = await storage.createConnection({
        name: walletName,
        type: 'wallet',
        address: address,
        chainNamespace: 'solana',
        networkKey: NON_EVM_NETWORKS.SOLANA,
        status: 'connected'
      });
      
      console.log(`[Solana Scan] Created connection (${hasTokens ? walletData.tokens.length : 0} tokens, SOL: ${walletData.solBalance})`);
      
      res.status(201).json({ 
        connection,
        message: "Solana wallet connected successfully"
      });
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('[Solana Scan] Error:', errorMsg);
      
      if (errorMsg.includes('SOLSCAN_API_KEY')) {
        return res.status(500).json({ error: "Solscan API key not configured" });
      }
      
      res.status(500).json({ error: "Failed to scan Solana wallet", details: errorMsg });
    }
  });

  // Holdings routes
  app.get("/api/holdings", async (_req, res) => {
    try {
      const holdings = await storage.getAllHoldings();
      const connections = await storage.getAllConnections();
      
      // Filter out scam/spam tokens before enriching
      const legitimateHoldings = holdings.filter(holding => 
        SymbolMapper.isValidSymbol(holding.symbol, holding.name)
      );
      
      // Enrich holdings with connection information
      const enrichedHoldings = legitimateHoldings.map(holding => {
        const connection = connections.find(c => c.id === holding.connectionId);
        return {
          ...holding,
          connectionName: connection?.name,
          connectionType: connection?.type,
          chainName: connection?.chainId ? CHAIN_NAMES[connection.chainId] : 
                     (connection?.networkKey ? NON_EVM_NETWORK_NAMES[connection.networkKey] : undefined),
        };
      });
      
      res.json(enrichedHoldings);
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

  // Sync wallet data from Etherscan or Solscan
  app.post("/api/wallet/sync/:connectionId", async (req, res) => {
    try {
      const connection = await storage.getConnection(req.params.connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      if (connection.type !== 'wallet' || !connection.address) {
        return res.status(400).json({ error: "Invalid wallet connection" });
      }

      await storage.updateConnection(connection.id, { status: 'syncing' });

      // Handle Solana wallets
      if (connection.chainNamespace === 'solana') {
        console.log(`[Wallet Sync] Starting Solana sync for wallet: ${connection.name} (${connection.address})`);
        
        const walletData = await solscanService.getWalletData(connection.address);
        
        console.log(`[Wallet Sync] Received Solana data - SOL: ${walletData.solBalance}, Tokens: ${walletData.tokens.length}`);
        
        await storage.deleteHoldingsByConnection(connection.id);

        if (parseFloat(walletData.solBalance) > 0) {
          await storage.createHolding({
            connectionId: connection.id,
            symbol: 'SOL',
            name: 'Solana',
            amount: walletData.solBalance,
            avgCost: '0'
          });
          console.log(`[Wallet Sync] Added SOL holding: ${walletData.solBalance}`);
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

        await storage.updateConnection(connection.id, { 
          status: 'synced',
          lastSync: new Date()
        });

        console.log(`[Wallet Sync] Completed Solana sync for wallet: ${connection.name}`);

        return res.json({ 
          success: true,
          solBalance: walletData.solBalance,
          tokensCount: walletData.tokens.length,
          transactionsCount: 0
        });
      }

      // Handle EVM wallets
      const chainId = connection.chainId || SUPPORTED_CHAINS.ETHEREUM;
      const nativeToken = NATIVE_TOKENS[chainId] || { symbol: 'ETH', name: 'Ethereum' };
      
      console.log(`[Wallet Sync] Starting EVM sync (incremental) for wallet: ${connection.name} (${connection.address}) on chain ${chainId}`);
      console.log(`[Wallet Sync] Last block scanned: ${connection.lastBlockScanned || 'none'}, Last token scan: ${connection.lastTokenScan || 'never'}`);

      const walletData = await etherscanService.getWalletDataIncremental(
        connection.address, 
        chainId,
        connection.lastBlockScanned,
        connection.lastTokenScan
      );

      console.log(`[Wallet Sync] Received EVM data - ${nativeToken.symbol}: ${walletData.ethBalance}, Tokens: ${walletData.tokens.length}, Transactions: ${walletData.transactions.length}, New highest block: ${walletData.highestBlock}, Token scan needed: ${walletData.shouldUpdateTokens}`);
      
      if (walletData.warnings && walletData.warnings.length > 0) {
        console.warn('[Wallet Sync] Warnings:', walletData.warnings);
      }

      let existingHoldings = await storage.getHoldingsByConnection(connection.id);
      const existingBySymbol = new Map(existingHoldings.map(h => [h.symbol, h]));
      
      const nativeHolding = existingBySymbol.get(nativeToken.symbol);
      if (nativeHolding) {
        await storage.updateHolding(nativeHolding.id, { amount: walletData.ethBalance });
        console.log(`[Wallet Sync] Updated ${nativeToken.symbol} holding: ${walletData.ethBalance}`);
      } else if (parseFloat(walletData.ethBalance) > 0) {
        await storage.createHolding({
          connectionId: connection.id,
          symbol: nativeToken.symbol,
          name: nativeToken.name,
          amount: walletData.ethBalance,
          avgCost: '0'
        });
        console.log(`[Wallet Sync] Created ${nativeToken.symbol} holding: ${walletData.ethBalance}`);
      }

      if (walletData.shouldUpdateTokens) {
        existingHoldings = await storage.getHoldingsByConnection(connection.id);
        const existingTokensBySymbol = new Map(existingHoldings.map(h => [h.symbol, h]));
        const newTokenSymbols = new Set(walletData.tokens.map(t => t.symbol));
        
        for (const existing of existingHoldings) {
          if (existing.symbol !== nativeToken.symbol && !newTokenSymbols.has(existing.symbol)) {
            await storage.deleteHolding(existing.id);
            console.log(`[Wallet Sync] Removed stale token: ${existing.symbol}`);
          }
        }
        
        for (const token of walletData.tokens) {
          if (parseFloat(token.balance) > 0) {
            const existing = existingTokensBySymbol.get(token.symbol);
            if (existing) {
              await storage.updateHolding(existing.id, { 
                amount: token.balance,
                name: token.name
              });
              console.log(`[Wallet Sync] Updated token: ${token.symbol} (${token.balance})`);
            } else {
              await storage.createHolding({
                connectionId: connection.id,
                symbol: token.symbol,
                name: token.name,
                amount: token.balance,
                avgCost: '0'
              });
              console.log(`[Wallet Sync] Created token: ${token.symbol} (${token.balance})`);
            }
          }
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
        lastSync: new Date(),
        lastBlockScanned: walletData.highestBlock,
        lastTokenScan: walletData.shouldUpdateTokens ? new Date() : connection.lastTokenScan
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

  // Sync exchange data
  app.post("/api/exchange/sync/:connectionId", async (req, res) => {
    try {
      const connection = await storage.getConnection(req.params.connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      if (connection.type !== 'exchange') {
        return res.status(400).json({ error: "Invalid exchange connection" });
      }

      // Security: Credentials must be provided in request body, not stored
      const { apiKey, apiSecret } = req.body;
      
      if (!apiKey || !apiSecret) {
        return res.status(400).json({ 
          error: "API credentials required. Please provide apiKey and apiSecret in request body." 
        });
      }

      await storage.updateConnection(connection.id, { status: 'syncing' });

      console.log(`[Exchange Sync] Starting sync for exchange: ${connection.name}`);

      const accountData = await binanceService.getAccountData(apiKey, apiSecret);
      
      console.log(`[Exchange Sync] Received data - Balances: ${accountData.balances.length}`);
      
      await storage.deleteHoldingsByConnection(connection.id);

      let addedCount = 0;
      for (const balance of accountData.balances) {
        if (parseFloat(balance.total) > 0) {
          await storage.createHolding({
            connectionId: connection.id,
            symbol: balance.asset,
            name: balance.name,
            amount: balance.total,
            avgCost: '0'
          });
          console.log(`[Exchange Sync] Added ${balance.asset}: ${balance.total}`);
          addedCount++;
        }
      }

      await storage.updateConnection(connection.id, { 
        status: 'synced',
        lastSync: new Date()
      });

      console.log(`[Exchange Sync] Completed sync for exchange: ${connection.name}`);

      res.json({ 
        success: true,
        balancesCount: addedCount,
        canTrade: accountData.canTrade,
        canWithdraw: accountData.canWithdraw
      });
    } catch (error) {
      console.error('[Exchange Sync] Fatal error:', error);
      
      if (req.params.connectionId) {
        await storage.updateConnection(req.params.connectionId, { status: 'error' });
      }
      
      const errorMessage = error instanceof Error ? error.message : "Failed to sync exchange data";
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
      const allHoldings = await storage.getAllHoldings();
      const connections = await storage.getAllConnections();
      const transactions = await storage.getAllTransactions();
      
      // Filter out scam/spam tokens
      const holdings = allHoldings.filter(holding => 
        SymbolMapper.isValidSymbol(holding.symbol, holding.name)
      );

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
        // Use stored price from database first, fallback to CoinGecko
        const storedPrice = holding.currentPrice 
          ? (typeof holding.currentPrice === 'string' ? parseFloat(holding.currentPrice) : holding.currentPrice)
          : 0;
        
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
        
        // Prefer stored price, fallback to CoinGecko
        const currentPrice = storedPrice > 0 ? storedPrice : (priceData?.usd || 0);
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

        // Get connection information
        const connection = connections.find(c => c.id === holding.connectionId);
        const chainName = connection?.chainId ? CHAIN_NAMES[connection.chainId] : 
                         (connection?.networkKey ? NON_EVM_NETWORK_NAMES[connection.networkKey] : undefined);

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
          connectionName: connection?.name,
          connectionType: connection?.type,
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
