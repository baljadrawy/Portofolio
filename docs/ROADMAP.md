# Roadmap

> **Status:** Official phase plan.
> **Last corrected:** 2026-08-31 (Documentation Correction Gate)

---

## Implementation status — read this first

```
Phase 0A Pre-Execution Audit / Design Gate : PASS
Phase 0A Implementation Status             : NOT STARTED
```

> ### DESIGN/AUDIT APPROVED ≠ IMPLEMENTATION COMPLETE

Nothing in this roadmap has been built. As of the correction date, the following
**do not exist**:

| Item | Status |
|---|---|
| `portfolio` database | NOT CREATED |
| `portfolio_app` role | NOT CREATED |
| `.env.production` | NOT CREATED |
| `Dockerfile` | NOT CREATED |
| `docker-compose.yml` | NOT CREATED |
| `portfolio-app` container | NOT CREATED |
| `/health` endpoint | NOT IMPLEMENTED |
| node-postgres driver swap | NOT APPLIED (still `@neondatabase/serverless`) |
| Canonical Asset Registry | NOT IMPLEMENTED |

A design gate passing means *the plan was reviewed and approved*. It does not
mean anything was executed. Any future agent reading these documents must treat
every item above as work still to be done.

---

## Gate sequence

```
Documentation Correction Gate          ← current
        ↓
Phase 0A — Production Baseline
        ↓
Phase 0B — Canonical Asset Identity
        ↓
Phase 1  — Intelligence Foundations
        ↓
Phase 2  — Evidence + Security Platform
        ↓
Phase 3  — Asset Research MVP
        ↓
Phase 4  — Decision Intelligence
        ↓
Phase 5  — Thesis Memory
        ↓
Phase 6  — Advanced Intelligence
        ↓
Phase 7  — Portfolio Intelligence
        ↓
Phase 8  — Continuous Monitoring
        ↓
Phase 9  — Optimization  (DEFERRED)
```

---

## Phase 0A — Production Baseline

**Goal:** run the **existing application, unchanged in behaviour**, safely and
verifiably on the server.

### Scope

- [ ] Production container baseline (multi-stage, non-root, deterministic install)
- [ ] Shared PostgreSQL integration (external network, no new PG container)
- [ ] Database + role creation — *performed during execution, not before*
- [ ] Neon → `node-postgres` driver replacement — *performed during execution*
- [ ] Health / readiness endpoint
- [ ] Docker network integration
- [ ] Secret handling (outside Git, restricted file permissions)
- [ ] Backup inclusion verification
- [ ] Regression baseline

### Explicitly NOT in scope

```
❌ Canonical Asset Registry implementation
❌ Intelligence features
❌ Palisade
❌ AI
❌ Research
```

### Independence contract

```
Phase 0A can reach PASS without Canonical Asset Identity being started.
```

This is deliberate. The existing tracker is functional software; deploying it
must not be gated on a foundation that only the Intelligence Layer needs.

**Exit criteria:** container runs against shared PostgreSQL · health endpoint
responds · existing tracker functionality verified unchanged · backup coverage
confirmed · no regression against the pre-deployment baseline.

---

## Phase 0B — Canonical Asset Identity

**Goal:** build the foundation every Intelligence feature depends on.

### Scope

- [ ] Canonical asset registry
- [ ] Provider mappings (CoinGecko / CoinMarketCap / others)
- [ ] Chain / network identity
- [ ] Contract identity
- [ ] Duplicate ticker handling
- [ ] Wrapped / bridged asset handling
- [ ] Token migration and rebrand continuity
- [ ] Migration strategy for existing holdings

### Blocker scope — precise

```
Canonical Asset Identity = BLOCKER BEFORE INVESTMENT INTELLIGENCE
Canonical Asset Identity ≠ BLOCKER FOR CURRENT APPLICATION PRODUCTION DEPLOYMENT
```

Both halves are binding. See `02-ASSET-IDENTITY.md` §0.

**Exit criteria:** every holding resolves to an `asset_id` · rebrand lineage
preserves investment history · economic exposure groups defined · migration is
additive and reversible · tracker behaviour unchanged.

---

## Phase 1 — Intelligence Foundations

**Goal:** establish the contracts that everything downstream writes into —
**before** any engine starts producing data.

### Scope

- [ ] Minimal Evidence Core
- [ ] Evidence identity / provenance contract
- [ ] Source tier + freshness foundation
- [ ] `SecurityProvider` abstraction
- [ ] Palisade feasibility evaluation (license, maintenance, chains, **measured
      false-positive behaviour**)
- [ ] Security output contract — what a security finding looks like *as evidence*

### Explicitly NOT in scope

```
❌ Full Security Engine
❌ Scam Gate
❌ Full Evidence Store
```

### Why the ordering changed

The previous plan placed a full Security Engine at Phase 1, ahead of Evidence at
Phase 2. That would have produced security findings with nowhere correct to live.

```
Security findings ARE evidence.
```

Building a Security Engine first means building its own storage, then migrating
it into the Evidence Store later — a data silo created deliberately and paid for
twice. Phase 1 now lands the evidence contract and the security *interface*
together, so the first security finding ever produced is already written as
evidence.

**Exit criteria:** a security finding can be represented as an evidence record
with full provenance · `SecurityProvider` interface defined and stubbed ·
Palisade go/no-go decision recorded with measured evidence.

---

## Phase 2 — Evidence + Security Platform

**Goal:** the full evidence platform, with security as its first major producer.

### Scope

**Evidence**
- [ ] Full Evidence Store
- [ ] Evidence snapshots
- [ ] Conflict handling
- [ ] Freshness enforcement
- [ ] Event Store
- [ ] Caching
- [ ] Evidence audit trail

**Security (ingesting into the above)**
- [ ] Security ingestion into the Evidence Store
- [ ] Contract assessment
- [ ] Honeypot / rug indicators
- [ ] Security incident handling with component attribution
- [ ] Scam Gate
- [ ] False-positive safeguards (FP-1 … FP-8)
- [ ] Security score

### Architectural rule — binding

```
Security data must enter the same Evidence architecture.
```

Forbidden design:

```
❌  Security Engine → isolated storage → later migration to Evidence Store
```

**Exit criteria:** every stored fact traces to source + tier + `data_as_of` ·
snapshots reproduce identical inputs · conflicts surface rather than average ·
every security finding is queryable as evidence · Scam Gate can override with
published reasoning · false-positive rate measured on a known-good sample.

---

## Phase 3 — Asset Research MVP

- [ ] Fundamentals · Tokenomics · Token Utility · Adoption
- [ ] Competition · News/Catalysts · Regulation · Macro/Geopolitical
- [ ] Basic valuation
- [ ] Evidence-backed asset report

**Exit criteria:** a full asset report where every claim carries an `evidence_id`.

---

## Phase 4 — Decision Intelligence

- [ ] Modular analyst pipeline
- [ ] Evidence Graph
- [ ] Bull analysis · Bear analysis · Risk Judge
- [ ] Scoring v1 (three scores)
- [ ] Deterministic Decision Policy + guardrails
- [ ] Confidence model
- [ ] Structured output + Zod validation
- [ ] Verdict

**Exit criteria:** decisions come from the policy engine, not the model;
guardrail G-3 (price-only never → `EXIT`) is test-covered.

---

## Phase 5 — Thesis Memory

- [ ] Why I own this asset · horizon · assumptions · catalysts
- [ ] Thesis breakers · monitor / reduce / exit conditions
- [ ] Analysis history + previous/current comparison
- [ ] Explain score changes
- [ ] Thesis status + trend

**Exit criteria:** Question 17 — *what changed since last time?* — answerable as a diff.

---

## Phase 6 — Advanced Intelligence

- [ ] Deeper on-chain · revenue/economics · developer activity
- [ ] Whale intelligence · exchange flows · smart money *(where reliable)*
- [ ] Unlock intelligence · advanced valuation
- [ ] Community/sentiment *(Tier 4 — low evidence authority)*

---

## Phase 7 — Portfolio Intelligence

- [ ] Rank holdings · portfolio health
- [ ] Concentration · correlation · liquidity
- [ ] Chain / category / regulatory / security / unlock exposure
- [ ] Thesis health distribution
- [ ] Portfolio-level actions

**Exit criteria:** asset decisions and portfolio actions emitted separately.

---

## Phase 8 — Continuous Monitoring

- [ ] Scheduled + event-driven re-analysis
- [ ] Evidence freshness monitoring
- [ ] Thesis change detection
- [ ] Security · regulatory · competitor · unlock · material-change alerts

---

## Phase 9 — Optimization

**Status: `DEFERRED`**

### Scope (future)

- [ ] Portfolio allocation optimization
- [ ] Portfolio risk models
- [ ] Efficient frontier *where appropriate*
- [ ] HRP (Hierarchical Risk Parity)
- [ ] Risk parity
- [ ] Orbiter-style capabilities *where justified*
- [ ] Advanced scenario analysis
- [ ] Portfolio stress testing

### Deferral rationale

None of these are MVP blockers. All of them require reliable covariance
estimates, and crypto correlations are unstable and regime-dependent. Applying
them before the system has a track record produces confident allocations resting
on unstable inputs.

```
No Phase 9 item is an MVP blocker.
```

---

## Dependency graph

```
Phase 0A ────────────────────────► deployable product (independent path)
    │
    └──► Phase 0B ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
                                                  │                      │
                                                  └──────────────────────┤
                                                                         ▼
                                            Phase 6 ──► Phase 7 ──► Phase 8
                                                                         │
                                                                         ▼
                                                              Phase 9 (DEFERRED)
```

**0A is independent.** It can complete, ship, and operate while 0B has not
started. Everything from 0B onward is strictly sequential: Asset Identity and
Evidence are the two hard prerequisites, and nothing downstream is meaningful
without them.
