import { SettingsPage } from '../SettingsPage';

export default function SettingsPageExample() {
  const mockConnections = [
    { id: '1', name: 'MetaMask', type: 'wallet' as const, hasApiKey: false },
    { id: '2', name: 'Binance', type: 'exchange' as const, hasApiKey: true },
    { id: '3', name: 'Solflare', type: 'wallet' as const, hasApiKey: false },
  ];

  return (
    <div className="p-6">
      <SettingsPage
        connections={mockConnections}
        onAddConnection={(type) => console.log('Add connection', type)}
        onRemoveConnection={(id) => console.log('Remove connection', id)}
      />
    </div>
  );
}
