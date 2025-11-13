import { PortfolioOverview } from '../PortfolioOverview';

export default function PortfolioOverviewExample() {
  return (
    <div className="p-6">
      <PortfolioOverview
        totalValue={125487.32}
        change24h={3245.67}
        change24hPercent={2.65}
        totalProfitLoss={28934.12}
        totalProfitLossPercent={29.98}
        assetsCount={12}
        connectedSources={5}
      />
    </div>
  );
}
