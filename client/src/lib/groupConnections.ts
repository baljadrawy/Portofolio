import { CHAIN_ABBREVIATIONS, CHAIN_NAMES } from "@shared/networks";

interface RawConnection {
  id: string;
  name: string;
  type: string;
  address?: string | null;
  chainId?: number | null;
  status: string;
  lastSync: string | null;
}

export interface GroupedConnection {
  groupId: string;
  name: string;
  type: 'wallet' | 'exchange';
  address?: string;
  connectionIds: string[];
  status: 'synced' | 'syncing' | 'error';
  lastSync?: Date;
  balance: number;
  chainBadges?: Array<{ chainId: number; badge: string; name: string }>;
}

export function groupConnectionsByAddress(
  connections: RawConnection[],
  holdings: Array<{ connectionId: string; value: number }>
): GroupedConnection[] {
  const walletGroups = new Map<string, RawConnection[]>();
  const exchanges: RawConnection[] = [];

  connections.forEach(conn => {
    if (conn.type === 'wallet' && conn.address) {
      const normalizedAddress = conn.address.toLowerCase();
      const existing = walletGroups.get(normalizedAddress) || [];
      walletGroups.set(normalizedAddress, [...existing, conn]);
    } else {
      exchanges.push(conn);
    }
  });

  const grouped: GroupedConnection[] = [];

  walletGroups.forEach((conns, normalizedAddress) => {
    const connectionIds = conns.map(c => c.id);
    const balance = holdings
      .filter(h => connectionIds.includes(h.connectionId))
      .reduce((sum, h) => sum + h.value, 0);

    const latestSync = conns
      .map(c => c.lastSync ? new Date(c.lastSync) : null)
      .filter(d => d !== null)
      .sort((a, b) => (b?.getTime() || 0) - (a?.getTime() || 0))[0];

    const hasError = conns.some(c => c.status === 'error');
    const isSyncing = conns.some(c => c.status === 'syncing');
    const status = hasError ? 'error' : (isSyncing ? 'syncing' : 'synced');

    const chainBadges = conns
      .filter(c => c.chainId)
      .map(c => ({
        chainId: c.chainId!,
        badge: CHAIN_ABBREVIATIONS[c.chainId!] || `Chain ${c.chainId}`,
        name: CHAIN_NAMES[c.chainId!] || `Chain ${c.chainId}`
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const displayName = conns[0].name.replace(/\s*-\s*\w+$/, '').trim() || 'Wallet';
    const originalAddress = conns[0].address || normalizedAddress;

    grouped.push({
      groupId: normalizedAddress,
      name: displayName,
      type: 'wallet',
      address: originalAddress,
      connectionIds,
      status: status as 'synced' | 'syncing' | 'error',
      lastSync: latestSync || undefined,
      balance,
      chainBadges: chainBadges.length > 0 ? chainBadges : undefined
    });
  });

  exchanges.forEach(conn => {
    const balance = holdings
      .filter(h => h.connectionId === conn.id)
      .reduce((sum, h) => sum + h.value, 0);

    grouped.push({
      groupId: conn.id,
      name: conn.name,
      type: 'exchange',
      connectionIds: [conn.id],
      status: conn.status as 'synced' | 'syncing' | 'error',
      lastSync: conn.lastSync ? new Date(conn.lastSync) : undefined,
      balance
    });
  });

  return grouped;
}
