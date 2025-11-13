import { TrendingUp, TrendingDown, Wallet, Link as LinkIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PortfolioOverviewProps {
  totalValue: number;
  change24h: number;
  change24hPercent: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  assetsCount: number;
  connectedSources: number;
}

export function PortfolioOverview({
  totalValue,
  change24h,
  change24hPercent,
  totalProfitLoss,
  totalProfitLossPercent,
  assetsCount,
  connectedSources,
}: PortfolioOverviewProps) {
  const isPositive24h = change24h >= 0;
  const isProfitable = totalProfitLoss >= 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="text-sm text-muted-foreground">Total Portfolio Value</div>
        <div className="text-5xl font-bold tabular-nums" data-testid="text-total-value">
          ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className={`flex items-center justify-center gap-2 text-lg font-semibold ${isPositive24h ? 'text-success' : 'text-destructive'}`} data-testid="text-24h-change">
          {isPositive24h ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          <span>
            {isPositive24h ? '+' : ''}{change24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-muted-foreground">
            ({isPositive24h ? '+' : ''}{change24hPercent.toFixed(2)}%)
          </span>
          <span className="text-sm text-muted-foreground font-normal">24h</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Total Profit/Loss</div>
            <div className={`text-2xl font-bold tabular-nums ${isProfitable ? 'text-success' : 'text-destructive'}`} data-testid="text-profit-loss">
              {isProfitable ? '+' : ''}{totalProfitLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={`text-sm font-medium ${isProfitable ? 'text-success' : 'text-destructive'}`}>
              {isProfitable ? '+' : ''}{totalProfitLossPercent.toFixed(2)}%
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span>Total Assets</span>
            </div>
            <div className="text-2xl font-bold tabular-nums" data-testid="text-assets-count">
              {assetsCount}
            </div>
            <div className="text-sm text-muted-foreground">Cryptocurrencies</div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LinkIcon className="h-4 w-4" />
              <span>Connected Sources</span>
            </div>
            <div className="text-2xl font-bold tabular-nums" data-testid="text-connected-sources">
              {connectedSources}
            </div>
            <div className="text-sm text-muted-foreground">Wallets & Exchanges</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
