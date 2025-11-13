import { storage } from "./storage";

export async function initializeSampleData() {
  // Check if data already exists
  const existingConnections = await storage.getAllConnections();
  if (existingConnections.length > 0) {
    return; // Data already initialized
  }

  // Create sample connections
  const metamask = await storage.createConnection({
    name: "MetaMask Wallet",
    type: "wallet",
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    status: "synced",
  });

  const binance = await storage.createConnection({
    name: "Binance",
    type: "exchange",
    apiKey: "sample_api_key",
    apiSecret: "sample_api_secret",
    status: "synced",
  });

  const solflare = await storage.createConnection({
    name: "Solflare Wallet",
    type: "wallet",
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    status: "synced",
  });

  // Create sample holdings
  await storage.createHolding({
    connectionId: metamask.id,
    symbol: "BTC",
    name: "Bitcoin",
    amount: "1.25",
    avgCost: "35000",
  });

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "ETH",
    name: "Ethereum",
    amount: "12.5",
    avgCost: "2100",
  });

  await storage.createHolding({
    connectionId: solflare.id,
    symbol: "SOL",
    name: "Solana",
    amount: "150",
    avgCost: "95",
  });

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "ADA",
    name: "Cardano",
    amount: "25000",
    avgCost: "0.42",
  });

  await storage.createHolding({
    connectionId: metamask.id,
    symbol: "MATIC",
    name: "Polygon",
    amount: "12000",
    avgCost: "0.68",
  });

  // Create sample transactions
  const now = new Date();
  
  await storage.createTransaction({
    connectionId: binance.id,
    type: "buy",
    symbol: "BTC",
    amount: "0.5",
    price: "43200",
    total: "21600",
    timestamp: new Date(now.getTime() - 86400000),
    source: "Binance",
  });

  await storage.createTransaction({
    connectionId: binance.id,
    type: "sell",
    symbol: "ETH",
    amount: "2.5",
    price: "2280",
    total: "5700",
    timestamp: new Date(now.getTime() - 172800000),
    source: "Binance",
  });

  await storage.createTransaction({
    connectionId: metamask.id,
    type: "transfer",
    symbol: "SOL",
    amount: "50",
    price: "104",
    total: "5200",
    timestamp: new Date(now.getTime() - 259200000),
    source: "MetaMask",
  });

  await storage.createTransaction({
    connectionId: binance.id,
    type: "buy",
    symbol: "ADA",
    amount: "10000",
    price: "0.488",
    total: "4880",
    timestamp: new Date(now.getTime() - 345600000),
    source: "Binance",
  });

  console.log("Sample data initialized successfully");
}
