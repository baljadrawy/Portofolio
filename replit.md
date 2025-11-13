# Cryptocurrency Portfolio Tracker

## Overview

A comprehensive cryptocurrency portfolio tracking application that aggregates holdings across multiple wallets and exchanges. The platform provides real-time portfolio valuation, performance analytics, transaction history, and multi-source asset management. Built with a modern React frontend and Express backend, the application emphasizes data visualization and financial clarity through a sophisticated dashboard interface inspired by professional crypto tracking platforms.

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
- HoldingsTable: Sortable table with real-time price data and performance metrics
- TransactionHistory: Filterable transaction log with type-based categorization
- ConnectedAccounts: Management interface for wallets and exchange connections
- SourceFilter: Multi-select filtering for viewing specific wallet/exchange data

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