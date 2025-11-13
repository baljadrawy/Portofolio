import { TransactionHistory } from '../TransactionHistory';

export default function TransactionHistoryExample() {
  const mockTransactions = [
    {
      id: '1',
      type: 'buy' as const,
      asset: 'BTC',
      amount: 0.5,
      price: 43200,
      total: 21600,
      timestamp: new Date(Date.now() - 86400000),
      source: 'Binance'
    },
    {
      id: '2',
      type: 'sell' as const,
      asset: 'ETH',
      amount: 2.5,
      price: 2280,
      total: 5700,
      timestamp: new Date(Date.now() - 172800000),
      source: 'Coinbase'
    },
    {
      id: '3',
      type: 'transfer' as const,
      asset: 'SOL',
      amount: 50,
      price: 104,
      total: 5200,
      timestamp: new Date(Date.now() - 259200000),
      source: 'MetaMask'
    },
  ];

  return (
    <div className="p-6">
      <TransactionHistory transactions={mockTransactions} />
    </div>
  );
}
