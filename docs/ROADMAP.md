# Roadmap

> **Status:** Official phase plan.
> **Last corrected:** 2026-08-31 (Documentation Correction Gate)

---

## Implementation status — read this first

```
PART A — CORE / PRE-LAUNCH
  Phase 0A Production Baseline .......... PASS
  Phase 0B Canonical Asset Identity ..... PASS
  Phase 1  Intelligence Foundations ..... PASS
  Phase 2  Core Evidence + Security ..... NEXT
  Phase 3  Core Research ................ pending
  Phase 4  Investment Thesis + Decision . pending
  Phase 5  MVP Product Integration ...... pending
  Phase 6  Pre-Launch Validation / UAT .. pending
  ─────────── CORE LAUNCH GATE ───────────

PART B — ENHANCEMENTS / POST-LAUNCH ..... deferred (B1..B8)
```

> ### DESIGN/AUDIT APPROVED ≠ IMPLEMENTATION COMPLETE
>
> This distinction still governs every phase below. Phases 0A and 0B are marked
> implemented because they were executed and verified, not because they were
> designed.

Phases 0A, 0B and 1 are built and verified. Everything from Phase 2 onward is design only.

| Item | Status |
|---|---|
| `portfolio` database | ✅ CREATED (Phase 0A) |
| `portfolio_app` role | ✅ CREATED (Phase 0A) |
| `.env.production` | ✅ CREATED (Phase 0A, gitignored, 600) |
| `Dockerfile` · `docker-compose.yml` | ✅ CREATED (Phase 0A) |
| `portfolio-app` container | ✅ RUNNING healthy on port 3003 (Phase 0A) |
| `/health` endpoint | ✅ IMPLEMENTED — 200 / 503 (Phase 0A) |
| node-postgres driver swap | ✅ APPLIED (Phase 0A) |
| Canonical Asset Registry | ✅ IMPLEMENTED (Phase 0B) |
| Evidence Store · Event Store | ❌ NOT IMPLEMENTED (Phase 2) |
| Security Engine · Scam Gate | ❌ NOT IMPLEMENTED (Phase 2) |
| AI / Research / Thesis / Decision | ❌ NOT IMPLEMENTED |

A design gate passing means *the plan was reviewed and approved*. It does not
mean anything was executed. Any future agent reading these documents must treat
every item above as work still to be done.

---

## Two-part structure

Reorganised 2026-09-01. The governing contract is
[`CORE-LAUNCH-SCOPE.md`](./CORE-LAUNCH-SCOPE.md); where it and this file
disagree about what blocks launch, that file wins.

### PART A — CORE / PRE-LAUNCH

```
Phase 0A  Production Baseline .............. PASS
    ↓
Phase 0B  Canonical Asset Identity ......... PASS
    ↓
Phase 1   Intelligence Foundations ......... PASS
    ↓
Phase 2   Core Evidence + Security ......... NEXT
    ↓
Phase 3   Core Research
    ↓
Phase 4   Investment Thesis + Decision
    ↓
Phase 5   MVP Product Integration
    ↓
Phase 6   Pre-Launch Validation / UAT
    ↓
═══════════ CORE LAUNCH GATE ═══════════
```

**Four phases remain to launch.**

### PART B — ENHANCEMENTS / POST-LAUNCH

```
B1  Continuous Intelligence      (was Phase 8)
B2  Advanced Security
B3  Advanced Research            (was Phase 6)
B4  Portfolio Intelligence       (was Phase 7)
B5  Optimization                 (was Phase 9)
B6  Forecasting
B7  Automation
B8  Advanced UX
```

Phase numbers of passed phases are preserved so history stays traceable.
Phases 6–9 of the original plan were **reclassified**, not renumbered in place:
their content moved to PART B and the CORE track reuses 5 and 6 for the two
remaining product phases. The mapping is stated explicitly above and in
`CORE-LAUNCH-SCOPE.md` §5.

---

# PART A — CORE / PRE-LAUNCH

> Everything below is required to reach the **Core Launch Gate**. Nothing else is.
> Classification rule and the gate itself: [`CORE-LAUNCH-SCOPE.md`](./CORE-LAUNCH-SCOPE.md).

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

### Implementation outcome (2026-09-01)

`PASS`. Delivered:

- `assets` · `asset_network_identities` · `asset_provider_mappings` · `asset_aliases`
- `holdings` and `transactions` gained nullable `asset_id`, `identity_status`,
  and source-provenance columns — additive, non-destructive
- `AssetIdentityService`: deterministic, precedence-ordered, **no AI**
- Pure rules extracted to `shared/asset-identity-rules.ts` — 13 tests, all passing
- EVM contract addresses and Solana mints are now **captured** at scan time;
  previously the services fetched them and discarded them, which made
  deterministic resolution impossible

Production data at migration time was empty (0 holdings / 0 transactions), so no
existing rows required resolution. The resolver still refuses to guess: a
symbol-only match yields `AMBIGUOUS`, never `RESOLVED`.

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

### Implementation outcome (2026-09-01)

`PASS`. Delivered:

- `evidence_sources` · `evidence` · `evidence_snapshots` · `evidence_snapshot_items`
- Three distinct timestamps (`observed_at` / `effective_at` / `retrieved_at`) so
  historical replay cannot see the future
- Deterministic hashing with canonical JSON and a `hash_version`
- Dedup scoped to `(source_key, hash)` — **corroboration from a different source
  is deliberately allowed through**, enforced by a DB unique index
- Snapshot immutability enforced by database triggers, not application discipline
- `SecurityProvider` abstraction — provider-neutral, read-only, minimum-data
- Palisade evaluated at commit `7df719d` → **`REFERENCE_ONLY`**, no adapter built
- 50 tests passing (13 identity + 37 evidence/freshness/security)

Nothing here produces a decision, a score, or an AI call.

---

## Phase 2 — Core Evidence + Security  ·  `CORE` · **NEXT**

**Goal:** make evidence genuinely usable, and detect the security risks that
would make a HOLD recommendation dangerous.

**Why required before launch:** gate conditions 2, 3, and 10. Without a live
security provider the system could recommend HOLD on a honeypot — the single
worst failure this product can produce.

**Entry gate:** Phase 1 PASS (evidence contracts, `SecurityProvider`
abstraction, freshness rules all exist and are tested).

### CORE scope

- [ ] Evidence ingestion actually wired to real collectors
- [ ] Source and provenance enforcement in the ingestion path
- [ ] Freshness enforcement (not merely computable — enforced)
- [ ] Conflict representation in practice
- [ ] Minimum event foundation **only if** required by security incidents
- [ ] **One or more live security providers** (TD-26 — PRE-LAUNCH BLOCKER)
- [ ] Contract / token security observations
- [ ] Scam-critical checks sufficient to refuse HOLD on a clearly dangerous asset
- [ ] Security findings → Evidence Core
- [ ] Fail-safe behaviour when data is absent
- [ ] Basic false-positive safeguards

### Security CORE vs ENHANCEMENT

| CORE — ships in Phase 2 | POST-LAUNCH (B2) |
|---|---|
| contract verification | advanced deployer graph |
| honeypot / sell restriction | wallet clustering |
| mint authority / unlimited mint | clone detection at scale |
| blacklist / freeze capability | bytecode similarity |
| proxy / admin upgradeability | continuous contract surveillance |
| ownership privileges | cross-chain exploit correlation |
| basic liquidity risk | large multi-provider consensus engine |
| basic holder concentration | historical security scoring models |
| known critical incidents | |
| provider failure handling | |
| multiple-evidence requirement for critical verdicts | |

### Explicit exclusions

```
❌ Full Scam Gate with weighted multi-provider consensus
❌ Full Event Store (only the minimum security incidents need)
❌ Continuous monitoring
❌ Palisade adapter — REFERENCE_ONLY stands; do not reverse without new evidence
```

**Provider strategy:** Phase 2 looks for the **capabilities** we need, not for a
single "Palisade replacement". A combination is acceptable and expected:

```
direct provider A + direct provider B + on-chain verification
+ internal deterministic rules
```

**Exit gate:** a held asset can be assessed for critical contract risk with
evidence · security findings are queryable as evidence · a provider failure
reduces coverage and never implies safety · false-positive rate measured on a
known-good sample · at least one live provider in production.

---

## Phase 3 — Core Research  ·  `CORE`

**Goal:** cover only the factors that can **materially change the decision to
own an asset**.

**Why required before launch:** gate condition 4.

**Entry gate:** Phase 2 PASS.

### The filter every module must pass

```
What evidence can materially change the ownership thesis?
```

A module that cannot answer this is not built. We are not producing an
encyclopedia.

### CORE modules

| Module | The decision it can change |
|---|---|
| Market Context | is the price environment relevant to the thesis |
| Project / Use Case | does the thing still do something people need |
| Adoption | is usage growing or collapsing |
| Tokenomics | does supply behaviour undermine holding |
| Major Unlock Risk | is a large supply event imminent |
| On-chain essentials | do the chain facts contradict the story |
| Security | is it dangerous to hold at all |
| Competition | is it losing its position |
| Development / Team | is anyone still building it |
| Regulatory | is there a legal impairment |
| Material News / Catalysts | did something decisive just happen |
| Macro / Geopolitical *(when materially relevant)* | is there a transmission path to this asset |

### Macro / Geopolitical — CORE is the causal chain only

```
Event → Causal Path → Asset/Market Exposure → Potential Thesis Impact
```

Required separation:

```
MACRO / MARKET-WIDE RISK   ≠   ASSET-SPECIFIC RISK
```

An event with no identified transmission path to the asset produces **no**
thesis impact, however alarming the headline. A full geopolitical engine and
continuous monitoring are POST-LAUNCH.

### Competition — CORE answers one question

```
Is the asset actually losing ground to competitors?
```

**CORE:** peer group · major competitors · relative positioning · material
market-share or adoption trend where trustworthy evidence exists.

**POST-LAUNCH:** continuous competitor surveillance · advanced market-share
modelling · automated competitive alerts · deep ecosystem graph.

### Explicit exclusions

```
❌ Deep RAG / vector search / document ingestion   (B3)
❌ Advanced GitHub analytics                       (B3)
❌ Sentiment intelligence beyond Tier-4 discovery  (B3)
❌ Smart-money and institutional flow analysis     (B3)
```

**Exit gate:** an evidence-backed report per asset where every claim carries an
`evidence_id`, covering the CORE modules, with coverage and missing categories
stated explicitly.

---

## Phase 4 — Investment Thesis + Decision  ·  `CORE`

**Goal:** turn assessments into an auditable investment decision.

**Why required before launch:** gate conditions 5, 6, 7, 8. **There is no
product without this phase** — everything before it is infrastructure.

**Entry gate:** Phase 3 PASS.

> **Merge note:** the original plan split this across Phase 4 (Decision
> Intelligence) and Phase 5 (Thesis Memory). They are merged because a decision
> without a thesis is unexplainable, and a thesis with no decision is inert.
> Shipping one without the other cannot satisfy the launch gate.

### The pipeline

```
Evidence → Research Assessments → Investment Thesis → Thesis Breakers
        → Risk Assessment → Decision Policy → HOLD / MONITOR / REDUCE / EXIT
```

### Three separate scores — CORE, not optional

```
PROJECT QUALITY            is this a real, well-run project?
TOKEN INVESTMENT QUALITY   does the token capture the project's value?
CURRENT ENTRY VALUATION    is the price reasonable now?
```

Because:

```
Good Project ≠ Good Token
Good Token   ≠ Good Price
```

A single blended number hides exactly the distinction that matters most.

### Thesis Breakers — CORE

The system must distinguish:

| Layer | Example | Consequence |
|---|---|---|
| Price drawdown | −30% price | **not** thesis failure |
| Temporary problem | outage, since fixed | not thesis failure; recurrence tracked |
| Fundamental deterioration | users, revenue, developers declining | WEAKENING / IMPAIRED |
| **Thesis breaker** | persistent developer collapse **+** activity collapse **+** major dilution **+** permanent share loss | BROKEN → EXIT eligible |

```
A falling price alone may NEVER trigger EXIT automatically.
```

### Decision guardrails — CORE

The LLM does not own the final decision. Deterministic policy does.

```
confirmed critical scam            → SCAM_CRITICAL_RISK
permanent protocol impairment      → REDUCE / EXIT eligible
temporary drawdown, no breaker     → cannot independently trigger EXIT
missing critical evidence          → lower confidence, never invented facts
```

### Explicit exclusions

```
❌ Confidence calibration models        (POST-LAUNCH)
❌ Forecast scoring / Brier tracking    (B6)
❌ Multi-provider AI routing            (POST-LAUNCH)
❌ Portfolio-level decisions            (B4)
```

**Exit gate:** decisions come from the policy engine, not the model · the
price-only-never-EXIT guardrail is test-covered · three scores emitted
separately · thesis and breakers persisted · every decision explains itself
from stored evidence.

---

## Phase 5 — MVP Product Integration  ·  `CORE`

**Goal:** make the analysis usable by a human.

**Why required before launch:** gate conditions 8, 9, 11. Analysis nobody can
see is not a product.

**Entry gate:** Phase 4 PASS.

### The fourteen things a user must be able to do

```
 1. see holdings                     8. see thesis breakers
 2. pick an asset                    9. see the score / assessment
 3. run "Analyze Investment"        10. see confidence and coverage
 4. see data status                 11. see the decision
 5. see key evidence + sources      12. see WHY that decision
 6. see risks                       13. save the analysis
 7. see the thesis                  14. see the previous analysis (basic)
```

### Portfolio-level — deliberately minimal

Per-asset analysis is sufficient for a useful MVP, so portfolio-wide
intelligence is POST-LAUNCH (B4). Two things are CORE **only because they are
trivial on top of per-asset results**:

- holdings ranked by risk / recommended action
- critical warnings surfaced across the portfolio

```
Portfolio optimisation is NOT a launch blocker.
```

### Explicit exclusions

```
❌ Rich dashboards, comparison views, research workspace   (B8)
❌ Advanced history visualisation                          (B8)
❌ Portfolio health score, concentration, correlation      (B4)
❌ Mobile-specific work                                    (B8)
```

**Exit gate:** a user completes all fourteen actions end-to-end in production.

---

## Phase 6 — Pre-Launch Validation / UAT  ·  `CORE`

**Goal:** prove the system is safe to trust with real money decisions.

**Why required before launch:** gate conditions 10 and 12. Every prior phase
verified its own work; this phase verifies the **whole**, including the failure
paths that only appear under composition.

**Entry gate:** Phase 5 PASS.

### Required validation

```
[ ] full regression across all phases
[ ] security review
[ ] evidence correctness
[ ] source failure behaviour
[ ] stale data behaviour
[ ] insufficient evidence behaviour
[ ] wrong-asset protection            ← identity is the deepest failure mode
[ ] scam false-positive scenarios
[ ] scam false-negative scenarios     ← the dangerous direction
[ ] decision guardrails under adversarial input
[ ] historical snapshot correctness
[ ] UAT with a real user on real holdings
[ ] backup AND restore verification   ← restore still unproven (TD deferred)
[ ] production deployment verification
[ ] minimum observability
[ ] rollback procedure
```

**Exit gate:** all sixteen pass · no PRE-LAUNCH BLOCKER debt open · the twelve
Core Launch Gate conditions demonstrably hold.

---

# PART B — ENHANCEMENTS / POST-LAUNCH

> Designed, documented, deferred. None of this blocks the Core Launch Gate.
> Full listing in [`CORE-LAUNCH-SCOPE.md`](./CORE-LAUNCH-SCOPE.md) §5.

## B1 — Continuous Intelligence *(was Phase 8)*
scheduled and event-driven re-analysis · evidence freshness monitoring · thesis
change detection · security / regulatory / competitor / unlock alerts · alert
dedup, hysteresis and cooldowns · scheduled portfolio reviews

## B2 — Advanced Security
multi-provider consensus · deployer graphs · wallet clustering · clone detection
at scale · bytecode similarity · continuous contract surveillance · cross-chain
exploit correlation · historical scam scoring

## B3 — Advanced Research *(was Phase 6)*
deep RAG · vector database · document and URL ingestion · advanced GitHub
analytics · community and sentiment intelligence · smart-money analysis ·
institutional flow intelligence · whale intelligence · exchange flows

## B4 — Portfolio Intelligence *(was Phase 7)*
portfolio health score · concentration models · correlation and risk clustering
· sector, chain, regulatory, security and unlock exposure · thesis health
distribution · portfolio scenario analysis · portfolio-level actions

## B5 — Optimization *(was Phase 9 — already DEFERRED)*
allocation optimisation · portfolio risk models · efficient frontier · HRP ·
risk parity · Orbiter-style capability · stress testing · capital allocation

### Deferral rationale (unchanged)
All of B5 requires reliable covariance estimates. Crypto correlations are
unstable and regime-dependent; applying these before the system has a track
record produces confident allocations resting on unstable inputs.

## B6 — Forecasting
12m / 3y / 5y valuation scenarios · probability distributions · forecast scoring
· Brier tracking · prediction calibration

Arithmetic consistency remains binding whenever built: `price × supply = market cap`.

## B7 — Automation
automated review schedules · conditional alerts · event-triggered re-analysis

## B8 — Advanced UX
rich dashboards · comparison views · advanced history visualisation · research
workspace · mobile-specific enhancements

---

## Critical path to launch

```
Phase 0A ──► deployable product (independent)
    │
    └──► Phase 0B ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
         PASS         PASS        NEXT                                            │
                                                                                  ▼
                                                                        CORE LAUNCH GATE
```

**Strictly sequential from 0B onward.** Four phases remain.

### The only two things that genuinely block launch

| ID | Item | Phase |
|---|---|---|
| **TD-26** | no live SecurityProvider — the system could recommend HOLD on a honeypot | Phase 2 |
| **TD-24** | source terms unknown for sources CORE actually stores data from *(narrowed)* | before launch |

Everything else is scheduled, not blocking.

### PART B has no ordering constraint

B1–B8 are independent of each other and of the launch date. They are ordered by
value after launch, not by dependency.
