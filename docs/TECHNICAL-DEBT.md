# Technical Debt Register

> **This is a LIVING document.** It is the authoritative register of known debt.
>
> `00-CURRENT-STATE-AUDIT.md` is a **historical snapshot** taken at commit
> `2521133`. When the two disagree, **this file is current**.

**Last updated:** 2026-09-01 (Phase 2B — TD-32)

---

## How to use this register

- Add an entry when debt is discovered — do not silently absorb it
- Update `Status` when it changes; do not delete resolved entries
- `Blocker: YES` means a phase cannot reach PASS until it is resolved
- Every entry must state *why* it is or is not a blocker

### Launch classification

Every open item carries one of:

| Class | Meaning |
|---|---|
| `PRE-LAUNCH BLOCKER` | The Core Launch Gate cannot be met while this is open |
| `PRE-LAUNCH NON-BLOCKER` | Should be addressed before launch; does not block the gate |
| `POST-LAUNCH` | Deferred. Does not affect launch safety or usefulness |

Classification is **not** inherited from severity. A HIGH-severity item can be
POST-LAUNCH if it does not touch the twelve gate conditions.
Contract: [`CORE-LAUNCH-SCOPE.md`](./CORE-LAUNCH-SCOPE.md).

---

## Launch classification table

| ID | Item | Class | Rationale |
|---|---|---|---|
| TD-01 | package name `rest-express` | `POST-LAUNCH` | Cosmetic. No gate condition touches it. |
| TD-02 | legacy `users` password field | `POST-LAUNCH` | Table is unused and unreferenced; no auth path runs through it. Still unverified, still not a launch risk. |
| TD-04 | no versioned migrations | `POST-LAUNCH` | Reclassified. Phases 0B and 1 both shipped reviewed, guarded, additive SQL — the discipline exists without the framework. |
| TD-08 | Replit build plugins | `POST-LAUNCH` | Guarded by `NODE_ENV`/`REPL_ID`; production builds unaffected. |
| TD-09 | test coverage | `PRE-LAUNCH NON-BLOCKER` | 50 tests exist. Phase 4 guardrails and Phase 6 UAT will demand more, but the gate is verified by Phase 6, not by a coverage number. |
| TD-10 | orphaned volume | `POST-LAUNCH` | Server hygiene, unrelated to this repository. |
| TD-15 | pre-existing TypeScript errors | `POST-LAUNCH` | Two errors in files no CORE phase touches. Build uses esbuild and does not typecheck. |
| TD-16 | PUBLIC CONNECT default | `POST-LAUNCH` | Measured: connect-only, zero data access. PostgreSQL default, not a grant we made. Revoking risks other projects. |
| TD-17 | no migration/runtime role split | `POST-LAUNCH` | Single-operator server. Ideal, not required for safe launch. |
| TD-19 | historical identity recovery | `POST-LAUNCH` | Current impact zero — no pre-0B holdings exist. Re-scan resolves. |
| TD-20 | manual identity admin UI | `POST-LAUNCH` | Precedence is enforced in code; setting an override via SQL is acceptable for a single operator. |
| TD-21 | `economic_group` unpopulated | `POST-LAUNCH` | Feeds portfolio concentration, which is B4. |
| TD-22 | snapshot cleanup needs trigger disable | `POST-LAUNCH` | Absolute immutability is the intended behaviour. |
| TD-23 | evidence retention undefined | `PRE-LAUNCH NON-BLOCKER` | **Narrowed.** A *stated* minimum policy is required before launch if evidence is stored in production. Automated lifecycle management is POST-LAUNCH. |
| TD-24 | third-party source terms unknown | **`PRE-LAUNCH BLOCKER`** | **Narrowed.** Only for sources CORE actually uses *and stores data from*. Storing data in breach of terms is a real legal exposure, not a tidiness issue. Sources not used by CORE stay open. |
| TD-25 | `raw_value` inline text | `POST-LAUNCH` | Deliberate: keeps hash determinism under application control. |
| TD-26 | no live SecurityProvider | **`PRE-LAUNCH BLOCKER`** | Gate condition 3. Without it the system can recommend HOLD on a honeypot — the worst failure this product can produce. |

### Summary

```
PRE-LAUNCH BLOCKER      : 2   TD-24 (market sources — become CORE in Phase 3)
                              TD-32 (3 of 4 closed; SELL_TAX remains)
PRE-LAUNCH NON-BLOCKER  : 7   TD-09, TD-23, TD-27, TD-31, TD-33, TD-34, TD-35
POST-LAUNCH             : 15
RESOLVED                : 12
```

**TD-32 is the honest cost of resolving the licence exposure.** It is recorded
as a blocker rather than absorbed by lowering the CORE requirement.

---

### Severity scale

| Severity | Meaning |
|---|---|
| `CRITICAL` | Data loss, security compromise, or production outage risk |
| `HIGH` | Blocks a phase, or causes incorrect output |
| `MEDIUM` | Operational friction, maintenance cost |
| `LOW` | Cosmetic, hygiene, or naming |

---

## Register

### TD-01 — Package name is a scaffold default

| Field | Value |
|---|---|
| **Title** | `package.json` name is `rest-express` |
| **Discovered** | 2026-08-29 · commit `2521133` |
| **Phase discovered** | Documentation |
| **Severity** | LOW |
| **Blocker** | NO |
| **Rationale** | Cosmetic. Unclear provenance in tooling and logs, but affects no behaviour. |
| **Target phase** | Phase 0A (opportunistic) |
| **Status** | OPEN |

---

### TD-02 — Legacy `users` table contains a password field

| Field | Value |
|---|---|
| **Title** | Legacy `users` table contains a `password` field of unverified storage behaviour |
| **Discovered** | 2026-08-29 · commit `2521133` |
| **Phase discovered** | Documentation |
| **Severity** | MEDIUM *(pending verification — see below)* |
| **Blocker** | NO |
| **Target phase** | Phase 0A |
| **Status** | OPEN — **VERIFICATION REQUIRED** |

**Recorded evidence:**

- `shared/schema.ts` declares `password: text("password").notNull()`
- The table is annotated in-source as *"legacy user schema for backward compatibility"*
- No application code was observed reading or writing this table
- `passport` and `passport-local` are present in dependencies

**Precise statement:**

> Legacy `users` table contains a password field. Actual password
> hashing/storage behaviour requires verification before classifying it as
> plaintext credential storage.

**Correction note:** an earlier draft described this as *"a plaintext password
column"*. The recorded evidence establishes only that a `text` column named
`password` exists. A `text` column is the normal storage type for a bcrypt or
argon2 **hash** as well as for a plaintext value. No evidence was gathered about
what is actually written to it.

Overstating an unproven security finding is itself a defect: it inflates
perceived risk and erodes trust in the register. The classification stays
`MEDIUM / unverified` until the write path is inspected.

**Resolution requires:** inspecting any write path to `users`, or confirming the
table is genuinely unreferenced and removing it.

---

### TD-03 — No health endpoint

| Field | Value |
|

**Resolution:** **RESOLVED** — Phase 0A. `GET /health` added: 200 `{status:ok,database:ok}` / 503 `{status:degraded,database:unavailable}`. Leaks no host, user, credentials, or stack trace.

---|---|
| **Title** | No `/health` or `/ready` endpoint exists |
| **Discovered** | 2026-08-29 · commit `2521133` |
| **Phase discovered** | Documentation |
| **Severity** | HIGH |
| **Blocker** | **YES — Phase 0A** |
| **Rationale** | Container orchestration health checks cannot function without it. A Phase 0A exit criterion depends on it directly. |
| **Target phase** | Phase 0A |
| **Status** | OPEN |

---

### TD-04 — No versioned migrations

| Field | Value |
|---|---|
| **Title** | Drizzle runs in `push` (schema-first) mode; no `migrations/` directory |
| **Discovered** | 2026-08-29 · commit `2521133` |
| **Phase discovered** | Documentation |
| **Severity** | HIGH |
| **Blocker** | NO for Phase 0A · **YES for Phase 0B** |
| **Rationale** | `push` is acceptable against a new, empty database. It becomes unsafe once production data exists, and Phase 0B modifies live tables. |
| **Target phase** | Phase 0B |
| **Status** | OPEN |

---

### TD-05 — Neon driver blocks self-hosting

| Field | Value |
|

**Resolution:** **RESOLVED** — Phase 0A. `server/db.ts` swapped to `pg` + `drizzle-orm/node-postgres`. `@neondatabase/serverless` removed from dependencies. Zero Neon references remain.

---|---|
| **Title** | `server/db.ts` uses `@neondatabase/serverless` (WebSocket to Neon proxy) |
| **Discovered** | 2026-08-29 · commit `2521133` |
| **Phase discovered** | Documentation |
| **Severity** | CRITICAL |
| **Blocker** | **YES — Phase 0A** |
| **Rationale** | The driver does not speak the PostgreSQL wire protocol to a standard server. The application cannot connect to shared PostgreSQL at all until this is replaced with `pg` + `drizzle-orm/node-postgres`. |
| **Scope of change** | `server/db.ts` only — ORM, schema, and storage layer unaffected |
| **Target phase** | Phase 0A |
| **Status** | OPEN |

---

### TD-06 — Demo seed runs on every boot

| Field | Value |
|

**Resolution:** **RESOLVED** — Phase 0A. Demo seed is now opt-in: runs only outside production, or with `SEED_DEMO_DATA=true`. Verified in production logs: `demo seed skipped (production)`.

---|---|
| **Title** | `initializeSampleData()` runs in the production start path |
| **Discovered** | 2026-08-29 · commit `2521133` |
| **Phase discovered** | Documentation |
| **Severity** | MEDIUM |
| **Blocker** | NO |
| **Rationale** | Non-destructive (early-returns if any connection exists, contains zero delete/truncate/drop), but it seeds demo wallets into a real deployment's first boot. |
| **Target phase** | Phase 0A |
| **Status** | OPEN |

---

### TD-07 — `symbol` is untyped free text

| Field | Value |
|

**Resolution:** Phase 0B. Canonical asset registry implemented; `holdings` and `transactions` now carry a nullable `asset_id` plus source provenance. `symbol` is retained as a legacy/display field and is no longer treated as identity anywhere in the resolution path.

---|---|
| **Title** | Assets identified by free-text `symbol` on `holdings` and `transactions` |
| **Discovered** | 2026-08-29 · commit `2521133` |
| **Phase discovered** | Documentation |
| **Severity** | HIGH |
| **Blocker** | **YES — Phase 0B and all Intelligence phases** |
| **Rationale** | Root cause of identity ambiguity. Cannot express duplicate tickers, cross-chain identity, wrapped/bridged assets, or rebrands. Every Intelligence contract keys on `asset_id`, which does not exist. |
| **Target phase** | Phase 0B |
| **Status** | OPEN |

---

### TD-08 — Replit-specific build plugins

| Field | Value |
|---|---|
| **Title** | `@replit/vite-plugin-*` present in the build configuration |
| **Discovered** | 2026-08-29 · commit `2521133` |
| **Phase discovered** | Documentation |
| **Severity** | MEDIUM |
| **Blocker** | NO |
| **Rationale** | Couples the build to a platform being migrated away from. Guarded by `NODE_ENV !== "production"` and `REPL_ID`, so production builds are unaffected in practice. |
| **Target phase** | Phase 0A (opportunistic) |
| **Status** | OPEN |

---

### TD-09 — No test suite

| Field | Value |
|

**Update (Phase 0B):** a minimal harness now exists — `node:test` + `tsx`, zero new dependencies, `npm test`. 13 identity tests pass. Coverage is limited to identity rules; the Phase 4 guardrail tests (notably G-3) are still outstanding.

---|---|
| **Title** | No automated tests present in the repository |
| **Discovered** | 2026-08-29 · commit `2521133` |
| **Phase discovered** | Documentation |
| **Severity** | HIGH |
| **Blocker** | NO for Phase 0A · **YES for Phase 4** |
| **Rationale** | Phase 0A can be verified by manual regression. Phase 4 requires guardrail G-3 (price-only never → `EXIT`) to be test-covered, which is impossible without a suite. |
| **Target phase** | Phase 4 (foundation may start at 0A) |
| **Status** | OPEN |

---

### TD-10 — Orphaned PostgreSQL volume on the server

| Field | Value |
|---|---|
| **Title** | `baity_postgres_data` Docker volume unattached to any container |
| **Discovered** | 2026-08-29 |
| **Phase discovered** | Phase 0A pre-execution audit |
| **Severity** | LOW |
| **Blocker** | NO |
| **Rationale** | Server-side, unrelated to this repository. Residue from a per-project PostgreSQL predating the shared instance. Consumes disk; touching it is out of scope for any Portfolio task. |
| **Target phase** | — (separate server maintenance) |
| **Status** | OPEN — out of scope |

---

### TD-11 — Backup coverage for a new database is unverified

| Field | Value |
|

**Resolution:** **RESOLVED** — Phase 0A. Backup was a FIXED LIST, not cluster-wide. `portfolio` added; real run produced `portfolio OK — 1.3K` and the artifact was verified on Google Drive.

---|---|
| **Title** | Unknown whether server backups cover the whole PostgreSQL cluster or a fixed database list |
| **Discovered** | 2026-08-31 · Documentation Correction Gate |
| **Phase discovered** | Documentation |
| **Severity** | HIGH |
| **Blocker** | **YES — Phase 0A** |
| **Rationale** | If backups enumerate a fixed list of databases, a newly created `portfolio` database would be silently excluded. A production database with no backup is not an acceptable Phase 0A exit state. |
| **Resolution** | Inspect the backup mechanism. If cluster-wide, record confirmation. If list-based, **do not auto-edit it** — record the required change and raise it explicitly. |
| **Target phase** | Phase 0A |
| **Status** | OPEN |

---

### TD-12 — Dead `xsch` entry in the backup script

| Field | Value |
|---|---|
| **Title** | Backup script referenced the deleted `xsch` database |
| **Discovered** | 2026-08-31 · Phase 0A |
| **Phase discovered** | Phase 0A |
| **Severity** | MEDIUM |
| **Blocker** | NO |
| **Rationale** | `xsch` was deleted on 2026-08-29 but its `dump_db` line remained. Every nightly run failed on it and the script exited non-zero, which would mask a real backup failure. Removed while adding `portfolio` — the same one-line edit, and required to make TD-11 verifiable. |
| **Target phase** | Phase 0A |
| **Status** | RESOLVED |

---

### TD-13 — Production bundle pulled in `vite`

| Field | Value |
|---|---|
| **Title** | `dist/index.js` statically imported `vite` (a devDependency) |
| **Discovered** | 2026-08-31 · Phase 0A |
| **Phase discovered** | Phase 0A |
| **Severity** | HIGH |
| **Blocker** | **WAS** — container crash-looped with `ERR_MODULE_NOT_FOUND: vite` |
| **Rationale** | `server/index.ts` statically imported `./vite`, whose module graph reaches `vite` and `vite.config.ts`. Never surfaced on Replit, which installs devDependencies in production. |
| **Resolution** | Production-safe `log`/`serveStatic` extracted to `server/static.ts`; `./vite` dynamically imported in the dev branch only and marked `--external:./vite` in the esbuild step. Verified: zero static `vite` imports in `dist/index.js`. |
| **Target phase** | Phase 0A |
| **Status** | RESOLVED |

---

### TD-14 — `EtherscanService` threw at construction

| Field | Value |
|---|---|
| **Title** | Missing `ETHERSCAN_API_KEY` crashed the whole application at boot |
| **Discovered** | 2026-08-31 · Phase 0A |
| **Phase discovered** | Phase 0A |
| **Severity** | HIGH |
| **Blocker** | **WAS** — app could not start without an optional provider key |
| **Rationale** | The constructor threw when the key was absent. `CoinMarketCapService` already used the correct lazy pattern (`ensureApiKey()`), and `SolscanService` checks per request — `EtherscanService` was the outlier. |
| **Resolution** | Key check deferred to call time via `ensureApiKey()`, matching the existing in-repo pattern. Deployment health is now independent of optional provider availability. |
| **Target phase** | Phase 0A |
| **Status** | RESOLVED |

---

### TD-15 — Pre-existing TypeScript errors

| Field | Value |
|---|---|
| **Title** | `npm run check` reports 3 errors on untouched files |
| **Discovered** | 2026-08-31 · Phase 0A |
| **Phase discovered** | Phase 0A |
| **Severity** | MEDIUM |
| **Blocker** | NO |
| **Rationale** | In `client/src/components/examples/HoldingsTable.tsx` and `server/seed-data.ts`. Confirmed pre-existing: the same 3 errors are present on the base commit before any Phase 0A change. The build uses esbuild, which does not typecheck, so they do not block deployment. |
| **Target phase** | unassigned |
| **Status** | OPEN |

---

### TD-16 — `portfolio_app` can connect to other project databases

| Field | Value |
|---|---|
| **Title** | PostgreSQL `PUBLIC` default grants CONNECT on `baity` and `tamrini` |
| **Discovered** | 2026-08-31 · Phase 0A |
| **Phase discovered** | Phase 0A |
| **Severity** | LOW |
| **Blocker** | NO |
| **Rationale** | `datacl` is NULL on both databases, i.e. the PostgreSQL default — **not** a grant made during Phase 0A. Measured impact is connect-only: `portfolio_app` gets `permission denied for schema public` on any table read and cannot create objects. The Phase 0A brief explicitly forbids revoking PUBLIC CONNECT from other projects, since that risks breaking them. `portfolio` itself has PUBLIC revoked (`portfolio_app=CTc/portfolio_app`). |
| **Target phase** | separate server-wide hardening |
| **Status** | OPEN — accepted |

---

### TD-17 — No migration/runtime privilege separation

| Field | Value |
|---|---|
| **Title** | `portfolio_app` performs both schema migration and runtime access |
| **Discovered** | 2026-08-31 · Phase 0A |
| **Phase discovered** | Phase 0A |
| **Severity** | LOW |
| **Blocker** | NO |
| **Rationale** | Ideal least-privilege separates a DDL-capable migration role from a DML-only runtime role. Introducing two roles would have complicated Phase 0A without materially reducing risk on a single-operator server. Explicitly permitted by the Phase 0A brief §7. |
| **Target phase** | Phase 0B (alongside versioned migrations, TD-04) |
| **Status** | OPEN — accepted |

---

## Summary

### TD-18 — EVM/Solana contract addresses were fetched and discarded

| Field | Value |
|---|---|
| **Title** | Wallet scan retrieved contract/mint addresses but never persisted them |
| **Discovered** | 2026-09-01 · Phase 0B preflight |
| **Phase discovered** | Phase 0B |
| **Severity** | HIGH |
| **Blocker** | **WAS** — deterministic identity is impossible without an on-chain address |
| **Rationale** | `createHolding` stored only `connectionId, symbol, name, amount, avgCost`. Etherscan's `TokenInfo` did not even carry the address in its type, and the Solscan mint was dropped at the call site. Any resolution would have been symbol-only guessing. |
| **Resolution** | `contractAddress` added to `TokenInfo` and populated in both Etherscan paths; all `createHolding` call sites now persist `source_contract_address`, `source_chain_id`, `source_network_family`. |
| **Target phase** | Phase 0B |
| **Status** | RESOLVED |

---

### TD-19 — Historical holdings cannot be retroactively resolved

| Field | Value |
|---|---|
| **Title** | Holdings created before Phase 0B carry no contract address |
| **Discovered** | 2026-09-01 · Phase 0B |
| **Phase discovered** | Phase 0B |
| **Severity** | LOW *(currently zero-impact)* |
| **Blocker** | NO |
| **Rationale** | Rows written before TD-18 was fixed have only a symbol, so they can never be resolved deterministically — only re-scanned. **Current impact is zero**: the production database held 0 holdings at migration time. The exposure is theoretical unless a database is restored from an older backup. |
| **Mitigation** | Such rows stay `UNRESOLVED` and are re-resolved on the next wallet sync, which now captures the address. |
| **Target phase** | — |
| **Status** | OPEN — accepted |

---

### TD-20 — No admin UI for manual identity mapping

| Field | Value |
|---|---|
| **Title** | Manual override is supported in the data model but has no interface |
| **Discovered** | 2026-09-01 · Phase 0B |
| **Phase discovered** | Phase 0B |
| **Severity** | MEDIUM |
| **Blocker** | NO |
| **Rationale** | `holdings.manual_override` exists and `shouldApplyAutomaticResolution()` enforces its precedence, so a manual mapping is never silently overwritten. Setting one currently requires direct SQL. Building an admin UI would have widened Phase 0B well beyond identity. |
| **Target phase** | unassigned |
| **Status** | OPEN |

---

### TD-21 — Economic exposure groups are modelled but unpopulated

| Field | Value |
|---|---|
| **Title** | `assets.economic_group` exists with no seeding mechanism |
| **Discovered** | 2026-09-01 · Phase 0B |
| **Phase discovered** | Phase 0B |
| **Severity** | LOW |
| **Blocker** | NO for 0B · relevant at **Phase 7** |
| **Rationale** | The column supports computing concentration on real exposure (ETH across four chains is one exposure, not four). Deciding *how* groups are seeded — curated list, provider data, or both — is open question Q-2 in `02-ASSET-IDENTITY.md` and is a Portfolio Intelligence concern. |
| **Target phase** | Phase 7 |
| **Status** | OPEN |

---

### TD-22 — Snapshot cleanup requires disabling immutability triggers

| Field | Value |
|---|---|
| **Title** | No sanctioned path to remove a FINALIZED snapshot |
| **Discovered** | 2026-09-01 · Phase 1 |
| **Severity** | LOW |
| **Blocker** | NO |
| **Rationale** | The immutability triggers are deliberately absolute — that is the point. Removing test fixtures required `ALTER TABLE ... DISABLE TRIGGER`, which only the table owner can do. Acceptable today; a retention policy (archive vs delete) will eventually need a sanctioned, audited path. |
| **Target phase** | Phase 2 |
| **Status** | OPEN |

---

### TD-23 — Evidence retention policy undefined

| Field | Value |
|---|---|
| **Title** | Evidence is append-only with no retention or rollup policy |
| **Discovered** | 2026-09-01 · Phase 1 |
| **Severity** | MEDIUM |
| **Blocker** | NO |
| **Rationale** | Append-oriented storage is correct for auditability but grows without bound. Open question Q-1 in `03-EVIDENCE-PLATFORM.md`. No impact at current volume (0 rows); becomes material once collectors run continuously. |
| **Target phase** | Phase 2 |
| **Status** | OPEN |

---

### TD-24 — Third-party source terms never reviewed

| Field | Value |
|---|---|
| **Title** | ToS / caching / retention / redistribution status is UNKNOWN for all live data sources |
| **Discovered** | 2026-09-01 · Phase 1 |
| **Severity** | MEDIUM |
| **Blocker** | NO |
| **Rationale** | Etherscan, Solscan, CoinGecko, CoinMarketCap, and Binance are **pre-existing** integrations whose terms were never reviewed. The Evidence Store makes caching and retention explicit, which raises the stakes. Recorded honestly as `UNKNOWN — REQUIRES REVIEW` in `13-DATA-GOVERNANCE.md` rather than assumed. |
| **Target phase** | before any redistribution of derived data |
| **Status** | OPEN |

---

### TD-25 — Raw evidence payloads stored inline as text

| Field | Value |
|---|---|
| **Title** | `evidence.raw_value` is inline `text`, not JSONB or object storage |
| **Discovered** | 2026-09-01 · Phase 1 |
| **Severity** | LOW |
| **Blocker** | NO |
| **Rationale** | `text` keeps hashing and canonicalisation under application control and avoids PostgreSQL re-ordering JSONB keys, which would break hash determinism. The cost is no queryability inside the payload and unbounded row width for large responses. Open question Q-2 in `03-EVIDENCE-PLATFORM.md`. |
| **Target phase** | Phase 2 |
| **Status** | OPEN — accepted |

---

### TD-26 — No live provider implementation exists

| Field | Value |
|---|---|
| **Title** | `SecurityProvider` has an interface and a FakeProvider, but no real provider |
| **Discovered** | 2026-09-01 · Phase 1 |
| **Severity** | MEDIUM |
| **Blocker** | NO for Phase 1 · **YES for Phase 2** |
| **Rationale** | Deliberate: Phase 1's scope is the contract, and Palisade was evaluated to `REFERENCE_ONLY`. Phase 2 must implement a real provider — most likely direct GoPlus/Blockscout integration rather than a wrapper. |
| **Target phase** | Phase 2 |
| **Status** | OPEN — by design |

---

### TD-27 — Incident registry is manually curated and empty

| Field | Value |
|---|---|
| **Title** | `KNOWN_CRITICAL_EXPLOIT` is answered from a hand-maintained, currently empty registry |
| **Discovered** | 2026-09-01 · Phase 2 |
| **Severity** | MEDIUM |
| **Class** | `PRE-LAUNCH NON-BLOCKER` — **semantics fixed in remediation** |
| **Rationale** | Originally the empty registry produced a POSITIVE assurance and let native assets reach CLEAR. Fixed: an empty or scope-less registry now returns `COVERAGE_UNKNOWN`, which is not a completed check, so the capability falls to `missing` and the disposition becomes INSUFFICIENT_EVIDENCE. A "no incident" result means *not present in our registry*, not *no incident exists*. The mechanism, versioning and Event-Fact-vs-Assessment semantics are all correct; only the content is missing. The caveat is emitted in the observation payload so a CLEAR is never read as stronger than it is. Without this adapter no asset could reach CLEAR at all, since a CORE capability would have no source. |
| **Target phase** | Phase 3 or a curated advisory feed |
| **Status** | OPEN |

---

### TD-28 — GoPlus commercial use requires written permission

| Field | Value |
|---|---|
| **Title** | GoPlus licence restricts commercial use of its data |
| **Discovered** | 2026-09-01 · Phase 2 |
| **Severity** | HIGH |
| **Class** | ✅ **RESOLVED by removal** |
| **Rationale** | GoPlus is no longer in the production provider set, so its commercial-use restriction no longer binds any production path. Kept as DEVELOPMENT_ONLY. |
| **Status** | RESOLVED |

---

### TD-29 — GoPlus caching and retention terms unstated

| Field | Value |
|---|---|
| **Title** | The GoPlus agreement neither permits nor prohibits caching or retention |
| **Discovered** | 2026-09-01 · Phase 2 |
| **Severity** | MEDIUM |
| **Class** | ✅ **RESOLVED by removal** |
| **Rationale** | Absence of a clause is not permission. Rather than assume, GoPlus was removed from production entirely, so no caching or retention of its data occurs. |
| **Status** | RESOLVED |

---

### TD-30 — Public RPC endpoints have no availability guarantee

| Field | Value |
|---|---|
| **Title** | `direct-chain` depends on free public RPC endpoints |
| **Discovered** | 2026-09-01 · Phase 2 |
| **Severity** | MEDIUM |
| **Class** | `POST-LAUNCH` |
| **Rationale** | Best-effort endpoints may rate-limit or go down. Handled safely — a failure yields zero observations, reduces coverage, and can never produce CLEAR. Two of the four endpoints tested during evaluation were already unusable (`rpc.ankr.com` requires a key, `cloudflare-eth.com` errored), which is why the working set is pinned. |
| **Mitigation** | add fallback endpoints or a paid provider if reliability becomes a problem |
| **Status** | OPEN |

---

### TD-31 — EVM chain coverage is 8 of 19

| Field | Value |
|---|---|
| **Title** | `direct-chain` configures 8 EVM chains; the tracker supports 19 |
| **Discovered** | 2026-09-01 · Phase 2 |
| **Severity** | MEDIUM |
| **Class** | `PRE-LAUNCH NON-BLOCKER` |
| **Rationale** | Uncovered chains return `INSUFFICIENT_EVIDENCE`, never a false CLEAR — the fail-safe is correct and verified by test. Extending coverage is configuration, not architecture: one RPC URL per chain. |
| **Target phase** | Phase 3 or as holdings demand |
| **Status** | OPEN |

---

### TD-32 — EVM token security capabilities uncovered

| Field | Value |
|---|---|
| **Title** | Honeypot, sell restriction, sell tax and blacklist had no production source for EVM tokens |
| **Discovered** | 2026-09-01 · Phase 2 remediation |
| **Severity** | HIGH |
| **Class** | 🟡 **PRE-LAUNCH BLOCKER — 3 of 4 closed** |
| **Status** | PARTIALLY RESOLVED |

**Closed in Phase 2B** by `SellPathAdapter`, deterministic and provider-free:

| Capability | Method | Verdict model |
|---|---|---|
| HONEYPOT_INDICATOR | `eth_call` sell simulation, probe → pair, balance granted by `stateDiff` | `CONFIRMED_HONEYPOT_BEHAVIOR` / `NO_HONEYPOT_BEHAVIOR_OBSERVED_IN_TESTED_PATH` / `COVERAGE_INCOMPLETE` / `TEST_FAILED` |
| SELL_RESTRICTION | same simulation | `SELL_RESTRICTION_DETECTED` / `NO_RESTRICTION_OBSERVED_IN_TESTED_PATH` / … |
| BLACKLIST_CAPABILITY | bytecode selector scan (12 known interfaces) | `BLACKLIST_INTERFACE_DETECTED` / `NO_KNOWN_BLACKLIST_INTERFACE_DETECTED` / … |

No signing, no broadcast, no key, no user wallet, no funds. State overrides
live only inside the RPC node's simulation.

**Still open — SELL_TAX.** An effective tax is the recipient's balance delta
across the transfer, and a single `eth_call` cannot observe it. Measuring it
would need a probe contract deployed via `code` override that performs the
transfer and then reads `balanceOf`. Rather than infer a number we cannot
prove, the capability returns `COVERAGE_INCOMPLETE` — which is not a completed
check, so an EVM token with no tax measurement cannot reach CLEAR.

**Why the requirement was not lowered.** Marking SELL_TAX non-CORE would have
produced a PASS by redefinition. A 100% sell tax is economically identical to a
honeypot, so the requirement stands and the gap is recorded.

---|---|
| **Title** | Honeypot, sell restriction, sell tax and blacklist have no production source for EVM tokens |
| **Discovered** | 2026-09-01 · Phase 2 remediation |
| **Severity** | HIGH |
| **Class** | **`PRE-LAUNCH BLOCKER`** |
| **Rationale** | Removing GoPlus resolved the licence exposure but left four CORE EVM capabilities with no source. EVM tokens therefore return `INSUFFICIENT_EVIDENCE` — safe and honest, but it means Core Launch Gate condition 3 ("detects critical security risk") is **not met for EVM tokens**. Solana is unaffected: its checks are fully deterministic. |
| **Why not lower the requirement** | Dropping these from CORE to obtain a PASS would let Phase 4 recommend HOLD on an unscreened EVM token. The requirement stands; the gap is recorded. |
| **Resolution options** | written permission from GoPlus · a legally clear alternative provider · deterministic simulation-based honeypot detection (eth_call sell simulation) · self-hosted analysis |
| **Target phase** | before launch |
| **Status** | OPEN |

---

### TD-33 — Hosted RPC service terms unreviewed

| Field | Value |
|---|---|
| **Title** | Acceptable-use policies of PublicNode and the Solana Foundation RPC are unreviewed |
| **Discovered** | 2026-09-01 · Phase 2 remediation |
| **Severity** | LOW |
| **Class** | `PRE-LAUNCH NON-BLOCKER` |
| **Rationale** | Corrects an earlier overstatement that these had "no ToS". The blockchain DATA carries no licence and nothing we store belongs to the endpoint operator; what may bind us is service acceptable-use (rate limits, fair use). If a policy disallowed our call pattern the remedy is to change endpoint or self-host, not to delete evidence. |
| **Target phase** | before launch, or resolved by self-hosting a node |
| **Status** | OPEN |

---

### TD-34 — Sell simulation covers one route at one block

| Field | Value |
|---|---|
| **Title** | The sell probe exercises a single Uniswap V2 WETH path at `latest` with a fixed amount |
| **Discovered** | 2026-09-01 · Phase 2B |
| **Severity** | MEDIUM |
| **Class** | `PRE-LAUNCH NON-BLOCKER` |
| **Known false negatives** | amount-dependent gates above the probe size · time or block dependent gates (cooldowns, trading-enabled flags) · per-address allowlists the probe happens to satisfy · routes other than this V2 WETH pair · V3-only and non-WETH-paired tokens |
| **Why non-blocking** | The verdict name states the boundary — `NO_HONEYPOT_BEHAVIOR_OBSERVED_IN_TESTED_PATH` never claims universal safety, and the known false negatives ship in the evidence payload. A token with no V2 WETH pair yields `COVERAGE_INCOMPLETE`, not a pass. |
| **Status** | OPEN — accepted |

---

### TD-35 — Sell path implemented for Ethereum mainnet only

| Field | Value |
|---|---|
| **Title** | `FACTORY_BY_CHAIN` configures chain 1 only |
| **Discovered** | 2026-09-01 · Phase 2B |
| **Severity** | MEDIUM |
| **Class** | `PRE-LAUNCH NON-BLOCKER` |
| **Rationale** | Other EVM chains return `UNSUPPORTED` from this adapter, so their CORE capabilities stay missing and the disposition stays `INSUFFICIENT_EVIDENCE` — fail-safe, never a false CLEAR. Extending is configuration: a factory address, a wrapped-native address, an RPC per chain. |
| **Status** | OPEN |

---

### TD-36 — Balance slot discovery is a bounded probe

| Field | Value |
|---|---|
| **Title** | The balances mapping slot is found by probing slots 0–11 |
| **Discovered** | 2026-09-01 · Phase 2B |
| **Severity** | LOW |
| **Class** | `POST-LAUNCH` |
| **Rationale** | Bounded deliberately — unbounded storage scanning would be the start of a static analyser, which is out of scope. Tokens using an unusual layout, a proxy with a distant slot, or a non-standard structure yield `COVERAGE_INCOMPLETE` rather than a wrong answer. |
| **Status** | OPEN — accepted |

---

### Phase 0A exit blockers — all closed

| ID | Item | Status |
|---|---|---|
| TD-03 | `/health` endpoint | ✅ RESOLVED |
| TD-05 | Neon driver | ✅ RESOLVED |
| TD-11 | Backup inclusion | ✅ RESOLVED |
| TD-13 | vite in production bundle | ✅ RESOLVED *(discovered during 0A)* |
| TD-14 | Etherscan boot crash | ✅ RESOLVED *(discovered during 0A)* |

### Remaining

| Blocker | IDs |
|---|---|
| **Phase 0B blockers** | TD-04, TD-07 |
| **Phase 4 blockers** | TD-09 |
| Non-blocking / accepted | TD-01, TD-02, TD-08, TD-10, TD-15, TD-16, TD-17 |

### Phase 0B outcome

| ID | Item | Status |
|---|---|---|
| TD-07 | `symbol` as identity | ✅ RESOLVED |
| TD-18 | contract addresses discarded | ✅ RESOLVED *(discovered during 0B)* |
| TD-09 | no test suite | 🟡 PARTIALLY ADDRESSED |

### Remaining

| Blocker | IDs |
|---|---|
| **Phase 4 blockers** | TD-09 *(guardrail tests still needed)* |
| **Phase 7** | TD-21 |
| Non-blocking / accepted | TD-01, TD-02, TD-04, TD-08, TD-10, TD-15, TD-16, TD-17, TD-19, TD-20 |

### Phase 1 outcome

| ID | Item | Status |
|---|---|---|
| TD-09 | test suite | 🟡 50 tests now (13 identity + 37 evidence/security) |
| TD-22..TD-26 | new Phase 1 findings | OPEN, none blocking |

### Remaining

| Blocker | IDs |
|---|---|
| **Phase 2 blockers** | TD-26 (live provider) |
| **Phase 4 blockers** | TD-09 (guardrail tests) |
| **Phase 7** | TD-21 |
| Non-blocking / accepted | TD-01, TD-02, TD-04, TD-08, TD-10, TD-15, TD-16, TD-17, TD-19, TD-20, TD-22..TD-25 |

| Status | Count |
|---|---|
| RESOLVED | 8 |
| PARTIALLY ADDRESSED | 1 |
| OPEN | 17 |
