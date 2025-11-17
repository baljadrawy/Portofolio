import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const holdings = pgTable("holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").references(() => connections.id, { onDelete: 'cascade' }),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  currentPrice: decimal("current_price", { precision: 20, scale: 2 }),
  avgCost: decimal("avg_cost", { precision: 20, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp("updated_at").defaultNow(),
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
});

// Insert schemas
export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true,
  lastSync: true,
});

export const insertHoldingSchema = createInsertSchema(holdings).omit({
  id: true,
  updatedAt: true,
});

export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshots).omit({
  id: true,
  timestamp: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
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
