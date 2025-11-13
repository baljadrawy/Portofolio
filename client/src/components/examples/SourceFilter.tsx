import { useState } from 'react';
import { SourceFilter } from '../SourceFilter';

export default function SourceFilterExample() {
  const sources = [
    { id: '1', name: 'MetaMask Wallet', type: 'wallet' as const },
    { id: '2', name: 'Binance', type: 'exchange' as const },
    { id: '3', name: 'Solflare Wallet', type: 'wallet' as const },
    { id: '4', name: 'Coinbase', type: 'exchange' as const },
  ];

  const [selectedSources, setSelectedSources] = useState<string[]>(['1', '2', '3', '4']);

  const handleToggle = (id: string) => {
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

  return (
    <div className="p-6">
      <SourceFilter
        sources={sources}
        selectedSources={selectedSources}
        onToggleSource={handleToggle}
        onSelectAll={handleSelectAll}
      />
    </div>
  );
}
