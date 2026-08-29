# Roadmap

> **Status:** Official phase plan. Phases are sequential; each depends on the
> contracts established by the previous one.

---

## Phase 0 — Foundation

**Goal:** production-deployable baseline + canonical asset identity.

- [ ] Production container baseline
- [ ] Shared PostgreSQL integration
- [ ] Health / readiness endpoints
- [ ] **Canonical asset identity** (`02 · Asset Identity`)
- [ ] Provider mappings on the asset registry
- [ ] Architecture contracts *(this documentation set — done)*
- [ ] Baseline regression suite

**Known Phase 0 task:** `server/db.ts` uses `@neondatabase/serverless`, which
cannot reach a self-hosted PostgreSQL. Requires swapping to
`pg` + `drizzle-orm/node-postgres`. See `00-CURRENT-STATE-AUDIT.md` §9.

> Docker / shared-PostgreSQL work is tracked separately and is **not** part of
> the documentation task that produced these files.

**Exit criteria:** container runs against shared PostgreSQL; every holding
resolves to an `asset_id`; existing tracker functionality unchanged.

---

## Phase 1 — Security Foundation

**Why first among intelligence work:** security findings can *override* every
other conclusion (`07 · Security Engine` §5). A scoring system that can be
overridden by a layer that does not exist yet is incomplete.

- [ ] `SecurityProvider` abstraction
- [ ] Palisade feasibility evaluation → integration decision
- [ ] Contract assessment
- [ ] Scam Gate
- [ ] Honeypot / rug indicators
- [ ] Security incident model with component attribution
- [ ] False-positive safeguards (FP-1 … FP-8)
- [ ] Security score

**Exit criteria:** a held asset can be assessed for contract-level risk with
evidence; the Scam Gate can override with published reasoning; measured
false-positive rate on a known-good sample.

---

## Phase 2 — Evidence Platform

- [ ] Evidence Store
- [ ] Provenance
- [ ] Source tiers
- [ ] Freshness matrix
- [ ] Evidence snapshots
- [ ] Conflict handling
- [ ] Event Store
- [ ] Caching
- [ ] Evidence audit trail

**Exit criteria:** every stored fact traces to source + tier + `data_as_of`;
snapshots reproduce identical inputs; conflicts surface rather than average.

---

## Phase 3 — Asset Research MVP

- [ ] Fundamentals · Tokenomics · Token Utility · Adoption
- [ ] Competition · News/Catalysts · Regulation · Macro/Geopolitical
- [ ] Basic valuation
- [ ] Evidence-backed asset report

**Exit criteria:** a full asset report generated where every claim carries an
`evidence_id`.

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

**Exit criteria:** decisions come from the policy engine, not the model; G-3
(price-only never → `EXIT`) is test-covered.

---

## Phase 5 — Thesis Memory

- [ ] Why I own this asset · horizon · assumptions · catalysts
- [ ] Thesis breakers · monitor / reduce / exit conditions
- [ ] Analysis history + previous/current comparison
- [ ] Explain score changes
- [ ] Thesis status + trend

**Exit criteria:** Question 17 — *what changed since last time?* — is answerable
with a diff.

---

## Phase 6 — Advanced Intelligence

- [ ] Deeper on-chain · revenue/economics · developer activity
- [ ] Whale intelligence · exchange flows · smart money *(where reliable)*
- [ ] Unlock intelligence · advanced valuation
- [ ] Community/sentiment *(low evidence authority — Tier 4)*

---

## Phase 7 — Portfolio Intelligence

- [ ] Rank holdings · portfolio health
- [ ] Concentration · correlation · liquidity
- [ ] Chain / category / regulatory / security / unlock exposure
- [ ] Thesis health distribution
- [ ] Portfolio-level actions

**Exit criteria:** asset decisions and portfolio actions are emitted separately.

---

## Phase 8 — Continuous Monitoring

- [ ] Scheduled + event-driven re-analysis
- [ ] Evidence freshness monitoring
- [ ] Thesis change detection
- [ ] Security · regulatory · competitor · unlock · material-change alerts

---

## Phase 9 — Optimization

- [ ] Allocation optimization
- [ ] Portfolio risk models
- [ ] Orbiter-style capabilities *where justified*

> **Note:** the source brief for this roadmap was truncated mid-sentence during
> Phase 9 ("advan…"). Phase 9 content above reflects only what was received and
> should be confirmed before work begins.

---

## Dependency graph

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
   │                        │                       │
   │                        └───────────────────────┤
   └────────────────────────────────────────────────┘
                                                     │
                            Phase 6 ◄────────────────┘
                                │
                            Phase 7 ──► Phase 8 ──► Phase 9
```

Asset Identity (Phase 0) and Evidence (Phase 2) are the two hard prerequisites —
nothing downstream is meaningful without them.
