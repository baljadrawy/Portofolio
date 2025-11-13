import { AssetAllocationChart } from '../AssetAllocationChart';

export default function AssetAllocationChartExample() {
  const mockAssets = [
    { name: 'Bitcoin', value: 45200, percentage: 42.5, color: '#F7931A' },
    { name: 'Ethereum', value: 28400, percentage: 26.7, color: '#627EEA' },
    { name: 'Solana', value: 15600, percentage: 14.7, color: '#00D4AA' },
    { name: 'Cardano', value: 8900, percentage: 8.4, color: '#0033AD' },
    { name: 'Others', value: 8200, percentage: 7.7, color: '#6B7280' },
  ];

  return (
    <div className="p-6">
      <AssetAllocationChart assets={mockAssets} />
    </div>
  );
}
