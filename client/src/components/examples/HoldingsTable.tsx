import { HoldingsTable } from '../HoldingsTable';

export default function HoldingsTableExample() {
  const mockHoldings = [
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
  ];

  return (
    <div className="p-6">
      <HoldingsTable holdings={mockHoldings} />
    </div>
  );
}
