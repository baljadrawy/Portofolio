# Canonical Asset Identity

> **Status:** Architecture contract. **Phase 0 — blocks all Intelligence work.**

---

## 1. Why this is first

Today (see `00-CURRENT-STATE-AUDIT.md` §3) an asset is a **free-text symbol
string** on `holdings` and `transactions`. There is no asset entity.

Every Intelligence contract in this system keys on `asset_id`. Evidence attaches
to an asset. Events affect assets. A thesis is about an asset. A decision
concerns an asset. **None of that can exist while "the asset" is a string.**

Concretely, the string model cannot express:

- Two different tokens sharing the symbol `UNI`
- The same logical asset deployed on eight chains
- `MATIC` and `POL` being the same investment across a rebrand
- Native ETH vs. WETH vs. bridged WETH on Arbitrum
- A scam token deliberately named `USDC`

---

## 2. The contract

This is a **logical contract**, not final DDL. Column names may change during
implementation; the semantics may not.

```
asset
├── asset_id            stable internal identifier — never reused, never recycled
├── asset_type          NATIVE | TOKEN | WRAPPED | BRIDGED | LP | SYNTHETIC | UNKNOWN
├── symbol              display symbol — NOT an identifier
├── name                display name
│
├── chain_id            EVM numeric chain id, null for non-EVM
├── network             canonical network key ('ethereum', 'solana', 'base', …)
│
├── contract_address    null for native assets
├── is_native_asset     boolean
│
├── coinmarketcap_id    provider id, nullable
├── coingecko_id        provider id, nullable
├── provider_mappings   open map: { provider → external_id }
│
├── canonical_status    CANONICAL | ALIAS | UNRESOLVED | DISPUTED | BLOCKED
├── canonical_asset_id  when ALIAS: points to the CANONICAL row
│
├── created_at
└── updated_at
```

### Identity key

The uniqueness constraint is **not** `symbol`. It is:

```
(network, contract_address)          for tokens
(network, 'NATIVE')                  for native assets
```

`symbol` is display metadata. It is never used to join, match, or deduplicate.

---

## 3. Asset type semantics

| Type | Meaning | Example |
|---|---|---|
| `NATIVE` | Chain's own gas asset | ETH on Ethereum, SOL on Solana |
| `TOKEN` | Standard contract token | USDC (ERC-20) |
| `WRAPPED` | Wrapped representation of a native asset on its own chain | WETH on Ethereum |
| `BRIDGED` | Representation of an asset originating on another chain | USDC.e on Avalanche |
| `LP` | Liquidity pool position token | UNI-V2 pair token |
| `SYNTHETIC` | Derivative/synthetic exposure | — |
| `UNKNOWN` | Discovered but unclassified | newly scanned airdrop |

### Grouping rule

An **Economic Exposure Group** links rows that represent the same economic
exposure across chains and wrappings.

```
economic_group: "ethereum"
    ├── ETH        (NATIVE,  ethereum)
    ├── WETH       (WRAPPED, ethereum)
    ├── WETH       (BRIDGED, arbitrum)
    └── WETH       (BRIDGED, base)
```

Portfolio concentration is computed on the **group**, not the row. Otherwise a
user holding ETH across four chains appears diversified when they are not.

This directly serves Question 14 and the Portfolio Intelligence layer.

---

## 4. Asset Identity Resolution Policy

Applied when a collector reports a holding. **Ordered — first match wins.**

| Step | Rule | Result |
|---|---|---|
| 1 | Exact `(network, contract_address)` match exists | Resolve to that `asset_id` |
| 2 | Native asset for a known network | Resolve to that chain's `NATIVE` row |
| 3 | Contract address known to a Tier-2 provider registry | Create `CANONICAL`, store provider ids |
| 4 | Contract address unknown, symbol matches an existing canonical asset | Create row as `DISPUTED` — **never** auto-merge |
| 5 | Nothing matches | Create row as `UNRESOLVED` |

### Hard rules

- ❌ **Never resolve by symbol alone.** This is the single most dangerous
  operation in the system — it is how a scam `USDC` inherits real USDC's thesis,
  evidence, and score.
- ❌ Never auto-merge on name similarity.
- ✅ `UNRESOLVED` and `DISPUTED` assets are shown to the user, but are excluded
  from scoring and decisions until resolved.
- ✅ Resolution decisions are recorded as evidence with provenance.

---

## 5. Ticker Collision Policy

Symbol collisions are normal, not exceptional.

| Situation | Handling |
|---|---|
| Two canonical assets share a symbol | Both retained. UI **must** disambiguate by chain + truncated contract address. |
| An unknown token claims a major symbol | `DISPUTED`. Excluded from valuation until resolved. Surfaced to Security module as a signal — impersonation is a scam indicator. |
| Provider returns a symbol-only price | Only accepted if the provider id is already mapped on the asset. **Never** matched by symbol at query time. |

### Why this matters concretely

The current price pipeline (`symbol-mapper.ts`) maps `MATIC → POL` for
CoinMarketCap lookups by symbol. That works today for one known case, but it is a
symbol-keyed hack. Under this contract, the mapping lives on the asset row as a
`provider_mapping`, is auditable, and generalises to every future rebrand.

---

## 6. Token migrations and rebrands

**Requirement: a rebrand must never destroy investment history.**

MATIC → POL is the reference case, and it is already present in this codebase's
price layer.

### Model

```
asset_lineage
├── lineage_id
├── from_asset_id
├── to_asset_id
├── migration_type     REBRAND | CONTRACT_MIGRATION | REDENOMINATION | CHAIN_MIGRATION
├── ratio              conversion ratio (1:1 for a pure rebrand)
├── effective_at
├── evidence_ids       proof this migration is real
└── status             ANNOUNCED | ACTIVE | COMPLETE
```

### Rules

- The old asset row is **never deleted**. It becomes `canonical_status = ALIAS`
  pointing to the new row.
- Historical transactions keep referencing the old `asset_id`. Truth about the
  past is preserved.
- Thesis, analysis history, and evidence **follow the lineage forward**, so
  "why I bought this in 2024" survives a 2026 rebrand.
- A migration is only recorded when backed by Tier-1 or Tier-2 evidence. A
  rebrand rumour is an *event*, not a lineage record.
- `CONTRACT_MIGRATION` with a ratio ≠ 1:1 must adjust cost basis; this is
  flagged for explicit review rather than applied silently.

---

## 7. Non-EVM and cross-ecosystem

| Ecosystem | `network` | `chain_id` | `contract_address` |
|---|---|---|---|
| EVM chains | `ethereum`, `base`, … | numeric | 0x… (checksummed) |
| Solana | `solana` | `null` | mint address |
| Future non-EVM | canonical key | `null` | ecosystem-native identifier |

The existing schema already anticipates this with
`connections.chainNamespace` (`evm` | `solana`) and `connections.networkKey`.
The asset registry generalises that pattern to the asset level.

---

## 8. Migration path from today's model

**Non-destructive and reversible.** No existing column is dropped in Phase 0.

```
Step 1  Create the asset registry tables (additive only)
Step 2  Backfill from distinct (connection.chain, holding.symbol) pairs
          → most rows land as UNRESOLVED; this is expected and correct
Step 3  Enrich via provider registries and explorer metadata → CANONICAL
Step 4  Add nullable holdings.asset_id / transactions.asset_id
Step 5  Dual-write: collectors populate both symbol and asset_id
Step 6  Intelligence reads asset_id ONLY; Portfolio Core keeps using symbol
Step 7  (later phase) make asset_id non-null once coverage is verified
```

The `symbol` columns stay for the entire duration. This keeps the running tracker
untouched while Intelligence is built alongside it.

---

## 9. Open questions

Recorded rather than guessed:

| # | Question |
|---|---|
| Q-1 | Do LP positions get one asset row, or a composite of their underlyings? |
| Q-2 | How is an economic group seeded — curated list, provider data, or both? |
| Q-3 | What authority resolves `DISPUTED` — operator confirmation, or automated Tier-1 evidence? |
| Q-4 | Should `BLOCKED` (confirmed scam) assets be hidden entirely or shown with a warning? |
