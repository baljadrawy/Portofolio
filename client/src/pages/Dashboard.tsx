import { useState } from "react";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { AssetAllocationChart } from "@/components/AssetAllocationChart";
import { HoldingsTable, type Holding } from "@/components/HoldingsTable";
import { TransactionHistory, type Transaction } from "@/components/TransactionHistory";
import { ConnectedAccounts, type ConnectedAccount } from "@/components/ConnectedAccounts";
import { SourceFilter, type Source } from "@/components/SourceFilter";

export default function Dashboard() {
  // TODO: remove mock functionality - replace with real API calls
  const mockAssets = [
    { name: 'Bitcoin', value: 54000, percentage: 42.5, color: '#F7931A' },
    { name: 'Ethereum', value: 28500, percentage: 22.4, color: '#627EEA' },
    { name: 'Solana', value: 15600, percentage: 12.3, color: '#00D4AA' },
    { name: 'Cardano', value: 12200, percentage: 9.6, color: '#0033AD' },
    { name: 'Polygon', value: 8900, percentage: 7.0, color: '#8247E5' },
    { name: 'Others', value: 8000, percentage: 6.2, color: '#6B7280' },
  ];

  const mockHoldings: Holding[] = [
    {
      id: '1',
      symbol: 'BTC',
      name: 'Bitcoin',
      amount: 1.25,
      avgCost: 35000,
      currentPrice: 43200,
      change24h: 2.45,
      value: 54000,
      profitLoss: 10250,
      profitLossPercent: 23.43
    },
    {
      id: '2',
      symbol: 'ETH',
      name: 'Ethereum',
      amount: 12.5,
      avgCost: 2100,
      currentPrice: 2280,
      change24h: 3.2,
      value: 28500,
      profitLoss: 2250,
      profitLossPercent: 8.57
    },
    {
      id: '3',
      symbol: 'SOL',
      name: 'Solana',
      amount: 150,
      avgCost: 95,
      currentPrice: 104,
      change24h: -1.5,
      value: 15600,
      profitLoss: 1350,
      profitLossPercent: 9.47
    },
    {
      id: '4',
      symbol: 'ADA',
      name: 'Cardano',
      amount: 25000,
      avgCost: 0.42,
      currentPrice: 0.488,
      change24h: 4.2,
      value: 12200,
      profitLoss: 1700,
      profitLossPercent: 16.19
    },
    {
      id: '5',
      symbol: 'MATIC',
      name: 'Polygon',
      amount: 12000,
      avgCost: 0.68,
      currentPrice: 0.742,
      change24h: -0.8,
      value: 8900,
      profitLoss: 744,
      profitLossPercent: 9.12
    },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: '1',
      type: 'buy',
      asset: 'BTC',
      amount: 0.5,
      price: 43200,
      total: 21600,
      timestamp: new Date(Date.now() - 86400000),
      source: 'Binance'
    },
    {
      id: '2',
      type: 'sell',
      asset: 'ETH',
      amount: 2.5,
      price: 2280,
      total: 5700,
      timestamp: new Date(Date.now() - 172800000),
      source: 'Coinbase'
    },
    {
      id: '3',
      type: 'transfer',
      asset: 'SOL',
      amount: 50,
      price: 104,
      total: 5200,
      timestamp: new Date(Date.now() - 259200000),
      source: 'MetaMask'
    },
    {
      id: '4',
      type: 'buy',
      asset: 'ADA',
      amount: 10000,
      price: 0.488,
      total: 4880,
      timestamp: new Date(Date.now() - 345600000),
      source: 'Binance'
    },
  ];

  const mockAccounts: ConnectedAccount[] = [
    {
      id: '1',
      name: 'MetaMask Wallet',
      type: 'wallet',
      icon: 'metamask',
      status: 'synced',
      lastSync: new Date(),
      balance: 54000
    },
    {
      id: '2',
      name: 'Binance',
      type: 'exchange',
      icon: 'binance',
      status: 'synced',
      lastSync: new Date(Date.now() - 300000),
      balance: 42150
    },
    {
      id: '3',
      name: 'Solflare Wallet',
      type: 'wallet',
      icon: 'solflare',
      status: 'synced',
      lastSync: new Date(Date.now() - 600000),
      balance: 15600
    },
    {
      id: '4',
      name: 'Coinbase',
      type: 'exchange',
      icon: 'coinbase',
      status: 'synced',
      lastSync: new Date(Date.now() - 900000),
      balance: 12200
    },
    {
      id: '5',
      name: 'Phantom Wallet',
      type: 'wallet',
      icon: 'phantom',
      status: 'syncing',
      balance: 3250
    },
  ];

  const sources: Source[] = mockAccounts.map(acc => ({
    id: acc.id,
    name: acc.name,
    type: acc.type
  }));

  const [selectedSources, setSelectedSources] = useState<string[]>(sources.map(s => s.id));

  const handleToggleSource = (id: string) => {
    setSelectedSources(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedSources.length === sources.length) {
      setSelectedSources([]);
    } else {
      setSelectedSources(sources.map(s => s.id));
    }
  };

  const handleDisconnect = (id: string) => {
    console.log('Disconnect account:', id);
  };

  return (
    <div className="space-y-6">
      <PortfolioOverview
        totalValue={127200}
        change24h={3245.67}
        change24hPercent={2.62}
        totalProfitLoss={16294}
        totalProfitLossPercent={14.68}
        assetsCount={12}
        connectedSources={5}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AssetAllocationChart assets={mockAssets} />
        </div>
        <div>
          <SourceFilter
            sources={sources}
            selectedSources={selectedSources}
            onToggleSource={handleToggleSource}
            onSelectAll={handleSelectAll}
          />
        </div>
      </div>

      <HoldingsTable holdings={mockHoldings} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TransactionHistory transactions={mockTransactions} />
        <ConnectedAccounts accounts={mockAccounts} onDisconnect={handleDisconnect} />
      </div>
    </div>
  );
}
