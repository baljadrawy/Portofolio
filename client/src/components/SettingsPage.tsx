import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export interface ApiConnection {
  id: string;
  name: string;
  type: 'wallet' | 'exchange';
  hasApiKey: boolean;
}

interface SettingsPageProps {
  connections: ApiConnection[];
  onAddConnection?: (type: 'wallet' | 'exchange', data: { name?: string; address?: string; apiKey?: string; apiSecret?: string }) => void;
  onRemoveConnection?: (id: string) => void;
  onSyncWallet?: (connectionId: string) => void;
}

export function SettingsPage({ connections, onAddConnection, onRemoveConnection, onSyncWallet }: SettingsPageProps) {
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newExchangeName, setNewExchangeName] = useState('');
  const [newExchangeApi, setNewExchangeApi] = useState('');
  const [newExchangeSecret, setNewExchangeSecret] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Settings</h2>
        <p className="text-muted-foreground">Manage your connected wallets and exchange APIs</p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Connected Wallets</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wallet-name">Wallet Name</Label>
            <Input
              id="wallet-name"
              placeholder="e.g., My Main MetaMask Wallet"
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value)}
              data-testid="input-wallet-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet-address">Wallet Address</Label>
            <Input
              id="wallet-address"
              placeholder="Enter MetaMask, Solflare, or other wallet address"
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
              data-testid="input-wallet-address"
            />
          </div>
          <Button
            onClick={() => {
              const trimmedName = newWalletName.trim();
              const trimmedAddress = newWalletAddress.trim();
              
              if (!trimmedName || !trimmedAddress) {
                return;
              }
              
              onAddConnection?.('wallet', {
                name: trimmedName,
                address: trimmedAddress
              });
              setNewWalletName('');
              setNewWalletAddress('');
            }}
            disabled={!newWalletName.trim() || !newWalletAddress.trim()}
            data-testid="button-add-wallet"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Wallet
          </Button>

          <div className="space-y-2">
            {connections
              .filter(c => c.type === 'wallet')
              .map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-3 border border-border rounded-md"
                  data-testid={`wallet-${connection.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                      <span className="text-success font-semibold">W</span>
                    </div>
                    <div>
                      <div className="font-semibold">{connection.name}</div>
                      <div className="text-sm text-muted-foreground">Wallet</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onSyncWallet?.(connection.id)}
                      data-testid={`button-sync-${connection.id}`}
                    >
                      <RefreshCw className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        console.log('Remove wallet', connection.id);
                        onRemoveConnection?.(connection.id);
                      }}
                      data-testid={`button-remove-${connection.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Exchange API Connections</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exchange-name">Exchange Name</Label>
            <Input
              id="exchange-name"
              placeholder="e.g., Binance, Coinbase, Kraken"
              value={newExchangeName}
              onChange={(e) => setNewExchangeName(e.target.value)}
              data-testid="input-exchange-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your exchange API key"
              value={newExchangeApi}
              onChange={(e) => setNewExchangeApi(e.target.value)}
              data-testid="input-api-key"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-secret">API Secret</Label>
            <Input
              id="api-secret"
              type="password"
              placeholder="Enter your exchange API secret"
              value={newExchangeSecret}
              onChange={(e) => setNewExchangeSecret(e.target.value)}
              data-testid="input-api-secret"
            />
          </div>
          <Button
            onClick={() => {
              const trimmedName = newExchangeName.trim();
              const trimmedApiKey = newExchangeApi.trim();
              const trimmedApiSecret = newExchangeSecret.trim();
              
              if (!trimmedName) {
                return;
              }
              
              onAddConnection?.('exchange', {
                name: trimmedName,
                apiKey: trimmedApiKey || undefined,
                apiSecret: trimmedApiSecret || undefined
              });
              setNewExchangeName('');
              setNewExchangeApi('');
              setNewExchangeSecret('');
            }}
            disabled={!newExchangeName.trim()}
            data-testid="button-add-exchange"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Connect Exchange
          </Button>

          <div className="space-y-2 mt-4">
            {connections
              .filter(c => c.type === 'exchange')
              .map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-3 border border-border rounded-md"
                  data-testid={`exchange-${connection.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-semibold">E</span>
                    </div>
                    <div>
                      <div className="font-semibold">{connection.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        Exchange
                        {connection.hasApiKey && <Badge variant="secondary">API Connected</Badge>}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      console.log('Remove exchange', connection.id);
                      onRemoveConnection?.(connection.id);
                    }}
                    data-testid={`button-remove-${connection.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
