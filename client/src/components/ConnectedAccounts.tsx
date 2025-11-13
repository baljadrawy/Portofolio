import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, Link as LinkIcon, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export interface ConnectedAccount {
  id: string;
  name: string;
  type: 'wallet' | 'exchange';
  icon: string;
  status: 'synced' | 'syncing' | 'error';
  lastSync?: Date;
  balance?: number;
}

interface ConnectedAccountsProps {
  accounts: ConnectedAccount[];
  onDisconnect?: (id: string) => void;
}

export function ConnectedAccounts({ accounts, onDisconnect }: ConnectedAccountsProps) {
  const getStatusIcon = (status: ConnectedAccount['status']) => {
    switch (status) {
      case 'synced':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'syncing':
        return <Loader2 className="h-4 w-4 text-warning animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusText = (status: ConnectedAccount['status']) => {
    switch (status) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Error';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Connected Accounts</h3>
        <Badge variant="secondary">{accounts.length} connected</Badge>
      </div>
      <div className="space-y-3">
        {accounts.map((account) => (
          <Card key={account.id} className="p-4" data-testid={`card-account-${account.id}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                  {account.type === 'wallet' ? (
                    <Wallet className="h-5 w-5" />
                  ) : (
                    <LinkIcon className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="font-semibold">{account.name}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {getStatusIcon(account.status)}
                    <span>{getStatusText(account.status)}</span>
                    {account.lastSync && account.status === 'synced' && (
                      <span>• {account.lastSync.toLocaleTimeString()}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {account.balance !== undefined && (
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Balance</div>
                    <div className="font-semibold font-mono">${account.balance.toLocaleString()}</div>
                  </div>
                )}
                {onDisconnect && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      console.log('Disconnect clicked for', account.id);
                      onDisconnect(account.id);
                    }}
                    data-testid={`button-disconnect-${account.id}`}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
