import { useState } from "react";
import { SettingsPage, type ApiConnection } from "@/components/SettingsPage";

export default function Settings() {
  // TODO: remove mock functionality - replace with real API calls
  const [connections, setConnections] = useState<ApiConnection[]>([
    { id: '1', name: 'MetaMask', type: 'wallet', hasApiKey: false },
    { id: '2', name: 'Binance', type: 'exchange', hasApiKey: true },
    { id: '3', name: 'Solflare', type: 'wallet', hasApiKey: false },
  ]);

  const handleAddConnection = (type: 'wallet' | 'exchange') => {
    const newId = (connections.length + 1).toString();
    const newName = type === 'wallet' ? `Wallet ${newId}` : `Exchange ${newId}`;
    setConnections([...connections, {
      id: newId,
      name: newName,
      type,
      hasApiKey: type === 'exchange'
    }]);
  };

  const handleRemoveConnection = (id: string) => {
    setConnections(connections.filter(c => c.id !== id));
  };

  return (
    <SettingsPage
      connections={connections}
      onAddConnection={handleAddConnection}
      onRemoveConnection={handleRemoveConnection}
    />
  );
}
