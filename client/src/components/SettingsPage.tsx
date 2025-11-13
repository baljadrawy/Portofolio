import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
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
  onAddConnection?: (type: 'wallet' | 'exchange') => void;
  onRemoveConnection?: (id: string) => void;
}

export function SettingsPage({ connections, onAddConnection, onRemoveConnection }: SettingsPageProps) {
  const [newWalletAddress, setNewWalletAddress] = useState('');
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
            <Label htmlFor="wallet-address">Wallet Address</Label>
            <div className="flex gap-2">
              <Input
                id="wallet-address"
                placeholder="Enter MetaMask, Solflare, or other wallet address"
                value={newWalletAddress}
                onChange={(e) => setNewWalletAddress(e.target.value)}
                data-testid="input-wallet-address"
              />
              <Button
                onClick={() => {
                  console.log('Add wallet clicked', newWalletAddress);
                  setNewWalletAddress('');
                  onAddConnection?.('wallet');
                }}
                data-testid="button-add-wallet"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Wallet
              </Button>
            </div>
          </div>

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
              console.log('Add exchange clicked');
              setNewExchangeApi('');
              setNewExchangeSecret('');
              onAddConnection?.('exchange');
            }}
            data-testid="button-add-exchange"
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
