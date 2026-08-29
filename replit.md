# Cryptocurrency Portfolio Tracker

## Overview

A comprehensive cryptocurrency portfolio tracking application that aggregates holdings across multiple wallets and exchanges. The platform provides real-time portfolio valuation, performance analytics, transaction history, and multi-source asset management. It supports 19 EVM-compatible blockchain networks via Etherscan API v2 and Solana via Solscan API v2, enabling automatic wallet scanning. Key features include multi-network wallet scanning, custom wallet naming, wallet connection grouping by address, and a unified holdings view across all sources with real-time price updates and historical performance tracking. The application aims to provide data visualization and financial clarity through a sophisticated dashboard interface.

## Architecture Documentation

The architecture and roadmap for evolving this tracker into a **Portfolio
Investment Intelligence Platform** live in [`docs/`](./docs/README.md).

Start with [`docs/00-CURRENT-STATE-AUDIT.md`](./docs/00-CURRENT-STATE-AUDIT.md)
for a verified description of what exists today, then
[`docs/README.md`](./docs/README.md) for the full contract set and reading order.

Those documents are the Source of Truth for future phases. This file continues to
describe the tracker as built.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Updates

### November 18, 2025 - Scam Token Filtering & Holdings Filter
- **Comprehensive Scam Token Filtering**: Enhanced `SymbolMapper` with extensive pattern matching to filter scam/spam tokens before displaying to users. Filters URL patterns (.com, .io, .net, .org, .fi, etc.), swap scams (SHIBSWAP, SIMPSWAP, SWAP.*variants), suspicious keywords (CLAIM, AIRDROP, VERIFY, REWARD), and Unicode obfuscation characters. Reduces displayed holdings from 329 to ~138 legitimate assets.
- **Backend Filtering Integration**: Applied scam filtering to both `/api/holdings` and `/api/portfolio/summary` endpoints using `SymbolMapper.isValidSymbol()` to ensure clean data at the API level.
- **Holdings Wallet Filter**: Added dropdown filter in Holdings table to filter assets by wallet/exchange source. Filter only appears when multiple (2+) wallet connections exist, showing "All Wallets" plus individual wallet names.
- **Auto-Reset Filter Logic**: Implemented automatic filter reset to "All Wallets" when selected wallet has no holdings, preventing empty state confusion.
- **Connection Data Enrichment**: Both API endpoints now enrich holdings with `connectionName`, `connectionType`, and `chainName` for complete wallet source visibility.

### November 17, 2025 - Price System Improvements
- **Fixed Polygon (MATIC) Price Fetching**: Updated symbol mapping to reflect Polygon's rebrand from MATIC to POL in CoinMarketCap. Both MATIC and WMATIC now correctly map to POL for price lookups.
- **Enhanced Price Validation**: Added strict validation to ensure only positive prices (> 0) are stored in database, preventing null/zero price updates.
- **Improved Update Efficiency**: Optimized price update flow to skip invalid price data early in the process, reducing unnecessary database operations.

## System Architecture

### UI/UX Decisions

The application features a modern, professional crypto tracking aesthetic using `shadcn/ui` components styled with Tailwind CSS. It incorporates a custom design system with a dark navy primary, royal blue accents, and crypto green/red for performance indicators, supporting both light and dark modes with persistent theme selection.

### Technical Implementations

The application uses a monorepo structure with shared TypeScript types.

**Frontend:**
- **Framework:** React with TypeScript, Vite for bundling.
- **Routing:** Wouter for client-side routing.
- **State Management:** TanStack Query for server state and caching, local component state, and Context API for theme management.
- **Key Components:** Portfolio Overview, Asset Allocation Chart (Recharts), Holdings Table, Transaction History, and Connected Accounts management.
- **PWA:** Progressive Web App features including installability, offline support, and auto-updates.

**Backend:**
- **Framework:** Express.js with TypeScript for a RESTful API.
- **API Design:** RESTful endpoints with centralized route registration, logging, and error handling.
- **Data Access:** Abstract `IStorage` interface implemented via `DatabaseStorage` using Drizzle ORM for PostgreSQL.
- **Data Storage:** PostgreSQL database via Neon (serverless hosting) with Drizzle ORM, supporting `connections`, `holdings`, `transactions`, and `users` tables.

### Feature Specifications

- **Multi-Network Wallet Scanning:**
  - **EVM Networks:** Supports 19 EVM-compatible networks (Layer 1s: Ethereum, BNB Smart Chain, Polygon, Avalanche, Fantom, Gnosis, Celo; Layer 2s: Arbitrum One/Nova, Optimism, Base, zkSync Era, Polygon zkEVM, Linea, Scroll, Blast, Mantle; Parachains: Moonbeam, Moonriver) via Etherscan API. Handles rate limiting and partial failures.
  - **Solana Network:** Supports Solana blockchain via Solscan API v2 with dedicated UI.
- **Custom Wallet Naming:** Allows users to provide optional custom names for wallets.
- **Wallet Connection Grouping:** Groups connections by wallet address, displaying a single entry with network badges.
- **Unified Holdings View:** Aggregates all assets from all networks (EVM and Solana) into a single dashboard view, displaying network names and consolidating for allocation charts.
- **Real-Time Price Tracking:** Integrates CoinMarketCap and CoinGecko APIs for real-time cryptocurrency price data, including 24h/7d changes, market cap, and volume. Implements intelligent scam token filtering and a dual-source fetching strategy.
- **Historical Performance Tracking:** Stores historical portfolio valuations in `portfolio_snapshots` and visualizes performance over time using Recharts.
- **Exchange Integration:** Supports Binance exchange integration for centralized exchange portfolio tracking.
- **Incremental Data Fetching:** Implements smart caching and incremental transaction fetching to reduce API calls and improve efficiency.

### System Design Choices

- **Monorepo:** Facilitates shared TypeScript types between client and server.
- **Abstract Storage Layer:** Uses `IStorage` interface with `DatabaseStorage` implementation for PostgreSQL persistence.
- **Client-Side Data Fetching with React Query:** Manages real-time data updates, caching, and aggregation.
- **`shadcn/ui` Component Library:** Chosen for rapid UI development with customization flexibility.
- **Type Safety:** Achieved through shared schema definitions, Zod validation, and Drizzle type inference.

## External Dependencies

### Third-Party Services
- **Neon Database:** Serverless PostgreSQL hosting.
- **Etherscan API v2:** Blockchain data retrieval for EVM networks.
- **Solscan API v2:** Blockchain data retrieval for Solana network.
- **Binance API:** Exchange portfolio tracking and balance retrieval.
- **CoinMarketCap API:** Real-time cryptocurrency price data (primary source).
- **CoinGecko API:** Real-time cryptocurrency price data (fallback source).

### Key NPM Packages

**Frontend:**
- `react`, `react-dom`, `@tanstack/react-query`, `wouter`, `recharts`, `@radix-ui/*`, `tailwindcss`, `class-variance-authority`, `lucide-react`, `react-hook-form`, `@hookform/resolvers`.

**Backend:**
- `express`, `drizzle-orm`, `@neondatabase/serverless`, `zod`.

**Development Tools:**
- `vite`, `tsx`, `esbuild`, `typescript`, `drizzle-zod`.