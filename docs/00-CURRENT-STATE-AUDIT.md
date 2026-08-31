# Current State Audit

> **Status:** **HISTORICAL SNAPSHOT** — frozen at the commit below.
> **Living register:** technical debt now lives in
> [`TECHNICAL-DEBT.md`](./TECHNICAL-DEBT.md). Where the two disagree, that file
> is current and this one is history.
> **Method:** Read-only inspection. No code was modified to produce this document.
> **Commit audited:** `2521133` (2025-12-16)
> **Audit date:** 2026-08-29

This document exists so every later architecture decision is anchored to what is
**actually in the repository**, not to an idealised description of it. Where this
document and a design document disagree, **this one describes reality**.

---

## 1. What the project is today

A working **cryptocurrency portfolio tracker**. It aggregates holdings across
wallets and exchanges, prices them, and renders a dashboard. It is real,
functional software and Phase 0+ must not regress it.

It is **not**, today, an investment intelligence system. Nothing in the codebase
performs research, reasoning, scoring, or decision-making about whether an asset
is worth holding.

---

## 2. Verified stack

| Layer | Reality |
|---|---|
| Runtime | Node.js 20 (declared in `.replit`: `nodejs-20`) |
| Language | TypeScript 5.6.3 |
| Frontend | React 18.3, Vite 5.4, Wouter 3.3, TanStack Query 5.60, shadcn/ui + Radix, Tailwind 3.4, Recharts |
| Backend | Express 4.21 |
| ORM | Drizzle ORM 0.39 + drizzle-zod |
| DB driver | `@neondatabase/serverless` 0.10 via `drizzle-orm/neon-serverless` |
| Validation | Zod 3.24 |
| Build | `vite build && esbuild server/index.ts --bundle --format=esm --outdir=dist` |
| Start | `NODE_ENV=production node dist/index.js` |
| Port | `PORT` env, default `5000`, host `0.0.0.0` |
| Origin | Replit (`.replit` present, `@replit/vite-plugin-*` in devDependencies) |

**Package name is `rest-express`** — a scaffold default, not renamed.

---

## 3. Data model as it exists

Five tables in `shared/schema.ts`:

| Table | Purpose | Notable |
|---|---|---|
| `connections` | wallets + exchanges | `chainId`, `chainNamespace` (`evm`\|`solana`), `networkKey`, sync cursors |
| `holdings` | balances | `symbol` **TEXT**, `name`, `amount`, `currentPrice`, `avgCost` |
| `transactions` | history | `type`, `symbol` **TEXT**, `amount`, `price`, `total`, `source` |
| `portfolio_snapshots` | value over time | `totalValue`, `totalChange24h`, `timestamp` |
| `users` | legacy | marked "legacy … for backward compatibility"; unused by the app |

### The single most important finding

> **Assets are identified by a free-text `symbol` string. There is no asset entity.**

`holdings.symbol` and `transactions.symbol` are `text`. There is no table
representing an asset, no contract address on a holding, no chain reference on a
holding, no provider ID mapping. A holding does not know which chain it came from
except transitively through its `connectionId`.

This is the structural reason **Canonical Asset Identity is Phase 0B work and
blocks everything else**. See `02-ASSET-IDENTITY.md`.

---

## 4. API surface (verified)

```
GET    /api/holdings
POST   /api/holdings
GET    /api/connections
POST   /api/connections
DELETE /api/connections/:id
GET    /api/transactions
POST   /api/transactions
GET    /api/portfolio/summary
GET    /api/portfolio/history
GET    /api/crypto/prices
GET    /api/prices/:symbol
POST   /api/prices/update
POST   /api/exchange/sync/:connectionId
POST   /api/wallet/sync/:connectionId
POST   /api/wallet/scan-all-networks
POST   /api/wallet/scan-solana
```

**No `/health` or `/ready` endpoint exists.** Confirmed by grep across `server/`.

---

## 5. Integrations (verified)

| Service | File | Role |
|---|---|---|
| Etherscan API v2 | `services/etherscan.ts` | EVM wallet + token scanning |
| Solscan API v2 | `services/solscan.ts` | Solana scanning |
| CoinMarketCap | `services/coinmarketcap.ts` | prices |
| CoinGecko | `services/coingecko.ts` | prices (secondary) |
| Binance | `services/binance.ts` | exchange holdings |
| — | `services/symbol-mapper.ts` | symbol normalisation + scam filtering |

**19 EVM chains + Solana** declared in `shared/networks.ts`.

Environment variables read by code: `DATABASE_URL`, `PORT`,
`COINMARKETCAP_API_KEY`, `ETHERSCAN_API_KEY`, `SOLSCAN_API_KEY`.

---

## 6. Existing "scam" handling — what it actually is

Located in `server/services/symbol-mapper.ts`. It is:

- a hardcoded `Set` of ~5 known scam symbols (`GME`, `COC`, `NC`, `DEBANK`, `NODEPAY`)
- a list of regex patterns matching **symbol strings**: URL fragments (`.com`,
  `.io`, `.fi`), swap-scam names, keywords (`CLAIM`, `AIRDROP`, `REWARD`,
  `VISIT`), Unicode obfuscation
- applied at `/api/holdings` and `/api/portfolio/summary` via `isValidSymbol()`

Per `replit.md`, it reduces displayed holdings from **329 → ~138**.

### Classification

This is **airdrop-spam display filtering**. It is a UI hygiene feature.

It is **not** a security assessment. It inspects a token's *name*, never its
*contract*. It cannot detect a honeypot, a mint function, an unlocked liquidity
pool, or a malicious owner. A professionally-named malicious contract passes it
untouched.

The distinction is formalised in `06-SECURITY-AND-SCAM.md`. **The existing filter
must not be deleted or weakened** — it solves a real problem well. It is simply a
different problem from the one the Security Engine will solve.

---

## 7. Keyword sweep result

Searched the full repository (excluding `node_modules`, `package-lock.json`) for
every term named in the architecture brief:

| Term | Files | Verdict |
|---|---|---|
| `scam` | 5 | **Real** — see §6 |
| `security` | 2 | Two code comments about not storing API keys. No security layer. |
| `event` | 24 | All DOM/React events. **No Event Store.** |
| `AI` | 42 | All substring false positives (`chAIn`, `retAIn`, `mAIn`). **No AI.** |
| `research`, `intelligence`, `thesis`, `evidence`, `risk`, `competitor`, `decision`, `OpenAI`, `Anthropic`, `Palisade`, `VerumTrade`, `openportfolio`, `analystOS`, `roadmap` | **0** | Do not exist in any form. |

**Conclusion: the Intelligence Layer is greenfield.** There is no partial
implementation to reconcile with, and no legacy intelligence code to migrate.

---

## 8. Branch state

`git branch -a` returns `main` only. There is **no** in-progress branch for
Docker or shared-PostgreSQL work in this repository.

---

## 9. Deployment reality

- No `Dockerfile`
- No `docker-compose.yml`
- No `.env` / `.env.example` committed (verified via `git ls-files`)
- No `migrations/` directory → Drizzle operates in **`drizzle-kit push`**
  (schema-first) mode, not versioned-migration mode
- Deployment target in `.replit` is `autoscale` (Replit-hosted)

### Self-hosting blocker (documented, not fixed here)

`server/db.ts` uses `@neondatabase/serverless`, which connects to Neon's cloud
proxy **over WebSocket**. It does not speak the PostgreSQL wire protocol to a
standard server. Running against self-hosted PostgreSQL requires swapping the
driver to `pg` + `drizzle-orm/node-postgres` — a two-line change in `db.ts`
only. ORM, schema, and storage layer are unaffected.

Recorded here as a known Phase 0A task. **Not performed in this documentation task.**

---

## 10. Seed behaviour

`server/seed-data.ts` runs `initializeSampleData()` on **every boot**. It is
non-destructive: it early-returns if any connection exists, and contains zero
`delete` / `truncate` / `drop` operations. It seeds demo wallets (including a
well-known public address).

Flagged so nobody later assumes production data is user-only.

---

## 11. Technical debt observed

> **Moved.** The debt items first recorded here (TD-01 … TD-10) now live in the
> living register: **[`TECHNICAL-DEBT.md`](./TECHNICAL-DEBT.md)**.
>
> That file is authoritative. It carries severity, blocker status, target phase,
> and current status per item, and it is updated as work proceeds. This snapshot
> is not maintained.

**Correction applied 2026-08-31:** TD-02 was originally worded *"`users` table is
dead code with a plaintext `password` column"*. The recorded evidence supports
only that a `text` column named `password` exists — which is also the normal
storage type for a password **hash**. The claim of plaintext storage was not
evidenced and has been downgraded to *verification required* in the register.

## 12. What this means for the roadmap

1. **Nothing needs to be undone.** The tracker is sound; Intelligence is additive.
2. **Asset identity blocks Intelligence — not deployment.** Every Intelligence
   contract keys on `asset_id`, which does not yet exist. Phase 0A (production
   baseline) can still reach PASS without it. See `ROADMAP.md`.
3. **The Evidence Store has no precursor.** It is built from zero — an advantage,
   since no legacy shape constrains it.
4. **Existing scam filtering is kept and wrapped**, not replaced.
