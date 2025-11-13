# Cryptocurrency Portfolio Tracker

## Overview

A comprehensive cryptocurrency portfolio tracking application that aggregates holdings across multiple wallets and exchanges. The platform provides real-time portfolio valuation, performance analytics, transaction history, and multi-source asset management. Built with a modern React frontend and Express backend, the application emphasizes data visualization and financial clarity through a sophisticated dashboard interface inspired by professional crypto tracking platforms.

## Supported Blockchain Networks

The application supports **19 EVM-compatible blockchain networks** via Etherscan API v2, enabling automatic wallet scanning across:

**Layer 1 Networks (7):**
- **Ethereum** (Chain ID: 1) - Native token: ETH
- **BNB Smart Chain** (Chain ID: 56) - Native token: BNB
- **Polygon PoS** (Chain ID: 137) - Native token: MATIC
- **Avalanche C-Chain** (Chain ID: 43114) - Native token: AVAX
- **Fantom** (Chain ID: 250) - Native token: FTM
- **Gnosis Chain** (Chain ID: 100) - Native token: xDAI
- **Celo** (Chain ID: 42220) - Native token: CELO

**Layer 2 Networks (10):**
- **Arbitrum One** (Chain ID: 42161) - Native token: ETH
- **Arbitrum Nova** (Chain ID: 42170) - Native token: ETH
- **Optimism** (Chain ID: 10) - Native token: ETH
- **Base** (Chain ID: 8453) - Native token: ETH
- **zkSync Era** (Chain ID: 324) - Native token: ETH
- **Polygon zkEVM** (Chain ID: 1101) - Native token: ETH
- **Linea** (Chain ID: 59144) - Native token: ETH
- **Scroll** (Chain ID: 534352) - Native token: ETH
- **Blast** (Chain ID: 81457) - Native token: ETH
- **Mantle** (Chain ID: 5000) - Native token: MNT

**Polkadot/Kusama Parachains (2):**
- **Moonbeam** (Chain ID: 1284) - Native token: GLMR
- **Moonriver** (Chain ID: 1285) - Native token: MOVR

**Multi-Network Wallet Scanning:**
When adding a wallet address, the application automatically:
1. Scans all 19 networks sequentially with rate limiting to respect Etherscan API limits
2. Creates separate connections for each network containing balances or tokens
3. Refreshes existing connections before each network to prevent duplicates
4. Processes one network at a time with 700ms delays between networks
5. Handles partial failures gracefully (some networks succeed while others fail)
6. Displays clear status messages (success, partial failure, complete failure, no data)
7. Takes approximately 20-25 seconds to complete full scan

**API Integration:**
- Uses Etherscan API v2 with unified endpoint (`https://api.etherscan.io/v2/api`)
- Single API key works across all supported networks
- Each request includes `chainid` parameter to specify target network
- Supports native balance queries, token balance queries, and transaction history
- **Rate Limiting:** Free tier allows 5 requests/second; each network scan requires 3 API calls
- **Implementation:** Sequential processing with 700ms delays ensures ~4.3 req/sec average (safely under limit)

## Recent Changes (November 13, 2025)

**Wallet Connection Grouping Implementation:**
- Implemented wallet grouping by address - wallets with same address across different chains now display as single entry
- Added CHAIN_ABBREVIATIONS mapping in shared/networks.ts for compact network badges (ETH, BSC, MATIC, ARB, OP, BASE, etc.)
- Created groupConnectionsByAddress utility function in client/src/lib/groupConnections.ts:
  - Normalizes addresses to lowercase for case-insensitive grouping
  - Aggregates balances across all networks for same address
  - Prioritizes status: error > syncing > synced
  - Uses latest lastSync timestamp across all network connections
- Updated ConnectedAccounts component to display:
  - Wallet name once per address
  - Full wallet address below name
  - Network badges showing all chains where address has holdings
- Updated SettingsPage to show grouped wallets with network badges
- Dashboard and Settings both group connections by address
- Deletion now removes all network connections for grouped wallet (case-insensitive)
- Query invalidation ensures UI updates correctly after deletions

**Unified Holdings View Implementation:**
- Removed SourceFilter component from Dashboard to display all assets from all networks together
- Backend now enriches each holding with chainName from connection's chainId using CHAIN_NAMES mapping
- HoldingsTable displays network name in parentheses next to asset symbol (e.g., "BTC (Ethereum)")
- Wallet holdings show network name; exchange holdings (without chainId) show only symbol
- Asset allocation chart now aggregates by symbol across all networks
- All holdings displayed without filtering for unified portfolio view

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Tooling**
- **React with TypeScript**: Component-based UI using functional components and hooks
- **Vite**: Modern build tool providing fast development server and optimized production builds
- **Wouter**: Lightweight client-side routing (Dashboard, Settings, 404 pages)
- **TanStack Query**: Server state management with automatic caching, refetching, and optimistic updates

**UI Component System**
- **shadcn/ui**: Radix UI primitives styled with Tailwind CSS for accessible, customizable components
- **Tailwind CSS**: Utility-first styling with custom design tokens matching the cryptocurrency finance aesthetic
- **Design System**: Custom color palette (dark navy primary, royal blue accents, crypto green for gains, red for losses) with comprehensive spacing, typography, and component variants
- **Theme Support**: Light/dark mode toggle with persistent theme selection via localStorage

**State Management Pattern**
- React Query for API data fetching and caching
- Local component state (useState) for UI interactions
- Context API for theme management
- No global state management library - leveraging React Query's caching capabilities

**Key UI Components**
- PortfolioOverview: Hero section displaying total value, 24h change, profit/loss metrics
- AssetAllocationChart: Pie/donut chart visualization using Recharts
- HoldingsTable: Sortable table displaying all holdings from all networks with network name badges (e.g., "BTC (Ethereum)"), real-time price data, and performance metrics
- TransactionHistory: Transaction log with type-based categorization
- ConnectedAccounts: Management interface for wallets and exchange connections

### Backend Architecture

**Server Framework**
- **Express.js**: RESTful API server with JSON middleware
- **TypeScript**: Type-safe server implementation matching frontend types

**API Design**
- RESTful endpoints organized by resource type (connections, holdings, transactions, portfolio)
- Centralized route registration in `server/routes.ts`
- Request/response logging middleware for debugging
- Error handling with appropriate HTTP status codes

**Data Access Layer**
- Abstract `IStorage` interface defining data operations
- In-memory implementation (`MemStorage`) using Map structures for development/demo
- Separation of concerns: storage layer independent of HTTP layer
- Schema validation using Zod (via drizzle-zod) for request data

**Sample Data Strategy**
- Seed data initialization on first run creating demo wallets (MetaMask, Solflare) and exchanges (Binance)
- Pre-populated holdings and transactions for immediate UI demonstration
- Idempotent initialization checking for existing data

### Data Storage Solutions

**Database Schema (PostgreSQL via Drizzle ORM)**
- **connections**: Wallet/exchange connection metadata (id, name, type, address, API credentials, sync status)
- **holdings**: Current asset positions per connection (symbol, amount, average cost)
- **transactions**: Historical transaction records (buy/sell/transfer with timestamp, price, amount)
- UUID primary keys with CASCADE deletion for referential integrity

**ORM Strategy**
- Drizzle ORM chosen for type-safe database queries with minimal runtime overhead
- Schema-first approach with shared TypeScript types between client/server
- Migration support via drizzle-kit for schema evolution
- Neon Serverless driver for PostgreSQL connectivity

**Note**: Current implementation uses in-memory storage for demonstration. PostgreSQL schema is defined and migration-ready for production deployment.

### Authentication and Authorization

**Current State**: No authentication implemented - single-user application design

**Future Considerations**
- Session management infrastructure present (connect-pg-simple for session storage)
- User schema defined but unused
- Authentication would require session middleware and user context throughout API

### Key Architectural Decisions

**Monorepo Structure**
- **Rationale**: Shared TypeScript types between client/server prevent API contract mismatches
- **Implementation**: `/shared` directory for database schemas and validation, path aliases in tsconfig
- **Trade-offs**: Simpler deployment but requires build coordination

**In-Memory vs. Database Storage**
- **Problem**: Quick demonstration vs. persistent production data
- **Solution**: Abstract storage interface allowing swap from MemStorage to database implementation
- **Alternatives Considered**: Direct Drizzle usage throughout (rejected for demo flexibility)
- **Pros**: Instant setup, easy development testing
- **Cons**: Data lost on restart, not production-ready

**Client-Side Data Fetching**
- **Problem**: Real-time price updates and multi-source aggregation
- **Solution**: React Query with configurable refetch intervals and cache invalidation
- **Rationale**: Automatic background updates, optimistic UI updates, request deduplication
- **Trade-offs**: Client-side computation of portfolio metrics vs. server aggregation

**Component Library Choice (shadcn/ui)**
- **Problem**: Rapid UI development with customization flexibility
- **Solution**: Copy-paste component library with full source control
- **Alternatives**: Material-UI (rejected - too opinionated), Chakra UI (rejected - bundle size)
- **Pros**: No runtime dependency, full customization, tree-shakeable
- **Cons**: Manual updates, more initial setup

**Type Safety Strategy**
- **Problem**: Frontend/backend type synchronization
- **Solution**: Shared schema definitions with Zod validation and Drizzle type inference
- **Implementation**: `drizzle-zod` generates runtime validators from database schemas
- **Benefit**: Single source of truth prevents API contract drift

## External Dependencies

### Third-Party Services
- **Neon Database**: Serverless PostgreSQL hosting (configured but not actively used in current demo mode)
- **Cryptocurrency Price APIs**: Expected integration for real-time price data (currently using mock data)

### Key NPM Packages

**Frontend Core**
- `react` + `react-dom`: UI framework
- `@tanstack/react-query`: Server state and caching
- `wouter`: Routing
- `recharts`: Chart visualizations

**UI Components**
- `@radix-ui/*`: Accessible component primitives (accordion, dialog, dropdown, popover, etc.)
- `tailwindcss`: Utility-first CSS
- `class-variance-authority`: Component variant management
- `lucide-react`: Icon library

**Backend Core**
- `express`: HTTP server framework
- `drizzle-orm`: Type-safe database ORM
- `@neondatabase/serverless`: PostgreSQL driver for Neon
- `zod`: Runtime type validation

**Development Tools**
- `vite`: Build tool and dev server
- `tsx`: TypeScript execution for development
- `esbuild`: Production server bundling
- `typescript`: Type checking

**Validation & Forms**
- `react-hook-form`: Form state management
- `@hookform/resolvers`: Form validation integration
- `drizzle-zod`: Schema-to-validator conversion

### Build & Deployment Configuration
- **Development**: Vite dev server with HMR, Express API proxy
- **Production**: Vite builds static assets, esbuild bundles server to ESM
- **Environment**: NODE_ENV detection, DATABASE_URL configuration required for PostgreSQL

### Progressive Web App (PWA) Implementation

**PWA Features**
- **Installable**: Can be installed on Android devices like a native app
- **Offline Support**: Service worker caches static assets and API responses for offline access
- **App-like Experience**: Runs in standalone mode without browser UI
- **Auto-updates**: Service worker handles automatic updates when new versions deploy

**PWA Configuration**
- **Manifest**: `/manifest.json` defines app metadata, icons, and theme colors
  - App name: "CryptoTrack Portfolio"
  - Theme color: #1B1B2F (dark navy matching design system)
  - Display mode: standalone
  - Icons: 512x512, 192x192, 96x96 (generated app icons)
  
- **Service Worker**: `/sw.js` implements offline caching strategy
  - Cache version: "cryptotrack-v1"
  - Static assets: Precached on install (HTML, CSS, JS, icons)
  - API requests (/api/*): Network-first with cache fallback
  - CoinGecko API: Cache-first (stale prices acceptable when offline)
  - Navigation requests: SPA shell fallback for client-side routing
  - Only active in production mode (skipped in development to preserve HMR)

**Installation Process**
- Detailed Arabic installation guide available in `PWA_INSTALLATION.md`
- Users can install from Chrome/Edge browser on Android
- Requires HTTPS deployment (production environment)
- Works without app store distribution

**Offline Behavior**
- First load requires internet connection to cache assets
- Subsequent loads work offline using cached data
- Portfolio data shows last cached state when offline
- Real-time prices resume updating when connection restored
- Note: In-memory storage means server restart resets to demo data