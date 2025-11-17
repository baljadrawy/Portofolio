import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { AssetAllocationChart } from "@/components/AssetAllocationChart";
import { HoldingsTable, type Holding } from "@/components/HoldingsTable";
import { TransactionHistory, type Transaction } from "@/components/TransactionHistory";
import { ConnectedAccounts, type ConnectedAccount } from "@/components/ConnectedAccounts";
import { PerformanceChart } from "@/components/PerformanceChart";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { groupConnectionsByAddress } from "@/lib/groupConnections";
import { RefreshCw } from "lucide-react";

interface PortfolioSummary {
  totalValue: number;
  change24hValue: number;
  change24hPercent: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  assetsCount: number;
  connectedSources: number;
  holdings: Array<Holding & { currentPrice: number; change24h: number; change24hValue: number; value: number; profitLoss: number; profitLossPercent: number; chainName?: string }>;
  transactions: Array<Transaction & { timestamp: string }>;
  connections: Array<{ id: string; name: string; type: string; status: string; lastSync: string | null; address?: string | null; chainId?: number | null }>;
}

interface PortfolioSnapshot {
  id: string;
  totalValue: string;
  totalChange24h: string | null;
  timestamp: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { data: portfolio, isLoading } = useQuery<PortfolioSummary>({
    queryKey: ['/api/portfolio/summary'],
  });

  const { data: performanceData } = useQuery<PortfolioSnapshot[]>({
    queryKey: ['/api/portfolio/history'],
  });

  const updatePricesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/prices/update');
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/holdings'] });
      
      // Store last update time
      localStorage.setItem('lastPriceUpdate', new Date().toISOString());
      
      const message = data.scamTokensFiltered > 0 
        ? `تم تحديث ${data.updated} سعر وتصفية ${data.scamTokensFiltered} توكن احتيالي`
        : `تم تحديث ${data.updated} سعر`;
      
      toast({
        title: "تم بنجاح",
        description: message,
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل تحديث الأسعار",
        variant: "destructive",
      });
    },
  });

  // Auto-refresh prices on mount if needed (every 5 minutes)
  useEffect(() => {
    if (!portfolio || portfolio.holdings.length === 0) return;
    
    const lastUpdate = localStorage.getItem('lastPriceUpdate');
    const shouldUpdate = !lastUpdate || 
      (new Date().getTime() - new Date(lastUpdate).getTime()) > 5 * 60 * 1000;
    
    if (shouldUpdate) {
      console.log('[Dashboard] Auto-refreshing prices...');
      updatePricesMutation.mutate();
    }
  }, [portfolio?.holdings.length]);


  const handleDisconnect = async (groupId: string) => {
    try {
      const group = connectedAccounts.find(c => c.id === groupId);
      
      if (!portfolio) return;
      
      const connectionIdsToDelete = group?.address 
        ? portfolio.connections
            .filter(c => c.address?.toLowerCase() === group.address?.toLowerCase())
            .map(c => c.id)
        : [groupId];

      for (const id of connectionIdsToDelete) {
        const response = await fetch(`/api/connections/${id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete');
        }
      }
      
      await queryClient.invalidateQueries({ queryKey: ['/api/portfolio/summary'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      
      toast({
        title: "تم بنجاح",
        description: connectionIdsToDelete.length > 1 
          ? `تم حذف ${connectionIdsToDelete.length} اتصال من الشبكات المختلفة`
          : "تم حذف الاتصال بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل حذف الاتصال",
        variant: "destructive",
      });
    }
  };

  // Show all holdings without filtering
  const allHoldings = portfolio?.holdings || [];

  const allTransactions = portfolio?.transactions.map(t => ({
    ...t,
    timestamp: new Date(t.timestamp)
  })) || [];

  const connectedAccounts: ConnectedAccount[] = portfolio 
    ? groupConnectionsByAddress(
        portfolio.connections,
        portfolio.holdings.map(h => ({ connectionId: h.connectionId!, value: h.value }))
      ).map(group => ({
        id: group.groupId,
        name: group.name,
        type: group.type,
        icon: group.name.toLowerCase(),
        status: group.status,
        lastSync: group.lastSync,
        balance: group.balance,
        address: group.address,
        chainBadges: group.chainBadges
      }))
    : [];

  // Calculate asset allocation for pie chart (aggregate by symbol)
  const assetAllocation = allHoldings.reduce((acc, holding) => {
    const existing = acc.find(a => a.name === holding.symbol);
    if (existing) {
      existing.value += holding.value;
    } else {
      acc.push({
        name: holding.symbol,
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

  const performanceChartData = performanceData?.map(snapshot => ({
    timestamp: snapshot.timestamp,
    totalValue: parseFloat(snapshot.totalValue),
    totalChange24h: snapshot.totalChange24h ? parseFloat(snapshot.totalChange24h) : 0,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PortfolioOverview
          totalValue={portfolio.totalValue}
          change24h={portfolio.change24hValue}
          change24hPercent={portfolio.change24hPercent}
          totalProfitLoss={portfolio.totalProfitLoss}
          totalProfitLossPercent={portfolio.totalProfitLossPercent}
          assetsCount={portfolio.assetsCount}
          connectedSources={portfolio.connectedSources}
        />
        <Button 
          onClick={() => updatePricesMutation.mutate()}
          disabled={updatePricesMutation.isPending}
          data-testid="button-update-prices"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${updatePricesMutation.isPending ? 'animate-spin' : ''}`} />
          تحديث الأسعار
        </Button>
      </div>

      {performanceChartData.length > 0 && (
        <PerformanceChart data={performanceChartData} />
      )}

      <Tabs defaultValue="holdings" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="holdings" data-testid="tab-holdings">
            الأصول والممتلكات
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">
            سجل المعاملات
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="holdings" className="space-y-6 mt-6">
          {assetAllocation.length > 0 && (
            <AssetAllocationChart assets={assetAllocation} />
          )}

          {allHoldings.length > 0 ? (
            <HoldingsTable holdings={allHoldings} />
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground" data-testid="text-no-holdings">لا توجد أصول حتى الآن</p>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="transactions" className="space-y-6 mt-6">
          {allTransactions.length > 0 ? (
            <TransactionHistory transactions={allTransactions} />
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground" data-testid="text-no-transactions">لا توجد معاملات حتى الآن</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ConnectedAccounts accounts={connectedAccounts} onDisconnect={handleDisconnect} />
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
