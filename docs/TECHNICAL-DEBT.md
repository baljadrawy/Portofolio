# Technical Debt Register

> **This is a LIVING document.** It is the authoritative register of known debt.
>
> `00-CURRENT-STATE-AUDIT.md` is a **historical snapshot** taken at commit
> `2521133`. When the two disagree, **this file is current**.

**Last updated:** 2026-08-31 (Documentation Correction Gate)

---

## How to use this register

- Add an entry when debt is discovered — do not silently absorb it
- Update `Status` when it changes; do not delete resolved entries
- `Blocker: YES` means a phase cannot reach PASS until it is resolved
- Every entry must state *why* it is or is not a blocker

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
|---|---|
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
|---|---|
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
|---|---|
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
|---|---|
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
|---|---|
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
|---|---|
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

## Summary

| Blocker | Count | IDs |
|---|---|---|
| **Phase 0A blockers** | 3 | TD-03, TD-05, TD-11 |
| **Phase 0B blockers** | 2 | TD-04, TD-07 |
| **Phase 4 blockers** | 1 | TD-09 |
| Non-blocking | 5 | TD-01, TD-02, TD-06, TD-08, TD-10 |

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH | 5 |
| MEDIUM | 3 |
| LOW | 2 |
