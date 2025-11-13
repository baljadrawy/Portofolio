import { storage } from "./storage";
import { SUPPORTED_CHAINS } from "@shared/networks";

export async function initializeSampleData() {
  // Check if data already exists
  const existingConnections = await storage.getAllConnections();
  if (existingConnections.length > 0) {
    return; // Data already initialized
  }

  // Create sample connections - using same address on multiple networks to demonstrate multi-chain feature
  const vitalikAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  
  const metamask = await storage.createConnection({
    name: "Wallet - Ethereum",
    type: "wallet",
    address: vitalikAddress,
    chainId: SUPPORTED_CHAINS.ETHEREUM,
    status: "synced",
  });

  const polygonWallet = await storage.createConnection({
    name: "Wallet - Polygon",
    type: "wallet",
    address: vitalikAddress,
    chainId: SUPPORTED_CHAINS.POLYGON,
    status: "synced",
  });

  const testAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  
  const bscWallet = await storage.createConnection({
    name: "Wallet - BNB Smart Chain",
    type: "wallet",
    address: testAddress,
    chainId: SUPPORTED_CHAINS.BSC,
    status: "synced",
  });

  const binance = await storage.createConnection({
    name: "Binance Exchange",
    type: "exchange",
    apiKey: "sample_api_key",
    apiSecret: "sample_api_secret",
    status: "synced",
  });

  // Create sample holdings (25 different tokens to test pagination and chart grouping)
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
    connectionId: bscWallet.id,
    symbol: "BNB",
    name: "BNB",
    amount: "150",
    avgCost: "295",
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

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "LINK",
    name: "Chainlink",
    amount: "500",
    avgCost: "14.50",
  });

  await storage.createHolding({
    connectionId: metamask.id,
    symbol: "DOT",
    name: "Polkadot",
    amount: "800",
    avgCost: "7.25",
  });

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "AVAX",
    name: "Avalanche",
    amount: "300",
    avgCost: "28.00",
  });

  await storage.createHolding({
    connectionId: metamask.id,
    symbol: "UNI",
    name: "Uniswap",
    amount: "600",
    avgCost: "8.75",
  });

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "ATOM",
    name: "Cosmos",
    amount: "1200",
    avgCost: "9.20",
  });

  await storage.createHolding({
    connectionId: metamask.id,
    symbol: "XRP",
    name: "Ripple",
    amount: "15000",
    avgCost: "0.52",
  });

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "DOGE",
    name: "Dogecoin",
    amount: "50000",
    avgCost: "0.085",
  });

  await storage.createHolding({
    connectionId: metamask.id,
    symbol: "SHIB",
    name: "Shiba Inu",
    amount: "10000000",
    avgCost: "0.000015",
  });

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "LTC",
    name: "Litecoin",
    amount: "45",
    avgCost: "85.00",
  });

  await storage.createHolding({
    connectionId: metamask.id,
    symbol: "BCH",
    name: "Bitcoin Cash",
    amount: "25",
    avgCost: "320.00",
  });

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "XLM",
    name: "Stellar",
    amount: "8000",
    avgCost: "0.12",
  });

  await storage.createHolding({
    connectionId: metamask.id,
    symbol: "ALGO",
    name: "Algorand",
    amount: "5000",
    avgCost: "0.18",
  });

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "VET",
    name: "VeChain",
    amount: "20000",
    avgCost: "0.025",
  });

  await storage.createHolding({
    connectionId: metamask.id,
    symbol: "SAND",
    name: "The Sandbox",
    amount: "3000",
    avgCost: "0.48",
  });

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "MANA",
    name: "Decentraland",
    amount: "4000",
    avgCost: "0.55",
  });

  await storage.createHolding({
    connectionId: metamask.id,
    symbol: "AAVE",
    name: "Aave",
    amount: "80",
    avgCost: "95.00",
  });

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "FTM",
    name: "Fantom",
    amount: "6000",
    avgCost: "0.32",
  });

  await storage.createHolding({
    connectionId: metamask.id,
    symbol: "GRT",
    name: "The Graph",
    amount: "7000",
    avgCost: "0.15",
  });

  await storage.createHolding({
    connectionId: binance.id,
    symbol: "CRV",
    name: "Curve DAO",
    amount: "2000",
    avgCost: "0.85",
  });

  await storage.createHolding({
    connectionId: polygonWallet.id,
    symbol: "APT",
    name: "Aptos",
    amount: "500",
    avgCost: "8.50",
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
