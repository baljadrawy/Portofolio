# Portfolio Investment Intelligence — Architecture Documentation

> **This directory is the Source of Truth** for the Investment Intelligence
> platform. Where code and these documents disagree, the disagreement is a defect
> in one of them and must be resolved explicitly — not ignored.

---

## Gate status

```
Completed    : Phase 0A · Phase 0B · Phase 1
Next Gate    : PHASE 2 — EVIDENCE + SECURITY PLATFORM
```



> ### DESIGN/AUDIT APPROVED ≠ IMPLEMENTATION COMPLETE

Phases 0A, 0B, and 1 are **implemented and verified**. Everything from Phase 2
onward is design only. See [`ROADMAP.md`](./ROADMAP.md) for exact status per item.

---

## What this is

`baljadrawy/Portofolio` is today a working **cryptocurrency portfolio tracker**.

These documents define its evolution into a **Portfolio Investment Intelligence
Platform** — a system that answers, continuously and with auditable evidence:

> Is my reason for owning this asset still valid, or has evidence appeared that
> means I should monitor it, reduce it, or exit?

**It is not a trading bot.** It has no execution capability by design.

---

## Reading order

| # | Document | Read it for |
|---|---|---|
| 00 | [Current State Audit](./00-CURRENT-STATE-AUDIT.md) | **Start here.** Verified reality — *historical snapshot* |
| 01 | [Vision and Principles](./01-VISION-AND-PRINCIPLES.md) | The 18 questions, the pipeline, the invariants |
| 02 | [Canonical Asset Identity](./02-ASSET-IDENTITY.md) | **Phase 0B.** Blocks Intelligence, *not* deployment |
| 03 | [Evidence Platform](./03-EVIDENCE-PLATFORM.md) | The evidence contract, dedup, conflicts, provenance |
| 04 | [Source Quality and Freshness](./04-SOURCE-QUALITY-AND-FRESHNESS.md) | Tiers 1–5, freshness matrix, conflict resolution |
| 05 | [Event Intelligence](./05-EVENT-INTELLIGENCE.md) | Event store, **security incident attribution** |
| 06 | [Research Modules](./06-RESEARCH-MODULES.md) | The 16 modules and their contracts |
| 07 | [Security and Scam Engine](./07-SECURITY-AND-SCAM-ENGINE.md) | Spam filtering vs. security assessment, Scam Gate |
| 08 | [Thesis Memory](./08-THESIS-MEMORY.md) | Thesis contract, the four deterioration layers |
| 09 | [Scoring and Decision](./09-SCORING-AND-DECISION.md) | Scoring v1, decision enum, deterministic policy |
| 10 | [AI Provider Abstraction](./10-AI-PROVIDER-ABSTRACTION.md) | Provider interface, structured output |
| 11 | [Portfolio Intelligence](./11-PORTFOLIO-INTELLIGENCE.md) | Asset decision vs. portfolio action, monitoring |
| 12 | [External References](./12-EXTERNAL-REFERENCES.md) | Palisade **(evaluated → REFERENCE_ONLY)**, VerumTrade, openportfolio, analystOS, Orbiter |
| 13 | [Data Governance](./13-DATA-GOVERNANCE.md) | Source ToS/licensing status · privacy contract |
| — | [Roadmap](./ROADMAP.md) | Phases 0A–9 with exit criteria and gate status |
| — | [Technical Debt](./TECHNICAL-DEBT.md) | **Living register.** Authoritative over doc 00 |
| — | [ADRs](./adr/) | Decisions that require an ADR to change |

---

## The rules that govern everything

### 1. Evidence

```
LLM interprets evidence. It does not manufacture evidence.
```

Every fact traces to an `evidence_id` with source, tier, and `data_as_of`. A
claim without an evidence reference is a **bug**, not a style issue.

### 2. Signal ≠ Decision

```
Evidence → Signal → Assessment → Thesis Impact → Decision
```

`TVL -40% → SELL` is forbidden. No metric maps directly to an action.

### 3. Price alone never triggers EXIT

Guardrail G-3. A drawdown with no accompanying fundamental evidence produces at
most `HOLD_MONITOR`.

### 4. Suspicious ≠ Confirmed

Only `CONFIRMED_MALICIOUS`, backed by multiple independent indicators, can
trigger the Scam Gate override.

### 5. Missing evidence is not neutral

`MISSING` and `STALE` are recorded explicitly and **cap confidence**. "We could
not check" is never rendered as "there is no problem".

### 6. Asset decisions ≠ portfolio actions

`HOLD` (asset) and `REDUCE EXPOSURE` (portfolio) can both be true at once.

### 7. Asset Identity blocks Intelligence, not deployment

```
Canonical Asset Identity = BLOCKER BEFORE INVESTMENT INTELLIGENCE
Canonical Asset Identity ≠ BLOCKER FOR CURRENT APPLICATION PRODUCTION DEPLOYMENT
```

### 8. Security data enters the Evidence architecture

```
Security findings ARE evidence.
```

No security-only datastore. Forbidden: `Security Engine → isolated storage →
later migration to Evidence Store`.

---

## Locked contracts

Changing any of these requires an **ADR**:

| Contract | Where |
|---|---|
| Decision enum (8 values) | `09 · Scoring and Decision` §3 |
| Security incident attribution taxonomy | `05 · Event Intelligence` §5 |
| Evidence provenance requirement | `03 · Evidence Platform` §10 |
| Deterministic decision policy guardrails | `09 · Scoring and Decision` §5 |

---

## Scope boundary

```
Portfolio Core  (exists — Wallets · Exchanges · Holdings · Transactions · Prices)
        │
        │  read-only
        ▼
Intelligence Layer  (new — never writes Portfolio Core data)
```

Turning Intelligence off leaves a fully working tracker.

---

## Status

These documents are **architecture contracts, not implementation.**

- No Intelligence feature has been built
- No production deployment has been performed
- No database, role, or container has been created

See [Current State Audit](./00-CURRENT-STATE-AUDIT.md) for what existed at commit
`2521133`, and [Technical Debt](./TECHNICAL-DEBT.md) for the current, maintained
register.
