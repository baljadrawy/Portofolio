import { 
  type User, 
  type InsertUser,
  type Connection,
  type InsertConnection,
  type Holding,
  type InsertHolding,
  type Transaction,
  type InsertTransaction,
  users,
  connections,
  holdings,
  transactions
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User methods (legacy)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Connection methods
  getAllConnections(): Promise<Connection[]>;
  getConnection(id: string): Promise<Connection | undefined>;
  createConnection(connection: InsertConnection): Promise<Connection>;
  updateConnection(id: string, updates: Partial<Connection>): Promise<Connection | undefined>;
  deleteConnection(id: string): Promise<boolean>;

  // Holding methods
  getAllHoldings(): Promise<Holding[]>;
  getHoldingsByConnection(connectionId: string): Promise<Holding[]>;
  getHolding(id: string): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding): Promise<Holding>;
  updateHolding(id: string, updates: Partial<Holding>): Promise<Holding | undefined>;
  deleteHolding(id: string): Promise<boolean>;
  deleteHoldingsByConnection(connectionId: string): Promise<void>;

  // Transaction methods
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionsByConnection(connectionId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private connections: Map<string, Connection>;
  private holdings: Map<string, Holding>;
  private transactions: Map<string, Transaction>;

  constructor() {
    this.users = new Map();
    this.connections = new Map();
    this.holdings = new Map();
    this.transactions = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Connection methods
  async getAllConnections(): Promise<Connection[]> {
    return Array.from(this.connections.values());
  }

  async getConnection(id: string): Promise<Connection | undefined> {
    return this.connections.get(id);
  }

  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    const id = randomUUID();
    const connection: Connection = {
      id,
      name: insertConnection.name,
      type: insertConnection.type,
      address: insertConnection.address ?? null,
      chainId: insertConnection.chainId ?? null,
      chainNamespace: insertConnection.chainNamespace || 'evm',
      networkKey: insertConnection.networkKey ?? null,
      status: insertConnection.status || 'synced',
      lastSync: new Date(),
      createdAt: new Date(),
    };
    this.connections.set(id, connection);
    return connection;
  }

  async updateConnection(id: string, updates: Partial<Connection>): Promise<Connection | undefined> {
    const connection = this.connections.get(id);
    if (!connection) return undefined;
    
    const updated = { ...connection, ...updates };
    this.connections.set(id, updated);
    return updated;
  }

  async deleteConnection(id: string): Promise<boolean> {
    await this.deleteHoldingsByConnection(id);
    return this.connections.delete(id);
  }

  // Holding methods
  async getAllHoldings(): Promise<Holding[]> {
    return Array.from(this.holdings.values());
  }

  async getHoldingsByConnection(connectionId: string): Promise<Holding[]> {
    return Array.from(this.holdings.values()).filter(
      h => h.connectionId === connectionId
    );
  }

  async getHolding(id: string): Promise<Holding | undefined> {
    return this.holdings.get(id);
  }

  async createHolding(insertHolding: InsertHolding): Promise<Holding> {
    const id = randomUUID();
    const holding: Holding = {
      id,
      connectionId: insertHolding.connectionId ?? null,
      symbol: insertHolding.symbol,
      name: insertHolding.name,
      amount: insertHolding.amount,
      avgCost: insertHolding.avgCost ?? '0',
      updatedAt: new Date(),
    };
    this.holdings.set(id, holding);
    return holding;
  }

  async updateHolding(id: string, updates: Partial<Holding>): Promise<Holding | undefined> {
    const holding = this.holdings.get(id);
    if (!holding) return undefined;
    
    const updated = { ...holding, ...updates, updatedAt: new Date() };
    this.holdings.set(id, updated);
    return updated;
  }

  async deleteHolding(id: string): Promise<boolean> {
    return this.holdings.delete(id);
  }

  async deleteHoldingsByConnection(connectionId: string): Promise<void> {
    const holdingsToDelete = Array.from(this.holdings.values())
      .filter(h => h.connectionId === connectionId);
    
    for (const holding of holdingsToDelete) {
      this.holdings.delete(holding.id);
    }
  }

  // Transaction methods
  async getAllTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getTransactionsByConnection(connectionId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.connectionId === connectionId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      id,
      connectionId: insertTransaction.connectionId ?? null,
      type: insertTransaction.type,
      symbol: insertTransaction.symbol,
      amount: insertTransaction.amount,
      price: insertTransaction.price,
      total: insertTransaction.total,
      timestamp: insertTransaction.timestamp,
      source: insertTransaction.source,
    };
    this.transactions.set(id, transaction);
    return transaction;
  }
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Connection methods
  async getAllConnections(): Promise<Connection[]> {
    return await db.select().from(connections);
  }

  async getConnection(id: string): Promise<Connection | undefined> {
    const [connection] = await db.select().from(connections).where(eq(connections.id, id));
    return connection || undefined;
  }

  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    const [connection] = await db.insert(connections).values(insertConnection).returning();
    return connection;
  }

  async updateConnection(id: string, updates: Partial<Connection>): Promise<Connection | undefined> {
    const [updated] = await db
      .update(connections)
      .set(updates)
      .where(eq(connections.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteConnection(id: string): Promise<boolean> {
    await this.deleteHoldingsByConnection(id);
    const result = await db.delete(connections).where(eq(connections.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Holding methods
  async getAllHoldings(): Promise<Holding[]> {
    return await db.select().from(holdings);
  }

  async getHoldingsByConnection(connectionId: string): Promise<Holding[]> {
    return await db.select().from(holdings).where(eq(holdings.connectionId, connectionId));
  }

  async getHolding(id: string): Promise<Holding | undefined> {
    const [holding] = await db.select().from(holdings).where(eq(holdings.id, id));
    return holding || undefined;
  }

  async createHolding(insertHolding: InsertHolding): Promise<Holding> {
    const [holding] = await db.insert(holdings).values(insertHolding).returning();
    return holding;
  }

  async updateHolding(id: string, updates: Partial<Holding>): Promise<Holding | undefined> {
    const [updated] = await db
      .update(holdings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(holdings.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteHolding(id: string): Promise<boolean> {
    const result = await db.delete(holdings).where(eq(holdings.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async deleteHoldingsByConnection(connectionId: string): Promise<void> {
    await db.delete(holdings).where(eq(holdings.connectionId, connectionId));
  }

  // Transaction methods
  async getAllTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).orderBy(desc(transactions.timestamp));
  }

  async getTransactionsByConnection(connectionId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.connectionId, connectionId))
      .orderBy(desc(transactions.timestamp));
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }
}

export const storage = new DatabaseStorage();
