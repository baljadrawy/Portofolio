# Core Launch Scope

> **The central contract between what ships and what waits.**
>
> Where any other document implies a feature is required for launch and this one
> classifies it as POST-LAUNCH, **this document governs**.
>
> **Created:** 2026-09-01 · Core / Enhancements reorganisation

---

## 1. Product North Star

The product must answer one question at launch:

> **Is my reason for holding this asset still valid — or has evidence appeared
> that means I should keep holding, watch it, reduce it, or exit?**

At launch it must produce a **long-horizon investment decision that is
explainable and auditable**, built on evidence rather than model guesswork.

### Decision vocabulary (locked — `09-SCORING-AND-DECISION.md` §3)

```
STRONG_HOLD · HOLD_ACCUMULATE · HOLD · HOLD_MONITOR
REDUCE · EXIT · AVOID · SCAM_CRITICAL_RISK
```

The **vocabulary** ships complete at launch. The **sophistication** behind it
does not have to.

---

## 2. The classification rule

Every feature, phase, subsystem, and technical debt item is tested against
exactly one question:

```
Does the absence of this prevent a user, at launch, from getting a
trustworthy and explainable assessment of an asset they own, and from
taking HOLD / MONITOR / REDUCE / EXIT with reasonable safety?

YES → CORE / PRE-LAUNCH
NO  → ENHANCEMENT / POST-LAUNCH
```

### The rule that keeps this honest

```
"Useful" is not CORE.
"Impressive" is not CORE.
"Already designed" is not CORE.
CORE means: launch is unsafe or meaningless without it.
```

A feature already having an architecture document is **not** an argument for
including it. Most of the deferred work below is fully designed — that is
precisely why it is tempting, and precisely why the rule exists.

---

## 3. PART A — CORE / PRE-LAUNCH

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

Seven phases, three already passed. **Four remain to launch.**

Phase numbering is preserved from the original roadmap so history stays
traceable — passed phases keep their identifiers and their PASS verdicts.

---

## 4. CORE LAUNCH GATE

Launch happens when **all twelve** hold. Not when the backlog is empty.

| # | Condition |
|---|---|
| 1 | Identifies the **correct asset** — not a symbol collision, not a scam impersonator |
| 2 | Collects **trustworthy evidence** for it, with source and provenance |
| 3 | Detects **critical security risk** — honeypot, mint authority, freeze, ownership |
| 4 | Assesses the **investment factors that can change ownership** |
| 5 | Builds an **explainable thesis** |
| 6 | Detects **thesis breakers** |
| 7 | Emits **HOLD / MONITOR / REDUCE / EXIT** |
| 8 | Shows **why** the decision was reached |
| 9 | Shows the **evidence and its sources** |
| 10 | Handles **missing / stale / conflicting** data safely |
| 11 | **Persists** the analysis |
| 12 | Runs **stably in production** |

```
If all twelve hold, LAUNCH —
even with dozens of enhancements still open.
```

### What the gate deliberately does NOT require

- Portfolio-wide optimisation
- Continuous monitoring or alerting
- Multi-provider security consensus
- RAG, vector search, or document ingestion
- Price forecasting or scenario modelling
- A rich dashboard

---

## 5. PART B — ENHANCEMENTS / POST-LAUNCH

Everything below is **designed, documented, and deferred**. None of it blocks
the twelve gate conditions.

### B1 — Continuous Intelligence
scheduled re-analysis · event-driven re-analysis · automatic thesis
re-evaluation · smart alerts · alert dedup / hysteresis / cooldowns ·
scheduled portfolio reviews
*(originally Phase 8)*

### B2 — Advanced Security
multi-provider consensus · deployer graphs · wallet clustering · clone
detection at scale · bytecode similarity · continuous contract surveillance ·
cross-chain exploit correlation · historical scam scoring models

### B3 — Advanced Research
deep RAG · vector database · document and URL ingestion · advanced GitHub
analytics · community/sentiment intelligence · smart-money analysis ·
institutional flow intelligence
*(originally Phase 6)*

### B4 — Portfolio Intelligence
portfolio health score · concentration models · correlation and correlated-risk
clustering · sector and chain exposure · portfolio scenario analysis
*(originally Phase 7)*

### B5 — Optimization
efficient frontier · HRP · risk parity · allocation optimisation ·
Orbiter-style capability · stress testing · capital allocation recommendations
*(originally Phase 9 — already DEFERRED)*

### B6 — Forecasting
12m / 3y / 5y valuation scenarios · probability distributions · forecast
scoring · Brier tracking · prediction calibration

### B7 — Automation
automated review schedules · conditional alerts · event-triggered re-analysis

### B8 — Advanced UX
rich dashboards · comparison views · history visualisation · research
workspace · mobile-specific work

---

## 6. Governance requirements that ARE pre-launch

Three obligations are CORE not because they are features, but because launching
without them is unsafe.

### 6.1 Source governance (narrowed from TD-24)

```
Any source CORE actually uses AND whose data the system stores must have its
terms known well enough for that specific use before launch.
```

This is deliberately narrower than "review every source in the world". It is
also non-negotiable: `UNKNOWN` may not remain open past launch for a source we
are actively caching, where the storage itself could breach its terms.

### 6.2 Minimum retention policy (narrowed from TD-23)

If evidence is stored in production, a **minimum safe retention policy must be
stated** before launch. A stated policy of "retain indefinitely, revisit at
volume X" is acceptable. Automated lifecycle management is POST-LAUNCH.

### 6.3 Cost awareness

Before launch we must know, approximately:

- which paid APIs are involved
- expected LLM cost per analysis
- rate limits that constrain throughput
- **cost of analysing one asset**
- **cost of analysing a full portfolio**

A rough order of magnitude is sufficient. **No billing engine.** Advanced cost
optimisation is POST-LAUNCH.

---

## 7. AI scope at launch

AI enters CORE at Phase 3–4, for research and thesis synthesis. The
constitutional rule is unchanged:

```
Evidence → AI interpretation          ✅
AI → invented evidence                ❌
```

Pre-launch needs **only the minimum provider abstraction**. Multi-provider
routing, fallback chains, and cost-based model selection are POST-LAUNCH unless
an operational reason forces them earlier.

---

## 8. Explicit non-goals — before and after launch

```
The system analyses, explains, and recommends.

It does NOT:
  buy · sell · sign transactions · hold private keys ·
  execute trades automatically
```

Any trading automation is outside the product entirely, and remains so unless
the owner issues a new decision. This is not a sequencing choice; it is a
product boundary.

---

## 9. Scope-creep contract

```
═══════════════════════════════════════════════════════════════════════
Any new feature that surfaces during CORE work and does not block the
Core Launch Gate is recorded as a POST-LAUNCH enhancement or technical
debt. It is NOT implemented immediately.

Exceptions — implement immediately:
  1. A genuine security vulnerability
  2. A data corruption risk
  3. A material risk of a wrong investment decision
  4. A regulatory or terms-of-service blocker
  5. A production blocker
═══════════════════════════════════════════════════════════════════════
```

The five exceptions are exhaustive. "It would be quick" is not among them.

---

## 10. Technical debt classification

See `TECHNICAL-DEBT.md` for the full register. Summary:

| Class | IDs |
|---|---|
| **PRE-LAUNCH BLOCKER** | TD-24 *(narrowed)* · TD-26 |
| **PRE-LAUNCH NON-BLOCKER** | TD-09 · TD-23 *(narrowed)* |
| **POST-LAUNCH** | TD-01 · TD-02 · TD-04 · TD-08 · TD-10 · TD-15 · TD-16 · TD-17 · TD-19 · TD-20 · TD-21 · TD-22 · TD-25 |
| **RESOLVED** | TD-03 · TD-05 · TD-06 · TD-07 · TD-11 · TD-12 · TD-13 · TD-14 · TD-18 |

Only **two** items genuinely block launch.
