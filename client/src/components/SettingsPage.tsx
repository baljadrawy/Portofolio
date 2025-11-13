import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CHAIN_OPTIONS, SUPPORTED_CHAINS, CHAIN_NAMES } from "@shared/networks";

export interface ApiConnection {
  id: string;
  name: string;
  type: 'wallet' | 'exchange';
  chainId?: number;
  hasApiKey: boolean;
  address?: string;
  connectionIds?: string[];
  chainBadges?: Array<{ chainId: number; badge: string; name: string }>;
}

interface SettingsPageProps {
  connections: ApiConnection[];
  onAddConnection?: (type: 'wallet' | 'exchange', data: { name?: string; address?: string; chainId?: number; apiKey?: string; apiSecret?: string }) => void;
  onAddSolanaWallet?: (data: { name?: string; address: string }) => void;
  onRemoveConnection?: (id: string) => void;
  onSyncWallet?: (connectionId: string) => void;
}

export function SettingsPage({ connections, onAddConnection, onAddSolanaWallet, onRemoveConnection, onSyncWallet }: SettingsPageProps) {
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newSolanaName, setNewSolanaName] = useState('');
  const [newSolanaAddress, setNewSolanaAddress] = useState('');
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
            <Label htmlFor="wallet-name">اسم المحفظة</Label>
            <Input
              id="wallet-name"
              placeholder="مثال: محفظتي الرئيسية"
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value)}
              data-testid="input-wallet-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet-address">عنوان المحفظة</Label>
            <Input
              id="wallet-address"
              placeholder="أدخل عنوان المحفظة (0x...)"
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
              data-testid="input-wallet-address"
            />
            <p className="text-xs text-muted-foreground">
              سيتم فحص العنوان على جميع الشبكات المدعومة تلقائياً
            </p>
          </div>
          <Button
            onClick={() => {
              const trimmedAddress = newWalletAddress.trim();
              const trimmedName = newWalletName.trim();
              
              if (!trimmedAddress) {
                return;
              }
              
              onAddConnection?.('wallet', {
                name: trimmedName || undefined,
                address: trimmedAddress
              });
              setNewWalletName('');
              setNewWalletAddress('');
            }}
            disabled={!newWalletAddress.trim()}
            data-testid="button-add-wallet"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            إضافة محفظة وفحص جميع الشبكات
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
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                      <span className="text-success font-semibold">W</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{connection.name}</div>
                      {connection.address && (
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {connection.address}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        Wallet
                      </div>
                      {connection.chainBadges && connection.chainBadges.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {connection.chainBadges.map((chain) => (
                            <Badge 
                              key={chain.chainId} 
                              variant="secondary" 
                              className="text-xs"
                              title={chain.name}
                            >
                              {chain.badge}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {connection.connectionIds && connection.connectionIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onSyncWallet?.(connection.connectionIds![0])}
                        data-testid={`button-sync-${connection.id}`}
                      >
                        <RefreshCw className="h-4 w-4 text-primary" />
                      </Button>
                    )}
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
        <h3 className="text-lg font-semibold mb-4">محافظ Solana</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="solana-name">اسم المحفظة (اختياري)</Label>
            <Input
              id="solana-name"
              placeholder="مثال: محفظتي على Solana"
              value={newSolanaName}
              onChange={(e) => setNewSolanaName(e.target.value)}
              data-testid="input-solana-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="solana-address">عنوان محفظة Solana</Label>
            <Input
              id="solana-address"
              placeholder="أدخل عنوان محفظة Solana"
              value={newSolanaAddress}
              onChange={(e) => setNewSolanaAddress(e.target.value)}
              data-testid="input-solana-address"
            />
            <p className="text-xs text-muted-foreground">
              سيتم جلب رصيد SOL والعملات من شبكة Solana
            </p>
          </div>
          <Button
            onClick={() => {
              const trimmedAddress = newSolanaAddress.trim();
              const trimmedName = newSolanaName.trim();
              
              if (!trimmedAddress) {
                return;
              }
              
              onAddSolanaWallet?.({
                name: trimmedName || undefined,
                address: trimmedAddress
              });
              setNewSolanaName('');
              setNewSolanaAddress('');
            }}
            disabled={!newSolanaAddress.trim()}
            data-testid="button-add-solana"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            إضافة محفظة Solana
          </Button>
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
