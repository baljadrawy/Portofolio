import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Wallet, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  chainName?: string;
  connectionName?: string;
  connectionType?: string;
}

interface HoldingsTableProps {
  holdings: Holding[];
}

type SortKey = 'symbol' | 'value' | 'change24h' | 'profitLoss';

const ITEMS_PER_PAGE = 100;

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDesc, setSortDesc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedConnection, setSelectedConnection] = useState<string>('all');

  // Get unique connections for filter
  const uniqueConnections = useMemo(() => {
    const connections = new Set<string>();
    holdings.forEach(h => {
      if (h.connectionName) {
        connections.add(h.connectionName);
      }
    });
    return Array.from(connections).sort();
  }, [holdings]);

  // Filter holdings by selected connection
  const filteredHoldings = useMemo(() => {
    if (selectedConnection === 'all') {
      return holdings;
    }
    return holdings.filter(h => h.connectionName === selectedConnection);
  }, [holdings, selectedConnection]);

  const sortedHoldings = [...filteredHoldings].sort((a, b) => {
    const multiplier = sortDesc ? -1 : 1;
    return multiplier * (a[sortKey] > b[sortKey] ? 1 : -1);
  });

  const totalPages = Math.ceil(sortedHoldings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedHoldings = sortedHoldings.slice(startIndex, endIndex);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
    setCurrentPage(1);
  };

  const handleConnectionChange = (value: string) => {
    setSelectedConnection(value);
    setCurrentPage(1);
  };

  // Auto-reset filter to "all" when selected connection has no holdings
  useEffect(() => {
    if (selectedConnection !== 'all' && filteredHoldings.length === 0 && holdings.length > 0) {
      setSelectedConnection('all');
      setCurrentPage(1);
    }
  }, [selectedConnection, filteredHoldings.length, holdings.length]);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Holdings</h3>
        <div className="flex items-center gap-3">
          {uniqueConnections.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedConnection} onValueChange={handleConnectionChange}>
                <SelectTrigger className="w-[200px]" data-testid="select-wallet-filter">
                  <SelectValue placeholder="All Wallets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-all-connections">All Wallets</SelectItem>
                  {uniqueConnections.map((connection) => (
                    <SelectItem key={connection} value={connection} data-testid={`option-connection-${connection}`}>
                      {connection}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="text-sm text-muted-foreground" data-testid="text-assets-count">
            {filteredHoldings.length} {filteredHoldings.length === holdings.length ? 'assets' : `of ${holdings.length} assets`}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
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
              {paginatedHoldings.length > 0 ? (
                paginatedHoldings.map((holding) => (
                  <TableRow key={holding.id} data-testid={`row-holding-${holding.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-semibold">
                          {holding.symbol}
                          {holding.chainName && (
                            <span className="text-xs text-muted-foreground ml-2">({holding.chainName})</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{holding.name}</div>
                        {holding.connectionName && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1" data-testid={`text-connection-${holding.id}`}>
                            <Wallet className="h-3 w-3" />
                            {holding.connectionName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{holding.amount.toFixed(8)}</TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono">${holding.avgCost.toLocaleString()}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${holding.currentPrice >= 1 
                        ? holding.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : holding.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`flex items-center justify-end gap-1 ${holding.change24h >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {holding.change24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span className="font-semibold">{holding.change24h >= 0 ? '+' : ''}{holding.change24h.toFixed(2)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      ${holding.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="text-muted-foreground" data-testid="text-no-filtered-holdings">
                      No holdings found for this wallet. Select "All Wallets" to see all holdings.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, sortedHoldings.length)} of {sortedHoldings.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              data-testid="button-previous-page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
