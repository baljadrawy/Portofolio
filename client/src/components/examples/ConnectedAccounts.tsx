import { ConnectedAccounts } from '../ConnectedAccounts';

export default function ConnectedAccountsExample() {
  const mockAccounts = [
    {
      id: '1',
      name: 'MetaMask Wallet',
      type: 'wallet' as const,
      icon: 'metamask',
      status: 'synced' as const,
      lastSync: new Date(),
      balance: 54320
    },
    {
      id: '2',
      name: 'Binance',
      type: 'exchange' as const,
      icon: 'binance',
      status: 'synced' as const,
      lastSync: new Date(Date.now() - 300000),
      balance: 42150
    },
    {
      id: '3',
      name: 'Solflare Wallet',
      type: 'wallet' as const,
      icon: 'solflare',
      status: 'syncing' as const,
      balance: 15600
    },
  ];

  return (
    <div className="p-6">
      <ConnectedAccounts
        accounts={mockAccounts}
        onDisconnect={(id) => console.log('Disconnect', id)}
      />
    </div>
  );
}
