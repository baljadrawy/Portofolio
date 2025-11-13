export const SUPPORTED_CHAINS = {
  ETHEREUM: 1,
  BSC: 56,
  POLYGON: 137,
  BASE: 8453,
} as const;

export type ChainId = typeof SUPPORTED_CHAINS[keyof typeof SUPPORTED_CHAINS];

export const CHAIN_NAMES: Record<number, string> = {
  [SUPPORTED_CHAINS.ETHEREUM]: 'Ethereum',
  [SUPPORTED_CHAINS.BSC]: 'BNB Smart Chain',
  [SUPPORTED_CHAINS.POLYGON]: 'Polygon',
  [SUPPORTED_CHAINS.BASE]: 'Base',
};

export const NATIVE_TOKENS: Record<number, { symbol: string; name: string }> = {
  [SUPPORTED_CHAINS.ETHEREUM]: { symbol: 'ETH', name: 'Ethereum' },
  [SUPPORTED_CHAINS.BSC]: { symbol: 'BNB', name: 'BNB' },
  [SUPPORTED_CHAINS.POLYGON]: { symbol: 'MATIC', name: 'Polygon' },
  [SUPPORTED_CHAINS.BASE]: { symbol: 'ETH', name: 'Ethereum' },
};

export const CHAIN_OPTIONS = [
  { value: SUPPORTED_CHAINS.ETHEREUM.toString(), label: 'Ethereum Mainnet', symbol: 'ETH' },
  { value: SUPPORTED_CHAINS.BSC.toString(), label: 'BNB Smart Chain', symbol: 'BNB' },
  { value: SUPPORTED_CHAINS.POLYGON.toString(), label: 'Polygon PoS', symbol: 'MATIC' },
  { value: SUPPORTED_CHAINS.BASE.toString(), label: 'Base', symbol: 'ETH' },
];
