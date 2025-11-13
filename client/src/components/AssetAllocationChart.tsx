import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface AssetData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface AssetAllocationChartProps {
  assets: AssetData[];
}

const TOP_ASSETS_LIMIT = 9;

export function AssetAllocationChart({ assets }: AssetAllocationChartProps) {
  const sortedAssets = [...assets].sort((a, b) => b.value - a.value);
  
  let displayAssets: AssetData[];
  let othersCount = 0;
  
  if (sortedAssets.length > TOP_ASSETS_LIMIT) {
    const topAssets = sortedAssets.slice(0, TOP_ASSETS_LIMIT);
    const otherAssets = sortedAssets.slice(TOP_ASSETS_LIMIT);
    
    const othersValue = otherAssets.reduce((sum, asset) => sum + asset.value, 0);
    const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
    const othersPercentage = totalValue > 0 ? (othersValue / totalValue) * 100 : 0;
    
    othersCount = otherAssets.length;
    
    displayAssets = [
      ...topAssets,
      {
        name: `Others (${othersCount} assets)`,
        value: othersValue,
        percentage: othersPercentage,
        color: '#9CA3AF'
      }
    ];
  } else {
    displayAssets = sortedAssets;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Asset Allocation</h3>
        <div className="text-sm text-muted-foreground">
          {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={displayAssets}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {displayAssets.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => `$${value.toLocaleString()}`}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={60}
              wrapperStyle={{
                paddingTop: '10px',
                fontSize: '12px',
                maxHeight: '60px',
                overflowY: 'auto'
              }}
              formatter={(value, entry: any) => (
                <span className="text-xs">
                  {value} ({entry.payload.percentage.toFixed(1)}%)
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
