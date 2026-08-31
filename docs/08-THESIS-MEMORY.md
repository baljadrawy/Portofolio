# Thesis Memory and Thesis Breakers

> 🟢 **CORE / PRE-LAUNCH** (Phase 4) — gate conditions 5 and 6. Thesis and Thesis Breakers
> both ship at launch. A falling price alone may never trigger EXIT.
>
> **Status:** Architecture contract. Phase 5.

---

## 1. Purpose

The system must remember **why an asset was bought** — otherwise it cannot judge
whether that reason still holds. Without thesis memory, every analysis restarts
from zero and the central question of the platform is unanswerable.

---

## 2. Thesis contract

```
thesis
├── thesis_id
├── asset_id
│
├── why_owned              free text — the human reason, in the owner's words
├── investment_horizon     SHORT | MEDIUM | LONG | INDEFINITE
│
├── assumptions[]          testable statements this thesis rests on
├── expected_catalysts[]   what should happen, and by when
├── risk_factors[]         known risks accepted at purchase
│
├── thesis_breakers[]      conditions that would invalidate the thesis entirely
├── monitor_conditions[]   conditions that warrant closer attention
├── reduce_conditions[]    conditions that warrant reducing exposure
├── exit_conditions[]      conditions that warrant exiting
│
├── status                 HEALTHY | WEAKENING | IMPAIRED | BROKEN
├── trend                  IMPROVING | STABLE | DETERIORATING
│
├── created_at
└── updated_at
```

### Assumptions must be testable

```
❌  "I think Solana is good"
✅  "Solana retains >20% of non-EVM DEX volume through 2027"
```

An untestable assumption cannot be checked against evidence, so it cannot be
part of an automated thesis review. The system should prompt for testable
phrasing at capture time.

---

## 3. The four-layer deterioration model

The system's core discriminative task: distinguishing noise from failure.

### Layer 1 — Price Drawdown

```
price -35%
```

**Not a thesis failure.** Price is an output of market conditions, not evidence
about the project. Alone it produces at most `HOLD_MONITOR`.

### Layer 2 — Temporary Problem

An outage that was fixed. A depeg that recovered. A bug that was patched.

**Not a thesis failure**, but it is evidence — recurrence risk is tracked, and a
pattern of "temporary" problems is itself a signal.

### Layer 3 — Fundamental Deterioration

Sustained, evidenced decline:

- users falling over multiple periods
- revenue falling
- developer activity collapsing
- liquidity deteriorating
- market share eroding to competitors

**Thesis moves to `WEAKENING` or `IMPAIRED`.** Typically `HOLD_MONITOR` or
`REDUCE` depending on severity and confidence.

### Layer 4 — Thesis Breaker

A strong body of evidence for a **permanent** impairment:

- permanent competitive loss
- unsustainable tokenomics with no path to correction
- catastrophic security failure
- major regulatory impairment
- team abandonment
- economic model failure
- confirmed scam / rug

**Thesis moves to `BROKEN`.** This is the only layer that justifies `EXIT` on
fundamentals.

---

## 4. Breaker rules

| # | Rule |
|---|---|
| B-1 | A breaker requires **multiple independent** evidence items |
| B-2 | A breaker requires **high confidence** — uncertainty means `MONITOR`, not `EXIT` |
| B-3 | Price movement is **never** sufficient for a breaker |
| B-4 | A breaker must map to a stated `thesis_breaker` or an explicitly documented new one |
| B-5 | Firing a breaker records the full evidence set that triggered it |
| B-6 | A breaker is reviewable and reversible; reversals are recorded |

---

## 5. Condition design

`monitor` / `reduce` / `exit` conditions must be:

- **Objective** where possible — evaluable against evidence, not vibes
- **Evidence-based** — each references the categories that test it
- **Configurable** — per asset, by the owner
- **Asset-specific** — not global constants

### Forbidden

```
❌  Universal thresholds invented without justification
    e.g. "exit any asset that falls 50%"
```

A 50% drawdown means something entirely different for a stablecoin than for a
small-cap. Global thresholds are pseudo-rigour: they look objective while
encoding an unexamined assumption.

### Acceptable defaults

Templates may be **suggested** per asset class, clearly labelled as defaults,
requiring owner confirmation before they carry decision weight.

---

## 6. Thesis review cycle

```
new evidence
     ↓
assumptions re-tested
     ↓
conditions evaluated
     ↓
status + trend updated
     ↓
change explained against the previous analysis
```

Every review answers Question 17 — *what changed since last time?* — by diffing
against `previous_analysis_id`.

---

## 7. Status and trend are orthogonal

| | IMPROVING | STABLE | DETERIORATING |
|---|---|---|---|
| **HEALTHY** | strengthening | fine | early warning |
| **WEAKENING** | recovering | persistent weakness | escalating |
| **IMPAIRED** | repairing | entrenched damage | approaching breaker |
| **BROKEN** | — | — | — |

A `HEALTHY / DETERIORATING` asset needs attention *before* it becomes
`WEAKENING`. Reporting status alone would hide that.
