# Cryptocurrency Portfolio Tracker

## Overview

A comprehensive cryptocurrency portfolio tracking application that aggregates holdings across multiple wallets and exchanges. The platform provides real-time portfolio valuation, performance analytics, transaction history, and multi-source asset management. The application supports 19 EVM-compatible blockchain networks via Etherscan API v2, enabling automatic wallet scanning. It emphasizes data visualization and financial clarity through a sophisticated dashboard interface. Key features include multi-network wallet scanning, custom wallet naming, wallet connection grouping by address, and a unified holdings view across all sources.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (November 13, 2025)

**Solana Blockchain Integration:**
- Completed full Solana blockchain support with dual-namespace architecture
- Created Solscan service (server/services/solscan.ts) with API v2 support for fetching Solana wallet data and token balances
- Added backend endpoint: POST /api/wallet/scan-solana for scanning Solana wallets
- Updated sync endpoint to handle both EVM (via Etherscan) and Solana (via Solscan) based on chainNamespace field
- Extended MemStorage, schema, and grouping logic to support chainNamespace and networkKey fields
- Added Solana wallet section in Settings UI with dedicated input fields (name and address)
- Updated groupConnections.ts to display Solana network badges ("SOL") alongside EVM badges
- Requires valid SOLSCAN_API_KEY secret for Pro API subscription
- Arabic UI labels: "محافظ Solana" section with "اسم المحفظة" and "عنوان المحفظة" fields

**Dashboard Tabs Organization:**
- Reorganized Dashboard with tabs for better content organization
- Tab 1: "الأصول والممتلكات" (Holdings) - Contains Asset Allocation Chart and Holdings Table
- Tab 2: "سجل المعاملات" (Transaction History) - Dedicated tab for all transactions
- Connected Accounts section always visible at bottom
- Increased holdings table pagination from 10 to 100 items per page for better visibility

**Custom Wallet Naming Feature:**
- Added wallet name input field in Settings page before address field
- Users can now provide custom names for their wallets (optional)
- Custom names are used in format: "{CustomName} - {ChainName}" for multi-network connections
- Updated backend scan-all-networks endpoint to accept optional `name` parameter
- Arabic UI: "اسم المحفظة" label with placeholder "مثال: محفظتي الرئيسية"
- If no custom name provided, defaults to "Wallet - {ChainName}" format

**Wallet Connection Grouping Implementation:**
- Implemented wallet grouping by address - wallets with same address across different chains now display as single entry
- Added CHAIN_ABBREVIATIONS mapping in shared/networks.ts for compact network badges (ETH, BSC, MATIC, ARB, OP, BASE, etc.)
- Created groupConnectionsByAddress utility function in client/src/lib/groupConnections.ts
- Normalizes addresses to lowercase for case-insensitive grouping
- Aggregates balances across all networks for same address
- Updated ConnectedAccounts and SettingsPage components to display grouped wallets with network badges

## System Architecture

### UI/UX Decisions

The application features a modern, professional crypto tracking aesthetic. It utilizes `shadcn/ui` for accessible, customizable components, styled with Tailwind CSS. A custom design system includes a dark navy primary, royal blue accents, and crypto green/red for performance indicators. It supports both light and dark modes with persistent theme selection.

### Technical Implementations

The application uses a monorepo structure with shared TypeScript types between the client and server.

**Frontend:**
- **Framework:** React with TypeScript, Vite for bundling.
- **Routing:** Wouter for client-side routing.
- **State Management:** TanStack Query for server state and caching, local component state with `useState`, and Context API for theme management.
- **Key Components:** Portfolio Overview, Asset Allocation Chart (using Recharts), Holdings Table, Transaction History, and Connected Accounts management.
- **PWA:** Progressive Web App features including installability, offline support (via service worker caching), and app-like experience with auto-updates.

**Backend:**
- **Framework:** Express.js with TypeScript for a RESTful API.
- **API Design:** RESTful endpoints with centralized route registration, request/response logging, and error handling.
- **Data Access:** Abstract `IStorage` interface, currently using in-memory `MemStorage` for development, with a defined PostgreSQL schema for future production via Drizzle ORM.
- **Data Storage:** Uses Drizzle ORM for type-safe database queries, supporting `connections`, `holdings`, and `transactions` tables.

### Feature Specifications

- **Multi-Network Wallet Scanning:** 
  - **EVM Networks:** Automatically scans wallet addresses across 19 supported EVM-compatible networks, handling rate limiting, partial failures, and providing clear status messages. Networks include Layer 1s (Ethereum, BNB Smart Chain, Polygon, Avalanche, Fantom, Gnosis, Celo), Layer 2s (Arbitrum One/Nova, Optimism, Base, zkSync Era, Polygon zkEVM, Linea, Scroll, Blast, Mantle), and Polkadot/Kusama Parachains (Moonbeam, Moonriver).
  - **Solana Network:** Supports Solana blockchain wallet scanning using Solscan API v2 with dedicated UI section for Solana wallet management.
- **Custom Wallet Naming:** Allows users to provide optional custom names for their wallets, which are then used in the UI for clarity.
- **Wallet Connection Grouping:** Groups connections by wallet address, displaying them as a single entry with network badges for all chains where holdings exist. Supports both EVM and non-EVM (Solana) networks with appropriate badge display.
- **Unified Holdings View:** Aggregates all assets from all networks (EVM and Solana) into a single view on the dashboard, displaying network names next to asset symbols and consolidating for allocation charts.

### System Design Choices

- **Monorepo:** Facilitates shared TypeScript types between client and server, preventing API contract mismatches.
- **Abstract Storage Layer:** Allows flexible swapping between in-memory storage for development and a database (PostgreSQL via Drizzle ORM) for persistence.
- **Client-Side Data Fetching with React Query:** Manages real-time data updates, caching, and aggregation on the client, enabling optimistic UI updates and request deduplication.
- **`shadcn/ui` Component Library:** Chosen for rapid UI development with full customization flexibility without adding runtime dependencies.
- **Type Safety:** Achieved through shared schema definitions, Zod validation, and Drizzle type inference to ensure frontend/backend type synchronization.

## External Dependencies

### Third-Party Services
- **Neon Database:** Serverless PostgreSQL hosting (configured for future use).
- **Etherscan API v2:** Used for blockchain data retrieval across supported EVM networks.
- **Solscan API v2:** Used for Solana blockchain data retrieval including wallet balances and token metadata.
- **Cryptocurrency Price APIs:** Planned integration for real-time price data (currently uses mock data).

### Key NPM Packages

**Frontend:**
- `react`, `react-dom`
- `@tanstack/react-query`
- `wouter`
- `recharts`
- `@radix-ui/*` (for UI primitives)
- `tailwindcss`
- `class-variance-authority`
- `lucide-react`
- `react-hook-form`
- `@hookform/resolvers`

**Backend:**
- `express`
- `drizzle-orm`
- `@neondatabase/serverless`
- `zod`

**Development Tools:**
- `vite`
- `tsx`
- `esbuild`
- `typescript`
- `drizzle-zod`