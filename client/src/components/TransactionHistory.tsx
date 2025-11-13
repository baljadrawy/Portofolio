import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'transfer';
  asset: string;
  amount: number;
  price: number;
  total: number;
  timestamp: Date;
  source: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const [filter, setFilter] = useState<'all' | 'buy' | 'sell' | 'transfer'>('all');

  const filteredTransactions = filter === 'all'
    ? transactions
    : transactions.filter(t => t.type === filter);

  const getTypeIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'buy':
        return <ArrowDownLeft className="h-4 w-4 text-success" />;
      case 'sell':
        return <ArrowUpRight className="h-4 w-4 text-destructive" />;
      case 'transfer':
        return <ArrowLeftRight className="h-4 w-4 text-warning" />;
    }
  };

  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'buy':
        return 'text-success';
      case 'sell':
        return 'text-destructive';
      case 'transfer':
        return 'text-warning';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Transaction History</h3>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            data-testid="button-filter-all"
          >
            All
          </Button>
          <Button
            variant={filter === 'buy' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('buy')}
            data-testid="button-filter-buy"
          >
            Buys
          </Button>
          <Button
            variant={filter === 'sell' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('sell')}
            data-testid="button-filter-sell"
          >
            Sells
          </Button>
          <Button
            variant={filter === 'transfer' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('transfer')}
            data-testid="button-filter-transfer"
          >
            Transfers
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {filteredTransactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between p-4 rounded-md border border-border hover-elevate"
            data-testid={`transaction-${tx.id}`}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                {getTypeIcon(tx.type)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold capitalize">{tx.type}</span>
                  <span className="font-semibold">{tx.asset}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {tx.timestamp.toLocaleDateString()} • {tx.timestamp.toLocaleTimeString()} • {tx.source}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold font-mono">
                {tx.amount} {tx.asset}
              </div>
              <div className="text-sm text-muted-foreground">
                @ ${tx.price.toLocaleString()}
              </div>
              <div className={`text-sm font-semibold font-mono ${getTypeColor(tx.type)}`}>
                ${tx.total.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
