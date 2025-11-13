import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Holding {
  id: string;
  connectionId?: string | null;
  symbol: string;
  name: string;
  amount: number;
  avgCost: number;
  currentPrice: number;
  change24h: number;
  change24hValue: number;
  value: number;
  profitLoss: number;
  profitLossPercent: number;
}

interface HoldingsTableProps {
  holdings: Holding[];
}

type SortKey = 'symbol' | 'value' | 'change24h' | 'profitLoss';

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDesc, setSortDesc] = useState(true);

  const sortedHoldings = [...holdings].sort((a, b) => {
    const multiplier = sortDesc ? -1 : 1;
    return multiplier * (a[sortKey] > b[sortKey] ? 1 : -1);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Holdings</h3>
        <div className="text-sm text-muted-foreground">{holdings.length} assets</div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => handleSort('symbol')}
                  data-testid="button-sort-asset"
                >
                  Asset
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Avg Cost</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => handleSort('change24h')}
                  data-testid="button-sort-24h"
                >
                  24h
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => handleSort('value')}
                  data-testid="button-sort-value"
                >
                  Value
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => handleSort('profitLoss')}
                  data-testid="button-sort-profit"
                >
                  Profit/Loss
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHoldings.map((holding) => (
              <TableRow key={holding.id} data-testid={`row-holding-${holding.id}`}>
                <TableCell>
                  <div>
                    <div className="font-semibold">{holding.symbol}</div>
                    <div className="text-sm text-muted-foreground">{holding.name}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">{holding.amount.toFixed(8)}</TableCell>
                <TableCell className="text-right">
                  <div className="font-mono">${holding.avgCost.toLocaleString()}</div>
                </TableCell>
                <TableCell className="text-right font-mono">${holding.currentPrice.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <div className={`flex items-center justify-end gap-1 ${holding.change24h >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {holding.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span className="font-semibold">{holding.change24h >= 0 ? '+' : ''}{holding.change24h.toFixed(2)}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">${holding.value.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <div className={`font-semibold font-mono ${holding.profitLoss >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {holding.profitLoss >= 0 ? '+' : ''}${Math.abs(holding.profitLoss).toLocaleString()}
                    </div>
                    <Badge variant={holding.profitLoss >= 0 ? 'default' : 'destructive'} className="mt-1">
                      {holding.profitLoss >= 0 ? '+' : ''}{holding.profitLossPercent.toFixed(2)}%
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
