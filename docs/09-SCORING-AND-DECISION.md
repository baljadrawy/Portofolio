# Scoring Model and Decision Policy

> **Status:** Architecture contract. Phase 4.

---

## 1. Scoring v1

| Dimension | Weight |
|---|---|
| Use Case / PMF | 15 |
| Tokenomics | 15 |
| Team / Execution | 10 |
| Token Utility / Value Accrual | 10 |
| Adoption | 10 |
| On-chain | 10 |
| Competitive Advantage | 10 |
| Revenue / Economics | 5 |
| Security / Decentralization | 5 |
| Regulatory Risk | 5 |
| Current Valuation | 5 |
| **Total** | **100** |

### Regulatory scoring direction

```
Higher score = LOWER regulatory risk
```

Stated explicitly because the intuitive reading is backwards. A score of 5/5
means minimal regulatory exposure.

---

## 2. Three scores, not one

A single number hides the distinction that matters most in crypto:

```
Good Project  ≠  Good Token
Good Token    ≠  Good Price
```

Therefore every analysis emits **three** independent scores:

| Score | Question | Draws from |
|---|---|---|
| **PROJECT QUALITY** | Is this a real, well-run, useful project? | PMF, team, adoption, development, competition, security |
| **TOKEN INVESTMENT QUALITY** | Does the token capture the project's value? | tokenomics, utility, value accrual, on-chain, revenue |
| **CURRENT ENTRY VALUATION** | Is the price reasonable *now*? | valuation, market, liquidity |

### Why this is non-optional

An excellent project can have a token that accrues no value — the classic
"great protocol, worthless token". A great token can be badly overpriced today.
A single blended score makes those cases indistinguishable, which is precisely
when the score is most misleading.

The overall score may be shown, but **never alone**.

---

## 3. Decision enum — locked contract

```
STRONG_HOLD
HOLD_ACCUMULATE
HOLD
HOLD_MONITOR
REDUCE
EXIT
AVOID
SCAM_CRITICAL_RISK
```

> **This list is fixed.** Adding, removing, or renaming a value requires an ADR.
> Downstream storage, UI, and history comparison all depend on its stability.

| Value | Meaning |
|---|---|
| `STRONG_HOLD` | Thesis strong, valuation supportive |
| `HOLD_ACCUMULATE` | Thesis intact, valuation favourable for adding |
| `HOLD` | Thesis intact, no action indicated |
| `HOLD_MONITOR` | Thesis intact but a watch condition triggered |
| `REDUCE` | Material deterioration or excessive risk |
| `EXIT` | Thesis broken |
| `AVOID` | Not held; do not enter |
| `SCAM_CRITICAL_RISK` | Confirmed fraud — Scam Gate override |

---

## 4. Deterministic Decision Policy

```
AI Assessment
      ↓
Decision Policy Engine        ← deterministic code, versioned
      ↓
Final Decision
```

**The LLM proposes. The policy engine disposes.**

The model produces assessments, confidence, and thesis impact. It does **not**
freely choose the final decision. The mapping from assessment to decision is
code — inspectable, testable, and identical across runs.

---

## 5. Guardrails

| # | Guardrail |
|---|---|
| **G-1** | Confirmed scam (Scam Gate) → may force `SCAM_CRITICAL_RISK` |
| **G-2** | Critical permanent impairment, high confidence → constrained to `REDUCE` or `EXIT` |
| **G-3** | **Price-only decline may NEVER produce `EXIT`** |
| **G-4** | Missing critical evidence → lower `confidence`; never invent facts to fill the gap |
| **G-5** | Stale critical evidence → confidence capped (see `04 · Freshness`) |
| **G-6** | Low confidence caps decision severity — uncertainty produces `HOLD_MONITOR`, not `EXIT` |
| **G-7** | `EXIT` on fundamentals requires a Layer-4 thesis breaker (`08 · Thesis Memory`) |
| **G-8** | Every guardrail application is logged with its reason |

### G-3 in detail

The single most valuable rule in the system.

```
Evidence:  price -60% over 90d, no other negative evidence
Signal:    price decline
Assessment: market/valuation change
Thesis Impact: NONE (no fundamental evidence changed)
Decision:  HOLD or HOLD_MONITOR — never EXIT
```

Panic-selling on drawdown is the most common and most expensive retail error.
The system is structurally incapable of recommending it.

---

## 6. Confidence model

Confidence is **not** the model's self-assessed certainty. It is computed:

```
confidence = f(
    evidence coverage,        which required categories are present
    source tiers,             what quality of source
    corroboration,            independent agreement
    freshness,                how current
    conflicts,                unresolved disagreements
    assessment agreement      do modules agree with each other
)
```

| Condition | Effect |
|---|---|
| Critical category `MISSING` | Hard cap |
| Critical category `STALE` | Hard cap |
| Unresolved conflict on a critical input | Reduction |
| Only Tier 4–5 sources | Severe cap |
| Modules strongly disagree | Reduction |

Confidence and score are reported separately. **A high score with low confidence
is a different statement** from a high score with high confidence, and the
difference must be visible.

---

## 7. Bull / Bear / Judge

```
        Evidence Graph
              │
     ┌────────┴────────┐
     ▼                 ▼
  BULL case        BEAR case
  (strongest       (strongest
   supporting)      opposing)
     └────────┬────────┘
              ▼
         RISK JUDGE
              │
              ▼
       Thesis Impact
```

- **Bull** builds the strongest *evidence-backed* case for the thesis
- **Bear** builds the strongest *evidence-backed* case against it
- Neither may introduce facts absent from the Evidence Graph
- **Risk Judge** weighs both, applies asymmetry (permanent loss outweighs
  foregone gain), and produces thesis impact plus confidence

Adversarial by construction: a single analyst prompt reliably rationalises
whatever position it starts from.

---

## 8. Research Snapshot Versioning

```
analysis
├── analysis_id
├── asset_id
│
├── research_spec_version      which module definitions
├── scoring_version            which weights
├── decision_policy_version    which guardrails
│
├── provider                   ai provider
├── model                      exact model id
│
├── evidence_snapshot_id       exact evidence set consumed
│
├── started_at / completed_at / as_of
│
├── scores                     project / token / valuation / overall
├── decision                   from the enum
├── confidence
│
├── thesis_status
├── thesis_trend
│
└── previous_analysis_id       for diffing
```

### Why versioning is mandatory

Without it, a comparison a year from now silently mixes scoring systems:

```
❌  2026 score 72  vs  2027 score 65  →  "it got worse"
    ...when the weights changed in between.
```

Comparisons across different `scoring_version` values must be **explicitly
labelled as non-comparable** in the UI.
