# Cryptocurrency Portfolio Tracker - Design Guidelines

## Design Approach
**Reference-Based**: Drawing inspiration from CoinTracker and Blockfolio's sophisticated financial dashboard interfaces, emphasizing data clarity, comprehensive portfolio visualization, and professional financial UI patterns.

## Color System (User-Specified)
- **Primary**: #1B1B2F (dark navy) - Main backgrounds, headers
- **Secondary**: #16213E (deep blue) - Card backgrounds, secondary surfaces
- **Accent**: #0F3460 (royal blue) - Interactive elements, highlights
- **Success**: #00D4AA (crypto green) - Positive values, profit indicators
- **Warning**: #FFB800 (gold) - Alerts, caution states
- **Background**: #F8F9FA (light grey) - Light mode base
- **Text**: #2D3748 (charcoal) - Primary text
- **Supporting**: #E74C3C (red) for losses, #6C757D (muted grey) for secondary text

## Typography
- **Fonts**: Inter (primary), Roboto or SF Pro (fallbacks)
- **Hierarchy**:
  - Display: 48px/56px bold - Dashboard totals
  - H1: 32px/40px semibold - Section headers
  - H2: 24px/32px semibold - Card titles
  - H3: 18px/24px medium - Subsections
  - Body: 16px/24px regular - Standard text
  - Small: 14px/20px regular - Metadata, timestamps
  - Micro: 12px/16px medium - Labels, tags
- **Number Display**: Tabular figures, monospace for precise alignment

## Layout System
- **Spacing Units**: Tailwind units of 4, 6, 8 for consistency (p-4, m-6, gap-8)
- **Grid**: 12-column responsive grid with 24px gutters
- **Breakpoints**: Mobile-first (sm: 640px, md: 768px, lg: 1024px, xl: 1280px)
- **Container**: max-w-7xl for main content area

## Dashboard Structure

### Hero/Overview Section
Full-width statistics banner displaying:
- Total Portfolio Value (large display typography)
- 24h Change (percentage and absolute value with color coding)
- Total Profit/Loss (lifetime, with success/error coloring)
- Quick stats grid: Assets Count, Exchanges Connected, Wallets Linked
- Background: Subtle gradient from Primary to Secondary with low-opacity crypto pattern overlay

### Portfolio Distribution Card
- Donut/pie chart showing asset allocation by value
- Interactive legend with percentages
- Top 5 holdings list with mini bar charts
- "View All Assets" expansion link

### Performance Chart Card
- Line chart showing portfolio value over time (7D/1M/3M/1Y/ALL toggles)
- Volume bars below price line
- Tooltip on hover showing exact values and timestamps
- Grid lines: subtle, #E2E8F0 in light mode, #2D3748 in dark mode

### Holdings Table
- Multi-column sortable table: Asset | Amount | Price | 24h Change | Value | Actions
- Color-coded change percentages (green positive, red negative)
- Cryptocurrency icons/logos
- Alternating row backgrounds for readability
- Sticky header on scroll

### Transaction History
- Chronological feed with grouped dates
- Transaction cards showing: Type (Buy/Sell/Transfer) | Asset | Amount | Price | Total | Timestamp
- Filter chips: All, Buys, Sells, Transfers
- Search functionality

### Connected Accounts Sidebar
- Compact cards for each wallet/exchange
- Status indicators (synced, syncing, error)
- Last sync timestamp
- Quick disconnect action

## Component Library

### Cards
- Background: #FFFFFF (light), #16213E (dark)
- Border-radius: 12px
- Padding: p-6
- Shadow: subtle elevation (shadow-md)
- Hover: slight lift effect (transform translateY)

### Data Visualization
- Charts: Recharts or Chart.js library
- Color palette for different assets: vibrant, distinguishable colors
- Gradients for area charts (opacity 0.6 to 0)
- Gridlines: minimal, dashed (#E2E8F0)

### Buttons
- Primary: Accent color background, white text, rounded-lg, px-6 py-3
- Secondary: Transparent with accent border, accent text
- Icon buttons: 40x40px, rounded-full, hover background
- On images: backdrop-blur-md, semi-transparent background

### Status Indicators
- Success: Green dot + text (#00D4AA)
- Warning: Yellow dot + text (#FFB800)
- Error: Red dot + text (#E74C3C)
- Loading: Animated spinner in Accent color

### Input Fields
- Height: 48px
- Border: 1px solid #CBD5E0, focus: Accent color
- Border-radius: 8px
- Padding: px-4

## Navigation
- Fixed top navigation bar with logo, search, notifications, profile
- Sidebar navigation (collapsible): Dashboard, Assets, Transactions, Analytics, Settings
- Active state: Accent color background with icon + text
- Mobile: Bottom navigation bar

## Dark Mode
- Background hierarchy: #1B1B2F → #16213E → #0F3460
- Text: #F8F9FA primary, #CBD5E0 secondary
- Card backgrounds: #16213E with subtle border (#0F3460)
- Maintain color-coded profit/loss visibility

## Animations
- Page transitions: None (instant for dashboard responsiveness)
- Chart loading: Smooth draw-in animation (1s duration)
- Number counters: Animate on initial load
- Hover states: 150ms transition for all interactive elements

## Images
**No hero image** - This is a data-dense financial dashboard where immediate information access is critical. The overview section serves as the visual anchor with live data and statistics.

## Accessibility
- WCAG AA contrast ratios maintained across all color combinations
- Keyboard navigation for all interactive elements
- ARIA labels for charts and data visualizations
- Focus indicators: 2px Accent color outline