export const SUPPORTED_CHAINS = {
  // Layer 1 Networks
  ETHEREUM: 1,
  BSC: 56,
  POLYGON: 137,
  AVALANCHE: 43114,
  FANTOM: 250,
  GNOSIS: 100,
  CELO: 42220,
  
  // Layer 2 Networks - Ethereum
  ARBITRUM_ONE: 42161,
  ARBITRUM_NOVA: 42170,
  OPTIMISM: 10,
  BASE: 8453,
  ZKSYNC_ERA: 324,
  POLYGON_ZKEVM: 1101,
  LINEA: 59144,
  SCROLL: 534352,
  BLAST: 81457,
  MANTLE: 5000,
  
  // Polkadot/Kusama Parachains
  MOONBEAM: 1284,
  MOONRIVER: 1285,
} as const;

export type ChainId = typeof SUPPORTED_CHAINS[keyof typeof SUPPORTED_CHAINS];

export const CHAIN_NAMES: Record<number, string> = {
  // Layer 1
  [SUPPORTED_CHAINS.ETHEREUM]: 'Ethereum',
  [SUPPORTED_CHAINS.BSC]: 'BNB Smart Chain',
  [SUPPORTED_CHAINS.POLYGON]: 'Polygon',
  [SUPPORTED_CHAINS.AVALANCHE]: 'Avalanche C-Chain',
  [SUPPORTED_CHAINS.FANTOM]: 'Fantom',
  [SUPPORTED_CHAINS.GNOSIS]: 'Gnosis Chain',
  [SUPPORTED_CHAINS.CELO]: 'Celo',
  
  // Layer 2
  [SUPPORTED_CHAINS.ARBITRUM_ONE]: 'Arbitrum One',
  [SUPPORTED_CHAINS.ARBITRUM_NOVA]: 'Arbitrum Nova',
  [SUPPORTED_CHAINS.OPTIMISM]: 'Optimism',
  [SUPPORTED_CHAINS.BASE]: 'Base',
  [SUPPORTED_CHAINS.ZKSYNC_ERA]: 'zkSync Era',
  [SUPPORTED_CHAINS.POLYGON_ZKEVM]: 'Polygon zkEVM',
  [SUPPORTED_CHAINS.LINEA]: 'Linea',
  [SUPPORTED_CHAINS.SCROLL]: 'Scroll',
  [SUPPORTED_CHAINS.BLAST]: 'Blast',
  [SUPPORTED_CHAINS.MANTLE]: 'Mantle',
  
  // Parachains
  [SUPPORTED_CHAINS.MOONBEAM]: 'Moonbeam',
  [SUPPORTED_CHAINS.MOONRIVER]: 'Moonriver',
};

export const NATIVE_TOKENS: Record<number, { symbol: string; name: string }> = {
  // Layer 1
  [SUPPORTED_CHAINS.ETHEREUM]: { symbol: 'ETH', name: 'Ethereum' },
  [SUPPORTED_CHAINS.BSC]: { symbol: 'BNB', name: 'BNB' },
  [SUPPORTED_CHAINS.POLYGON]: { symbol: 'MATIC', name: 'Polygon' },
  [SUPPORTED_CHAINS.AVALANCHE]: { symbol: 'AVAX', name: 'Avalanche' },
  [SUPPORTED_CHAINS.FANTOM]: { symbol: 'FTM', name: 'Fantom' },
  [SUPPORTED_CHAINS.GNOSIS]: { symbol: 'xDAI', name: 'xDAI' },
  [SUPPORTED_CHAINS.CELO]: { symbol: 'CELO', name: 'Celo' },
  
  // Layer 2
  [SUPPORTED_CHAINS.ARBITRUM_ONE]: { symbol: 'ETH', name: 'Ethereum' },
  [SUPPORTED_CHAINS.ARBITRUM_NOVA]: { symbol: 'ETH', name: 'Ethereum' },
  [SUPPORTED_CHAINS.OPTIMISM]: { symbol: 'ETH', name: 'Ethereum' },
  [SUPPORTED_CHAINS.BASE]: { symbol: 'ETH', name: 'Ethereum' },
  [SUPPORTED_CHAINS.ZKSYNC_ERA]: { symbol: 'ETH', name: 'Ethereum' },
  [SUPPORTED_CHAINS.POLYGON_ZKEVM]: { symbol: 'ETH', name: 'Ethereum' },
  [SUPPORTED_CHAINS.LINEA]: { symbol: 'ETH', name: 'Ethereum' },
  [SUPPORTED_CHAINS.SCROLL]: { symbol: 'ETH', name: 'Ethereum' },
  [SUPPORTED_CHAINS.BLAST]: { symbol: 'ETH', name: 'Ethereum' },
  [SUPPORTED_CHAINS.MANTLE]: { symbol: 'MNT', name: 'Mantle' },
  
  // Parachains
  [SUPPORTED_CHAINS.MOONBEAM]: { symbol: 'GLMR', name: 'Glimmer' },
  [SUPPORTED_CHAINS.MOONRIVER]: { symbol: 'MOVR', name: 'Moonriver' },
};

export const CHAIN_OPTIONS = [
  // Layer 1 Networks
  { value: SUPPORTED_CHAINS.ETHEREUM.toString(), label: 'Ethereum Mainnet', symbol: 'ETH', category: 'Layer 1' },
  { value: SUPPORTED_CHAINS.BSC.toString(), label: 'BNB Smart Chain', symbol: 'BNB', category: 'Layer 1' },
  { value: SUPPORTED_CHAINS.POLYGON.toString(), label: 'Polygon PoS', symbol: 'MATIC', category: 'Layer 1' },
  { value: SUPPORTED_CHAINS.AVALANCHE.toString(), label: 'Avalanche C-Chain', symbol: 'AVAX', category: 'Layer 1' },
  { value: SUPPORTED_CHAINS.FANTOM.toString(), label: 'Fantom', symbol: 'FTM', category: 'Layer 1' },
  { value: SUPPORTED_CHAINS.GNOSIS.toString(), label: 'Gnosis Chain', symbol: 'xDAI', category: 'Layer 1' },
  { value: SUPPORTED_CHAINS.CELO.toString(), label: 'Celo', symbol: 'CELO', category: 'Layer 1' },
  
  // Layer 2 Networks
  { value: SUPPORTED_CHAINS.ARBITRUM_ONE.toString(), label: 'Arbitrum One', symbol: 'ETH', category: 'Layer 2' },
  { value: SUPPORTED_CHAINS.ARBITRUM_NOVA.toString(), label: 'Arbitrum Nova', symbol: 'ETH', category: 'Layer 2' },
  { value: SUPPORTED_CHAINS.OPTIMISM.toString(), label: 'Optimism', symbol: 'ETH', category: 'Layer 2' },
  { value: SUPPORTED_CHAINS.BASE.toString(), label: 'Base', symbol: 'ETH', category: 'Layer 2' },
  { value: SUPPORTED_CHAINS.ZKSYNC_ERA.toString(), label: 'zkSync Era', symbol: 'ETH', category: 'Layer 2' },
  { value: SUPPORTED_CHAINS.POLYGON_ZKEVM.toString(), label: 'Polygon zkEVM', symbol: 'ETH', category: 'Layer 2' },
  { value: SUPPORTED_CHAINS.LINEA.toString(), label: 'Linea', symbol: 'ETH', category: 'Layer 2' },
  { value: SUPPORTED_CHAINS.SCROLL.toString(), label: 'Scroll', symbol: 'ETH', category: 'Layer 2' },
  { value: SUPPORTED_CHAINS.BLAST.toString(), label: 'Blast', symbol: 'ETH', category: 'Layer 2' },
  { value: SUPPORTED_CHAINS.MANTLE.toString(), label: 'Mantle', symbol: 'MNT', category: 'Layer 2' },
  
  // Parachains
  { value: SUPPORTED_CHAINS.MOONBEAM.toString(), label: 'Moonbeam', symbol: 'GLMR', category: 'Parachain' },
  { value: SUPPORTED_CHAINS.MOONRIVER.toString(), label: 'Moonriver', symbol: 'MOVR', category: 'Parachain' },
];
