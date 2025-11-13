import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { AssetAllocationChart } from "@/components/AssetAllocationChart";
import { HoldingsTable, type Holding } from "@/components/HoldingsTable";
import { TransactionHistory, type Transaction } from "@/components/TransactionHistory";
import { ConnectedAccounts, type ConnectedAccount } from "@/components/ConnectedAccounts";
import { SourceFilter, type Source } from "@/components/SourceFilter";
import { Card } from "@/components/ui/card";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PortfolioSummary {
  totalValue: number;
  change24h: number;
  change24hPercent: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  assetsCount: number;
  connectedSources: number;
  holdings: Array<Holding & { currentPrice: number; change24h: number; value: number; profitLoss: number; profitLossPercent: number }>;
  transactions: Array<Transaction & { timestamp: string }>;
  connections: Array<{ id: string; name: string; type: string; status: string; lastSync: string | null }>;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { data: portfolio, isLoading } = useQuery<PortfolioSummary>({
    queryKey: ['/api/portfolio/summary'],
  });

  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const sources: Source[] = portfolio?.connections.map(conn => ({
    id: conn.id,
    name: conn.name,
    type: conn.type as 'wallet' | 'exchange'
  })) || [];

  // Initialize selected sources when data loads
  useEffect(() => {
    if (portfolio && selectedSources.length === 0 && sources.length > 0) {
      setSelectedSources(sources.map(s => s.id));
    }
  }, [portfolio]);

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

  const handleDisconnect = async (id: string) => {
    try {
      const response = await fetch(`/api/connections/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete');
      }
      
      await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });
      
      toast({
        title: "Success",
        description: "Connection removed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove connection",
        variant: "destructive",
      });
    }
  };

  // Filter holdings and transactions by selected sources
  const filteredHoldings = portfolio?.holdings.filter(h => 
    h.connectionId && selectedSources.includes(h.connectionId)
  ) || [];

  const filteredTransactions = portfolio?.transactions
    .filter(t => t.connectionId && selectedSources.includes(t.connectionId))
    .map(t => ({
      ...t,
      timestamp: new Date(t.timestamp)
    })) || [];

  const connectedAccounts: ConnectedAccount[] = portfolio?.connections.map(conn => ({
    id: conn.id,
    name: conn.name,
    type: conn.type as 'wallet' | 'exchange',
    icon: conn.name.toLowerCase(),
    status: conn.status as 'synced' | 'syncing' | 'error',
    lastSync: conn.lastSync ? new Date(conn.lastSync) : undefined,
    balance: portfolio.holdings
      .filter(h => h.connectionId === conn.id)
      .reduce((sum, h) => sum + h.value, 0)
  })) || [];

  // Calculate asset allocation for pie chart
  const assetAllocation = filteredHoldings.reduce((acc, holding) => {
    const existing = acc.find(a => a.name === holding.name);
    if (existing) {
      existing.value += holding.value;
    } else {
      acc.push({
        name: holding.name,
        value: holding.value,
        percentage: 0,
        color: getAssetColor(holding.symbol)
      });
    }
    return acc;
  }, [] as Array<{ name: string; value: number; percentage: number; color: string }>);

  // Calculate percentages
  const totalValue = assetAllocation.reduce((sum, a) => sum + a.value, 0);
  assetAllocation.forEach(asset => {
    asset.percentage = totalValue > 0 ? (asset.value / totalValue) * 100 : 0;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading portfolio...</div>
        </div>
      </div>
    );
  }

  if (!portfolio || portfolio.connectedSources === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-2">Welcome to CryptoTrack</h2>
          <p className="text-muted-foreground mb-4">
            Connect your first wallet or exchange to start tracking your portfolio
          </p>
          <a
            href="/settings"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Go to Settings
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortfolioOverview
        totalValue={portfolio.totalValue}
        change24h={portfolio.change24h}
        change24hPercent={portfolio.change24hPercent}
        totalProfitLoss={portfolio.totalProfitLoss}
        totalProfitLossPercent={portfolio.totalProfitLossPercent}
        assetsCount={portfolio.assetsCount}
        connectedSources={portfolio.connectedSources}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {assetAllocation.length > 0 ? (
            <AssetAllocationChart assets={assetAllocation} />
          ) : (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Asset Allocation</h3>
              <p className="text-muted-foreground">No assets to display. Select sources above.</p>
            </Card>
          )}
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

      {filteredHoldings.length > 0 && (
        <HoldingsTable holdings={filteredHoldings} />
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTransactions.length > 0 && (
          <TransactionHistory transactions={filteredTransactions} />
        )}
        <ConnectedAccounts accounts={connectedAccounts} onDisconnect={handleDisconnect} />
      </div>
    </div>
  );
}

function getAssetColor(symbol: string): string {
  const colors: Record<string, string> = {
    'BTC': '#F7931A',
    'ETH': '#627EEA',
    'SOL': '#00D4AA',
    'ADA': '#0033AD',
    'MATIC': '#8247E5',
    'DOT': '#E6007A',
    'LINK': '#2A5ADA',
    'AVAX': '#E84142',
  };
  return colors[symbol.toUpperCase()] || '#6B7280';
}
