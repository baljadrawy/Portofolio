import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const connections = pgTable("connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'wallet' or 'exchange'
  address: text("address"), // wallet address or exchange identifier
  chainId: integer("chain_id"), // EVM chain ID (1=Ethereum, 56=BSC, 137=Polygon, 8453=Base)
  chainNamespace: text("chain_namespace").notNull().default('evm'), // 'evm' or 'solana'
  networkKey: text("network_key"), // For non-EVM networks like 'solana'
  status: text("status").notNull().default('synced'), // 'synced', 'syncing', 'error'
  lastSync: timestamp("last_sync"),
  lastBlockScanned: integer("last_block_scanned"), // Last block number scanned for transactions (incremental sync)
  lastTokenScan: timestamp("last_token_scan"), // Last time tokens were scanned
  createdAt: timestamp("created_at").defaultNow(),
});

export const holdings = pgTable("holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").references(() => connections.id, { onDelete: 'cascade' }),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 30, scale: 8 }).notNull(),
  currentPrice: decimal("current_price", { precision: 20, scale: 8 }),
  avgCost: decimal("avg_cost", { precision: 20, scale: 8 }).notNull().default('0'),
  updatedAt: timestamp("updated_at").defaultNow(),

  // ── Canonical identity (Phase 0B) — additive, nullable, non-breaking.
  // `symbol` above stays as the legacy/display field; it is NOT an identity.
  assetId: varchar("asset_id").references(() => assets.id, { onDelete: 'set null' }),
  // RESOLVED | AMBIGUOUS | UNRESOLVED | DEPRECATED
  identityStatus: text("identity_status").notNull().default('UNRESOLVED'),
  // CONTRACT_EXACT | MINT_EXACT | PROVIDER_ID | NATIVE_CHAIN | MANUAL | LEGACY_SYMBOL
  resolutionMethod: text("resolution_method"),
  // A manually verified mapping is never silently overwritten by a heuristic.
  manualOverride: boolean("manual_override").notNull().default(false),

  // ── Source provenance — what the source actually reported, kept verbatim
  // so an identity decision stays auditable after any future remapping.
  sourceContractAddress: text("source_contract_address"),
  sourceChainId: integer("source_chain_id"),
  sourceNetworkFamily: text("source_network_family"),
});

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  totalValue: decimal("total_value", { precision: 20, scale: 2 }).notNull(),
  totalChange24h: decimal("total_change_24h", { precision: 10, scale: 2 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").references(() => connections.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'buy', 'sell', 'transfer'
  symbol: text("symbol").notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  price: decimal("price", { precision: 20, scale: 2 }).notNull(),
  total: decimal("total", { precision: 20, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  source: text("source").notNull(),

  // ── Canonical identity (Phase 0B) — additive and nullable. Historical rows
  // keep their original `symbol`; nothing about past transactions is rewritten.
  assetId: varchar("asset_id").references(() => assets.id, { onDelete: 'set null' }),
  identityStatus: text("identity_status").notNull().default('UNRESOLVED'),
  sourceContractAddress: text("source_contract_address"),
  sourceChainId: integer("source_chain_id"),
});


// ─────────────────────────────────────────────────────────────────────────────
// Canonical Asset Identity (Phase 0B)
//
// A holding's `symbol` is display text, never an identity. Identity lives here.
// Nothing below changes the meaning of holdings/transactions; every link is
// additive and nullable so the tracker keeps working for unresolved assets.
// ─────────────────────────────────────────────────────────────────────────────

// The economic asset. Stable for the life of the asset — a rebrand updates this
// row, it does not create a new one, so history is never orphaned.
export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  canonicalSymbol: text("canonical_symbol").notNull(),
  canonicalName: text("canonical_name").notNull(),
  // NATIVE | TOKEN | WRAPPED | BRIDGED | LP | SYNTHETIC | UNKNOWN
  assetType: text("asset_type").notNull().default('UNKNOWN'),
  // CANONICAL | ALIAS | UNRESOLVED | DISPUTED | BLOCKED
  status: text("status").notNull().default('CANONICAL'),
  // When status = ALIAS, the canonical row this defers to.
  canonicalAssetId: varchar("canonical_asset_id"),
  // Home chain for a native asset (1 = Ethereum). NULL for multi-chain tokens.
  nativeChainId: integer("native_chain_id"),
  // Groups rows representing the same economic exposure across chains and
  // wrappings, so portfolio concentration is not understated.
  economicGroup: text("economic_group"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Where an asset exists on a specific chain. One asset -> many identities.
// Identity key is (network_family, chain_id, address_key) — never the symbol.
export const assetNetworkIdentities = pgTable("asset_network_identities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: 'cascade' }),
  // 'evm' | 'solana' — mirrors connections.chain_namespace
  networkFamily: text("network_family").notNull(),
  chainId: integer("chain_id"),          // EVM only; NULL for non-EVM
  networkKey: text("network_key"),       // e.g. 'solana'
  // Address exactly as the source provided it (checksummed EVM / real mint).
  contractAddress: text("contract_address"),
  // Normalised comparison key. EVM: lowercased. Solana: unchanged (mints are
  // case-sensitive base58). Native assets: the literal 'NATIVE'.
  // A single universal lowercase rule would corrupt Solana mint identity.
  addressKey: text("address_key").notNull(),
  isNative: boolean("is_native").notNull().default(false),
  isWrapped: boolean("is_wrapped").notNull().default(false),
  isBridged: boolean("is_bridged").notNull().default(false),
  status: text("status").notNull().default('ACTIVE'),  // ACTIVE | DEPRECATED
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  // Same address on two different chains is NOT the same token.
  uniqNetworkAddress: uniqueIndex("uniq_network_address")
    .on(t.networkFamily, t.chainId, t.addressKey),
  idxAsset: index("idx_ani_asset").on(t.assetId),
  idxLookup: index("idx_ani_lookup").on(t.networkFamily, t.addressKey),
}));

// External provider IDs. Deliberately a side table: no provider's ID is ever
// the internal asset_id, so a provider can be replaced without a migration.
export const assetProviderMappings = pgTable("asset_provider_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: 'cascade' }),
  provider: text("provider").notNull(),          // coingecko | coinmarketcap | ...
  providerAssetId: text("provider_asset_id").notNull(),
  providerSymbol: text("provider_symbol"),
  status: text("status").notNull().default('ACTIVE'),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  uniqProviderAsset: uniqueIndex("uniq_provider_asset").on(t.provider, t.providerAssetId),
  idxAsset: index("idx_apm_asset").on(t.assetId),
}));

// Historical symbols/names, provider aliases, and rebrands. MATIC -> POL is
// data here, not a branch in business logic.
export const assetAliases = pgTable("asset_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: 'cascade' }),
  // SYMBOL | NAME | PROVIDER_SYMBOL | MIGRATION_SYMBOL
  aliasType: text("alias_type").notNull(),
  aliasValue: text("alias_value").notNull(),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),   // NULL = still current
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxLookup: index("idx_alias_lookup").on(t.aliasType, t.aliasValue),
  idxAsset: index("idx_alias_asset").on(t.assetId),
}));

export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssetNetworkIdentitySchema = createInsertSchema(assetNetworkIdentities).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssetProviderMappingSchema = createInsertSchema(assetProviderMappings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssetAliasSchema = createInsertSchema(assetAliases).omit({ id: true, createdAt: true });

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type AssetNetworkIdentity = typeof assetNetworkIdentities.$inferSelect;
export type InsertAssetNetworkIdentity = z.infer<typeof insertAssetNetworkIdentitySchema>;
export type AssetProviderMapping = typeof assetProviderMappings.$inferSelect;
export type InsertAssetProviderMapping = z.infer<typeof insertAssetProviderMappingSchema>;
export type AssetAlias = typeof assetAliases.$inferSelect;
export type InsertAssetAlias = z.infer<typeof insertAssetAliasSchema>;


// ─────────────────────────────────────────────────────────────────────────────
// Evidence Core (Phase 1)
//
// Every fact used in reasoning lives here with full provenance. Evidence is
// keyed on asset_id (canonical identity), never on symbol.
//
// Append-oriented: a new observation is a NEW row. Historical evidence is never
// silently rewritten — corrections arrive as new rows and the old row is marked
// SUPERSEDED or RETRACTED, so the audit trail survives.
// ─────────────────────────────────────────────────────────────────────────────

// Registry so a source is an entity with a tier and status, not a loose string
// repeated across thousands of evidence rows.
export const evidenceSources = pgTable("evidence_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull(),                 // 'coingecko', 'security:palisade'
  name: text("name").notNull(),
  // API | ONCHAIN | DOCUMENT | ARTICLE | SOCIAL | FILING | SECURITY_PROVIDER
  sourceType: text("source_type").notNull(),
  tier: integer("tier").notNull(),            // 1..5
  authority: text("authority"),               // what it is authoritative ABOUT
  status: text("status").notNull().default('ACTIVE'),  // ACTIVE | DISABLED | DEPRECATED
  defaultFreshnessPolicy: text("default_freshness_policy"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  uniqKey: uniqueIndex("uniq_evidence_source_key").on(t.key),
}));

export const evidence = pgTable("evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Canonical identity. NULL = market-wide evidence with no single asset.
  assetId: varchar("asset_id").references(() => assets.id, { onDelete: 'set null' }),

  category: text("category").notNull(),        // PRICE | SECURITY | ...
  evidenceType: text("evidence_type").notNull(),  // HONEYPOT_INDICATOR, TVL, ...

  sourceId: varchar("source_id").notNull().references(() => evidenceSources.id),
  sourceKey: text("source_key").notNull(),     // denormalised for hashing
  sourceType: text("source_type").notNull(),
  sourceTier: integer("source_tier").notNull(),

  // Three distinct times. They are NOT interchangeable:
  //   observedAt  — when the fact was true / measured at the source
  //   effectiveAt — when it comes into force (a rule announced now, live later)
  //   retrievedAt — when WE obtained it (bounds historical replay)
  observedAt: timestamp("observed_at"),
  effectiveAt: timestamp("effective_at"),
  retrievedAt: timestamp("retrieved_at").notNull().defaultNow(),

  // Snapshot of freshness AT WRITE TIME, kept only for audit. Live freshness is
  // always recomputed; storing a bare status would let it silently rot.
  freshnessStatus: text("freshness_status"),
  freshnessCalculatedAt: timestamp("freshness_calculated_at"),
  freshnessPolicyVersion: text("freshness_policy_version"),

  // Reliability inputs. NOT an LLM-produced number.
  reliability: integer("reliability"),
  reliabilityBasis: text("reliability_basis"),

  // Raw is never overwritten by normalization.
  rawValue: text("raw_value"),
  normalizedValue: text("normalized_value"),
  normalizedUnit: text("normalized_unit"),
  normalizerVersion: text("normalizer_version"),

  evidenceHash: text("evidence_hash").notNull(),
  hashVersion: text("hash_version").notNull(),

  // ACTIVE | SUPERSEDED | RETRACTED | INVALID | CONFLICTING
  status: text("status").notNull().default('ACTIVE'),
  supersededById: varchar("superseded_by_id"),
  parentEvidenceId: varchar("parent_evidence_id"),
  conflictsWithId: varchar("conflicts_with_id"),
  statusReason: text("status_reason"),

  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  // Dedup is scoped to (source, hash) — a DIFFERENT source asserting the same
  // hash is corroboration and must be allowed through.
  uniqSourceHash: uniqueIndex("uniq_evidence_source_hash").on(t.sourceKey, t.evidenceHash),
  idxAsset: index("idx_evidence_asset").on(t.assetId),
  idxAssetCategory: index("idx_evidence_asset_category").on(t.assetId, t.category),
  idxRetrieved: index("idx_evidence_retrieved").on(t.retrievedAt),
  idxStatus: index("idx_evidence_status").on(t.status),
}));

// A frozen evidence set. Named evidence_snapshots to avoid colliding with the
// pre-existing portfolio_snapshots, which records portfolio VALUE over time.
export const evidenceSnapshots = pgTable("evidence_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").references(() => assets.id, { onDelete: 'set null' }),
  asOf: timestamp("as_of").notNull(),
  specVersion: text("spec_version").notNull(),
  freshnessPolicyVersion: text("freshness_policy_version").notNull(),
  // DRAFT | FINALIZED. Once FINALIZED the set is immutable; newer evidence
  // requires a NEW snapshot, which is what makes an analysis reproducible.
  status: text("status").notNull().default('DRAFT'),
  coverageReport: text("coverage_report"),
  finalizedAt: timestamp("finalized_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  idxAsset: index("idx_evsnap_asset").on(t.assetId),
}));

export const evidenceSnapshotItems = pgTable("evidence_snapshot_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").notNull().references(() => evidenceSnapshots.id, { onDelete: 'cascade' }),
  evidenceId: varchar("evidence_id").notNull().references(() => evidence.id, { onDelete: 'restrict' }),
  // Freshness as it was AT as_of — recomputing later would rewrite history.
  freshnessAtSnapshot: text("freshness_at_snapshot").notNull(),
  includedReason: text("included_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqItem: uniqueIndex("uniq_snapshot_evidence").on(t.snapshotId, t.evidenceId),
  idxSnapshot: index("idx_evsnapitem_snapshot").on(t.snapshotId),
}));

export const insertEvidenceSourceSchema = createInsertSchema(evidenceSources).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEvidenceSchema = createInsertSchema(evidence).omit({ id: true, createdAt: true });
export const insertEvidenceSnapshotSchema = createInsertSchema(evidenceSnapshots).omit({ id: true, createdAt: true });

export type EvidenceSource = typeof evidenceSources.$inferSelect;
export type InsertEvidenceSource = z.infer<typeof insertEvidenceSourceSchema>;
export type Evidence = typeof evidence.$inferSelect;
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type EvidenceSnapshot = typeof evidenceSnapshots.$inferSelect;
export type EvidenceSnapshotItem = typeof evidenceSnapshotItems.$inferSelect;

// Insert schemas
export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true,
  lastSync: true,
});

export const insertHoldingSchema = createInsertSchema(holdings).omit({
  id: true,
  updatedAt: true,
  identityStatus: true,
  resolutionMethod: true,
  manualOverride: true,
});

export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshots).omit({
  id: true,
  timestamp: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  identityStatus: true,
});

// Types
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;

export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type Holding = typeof holdings.$inferSelect;

export type InsertPortfolioSnapshot = z.infer<typeof insertPortfolioSnapshotSchema>;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Keep legacy user schema for backward compatibility
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
