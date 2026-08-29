# Research Modules

> **Status:** Architecture contract. Phase 3.
> **Design rule:** modular analysts, **never** one giant prompt.

---

## 1. Why modular

A single mega-prompt cannot be:

- partially cached (tokenomics changes monthly; price changes by the minute)
- independently versioned
- independently degraded when one data source fails
- independently evaluated for accuracy

Each module is separately callable, cacheable, versionable, and degradable.

---

## 2. Uniform module contract

Every module declares:

```
module
├── id
├── purpose               the question it answers
├── inputs                asset_id, evidence categories, config
├── deterministic_data    computed WITHOUT AI — pure code
├── ai_interpretation     what the model is allowed to judge
├── outputs               structured, Zod-validated
├── evidence_requirements REQUIRED vs OPTIONAL categories
└── degraded_behavior     what happens when required evidence is missing
```

### The critical split

```
deterministic_data   — code computes it. Reproducible. No model involved.
ai_interpretation    — model weighs it. Never sources it.
```

If a value can be computed, it **must** be computed, not asked of a model.

---

## 3. Degraded behaviour — universal rule

```
Required evidence missing  →  module returns INSUFFICIENT_EVIDENCE
                              (NOT a neutral or average score)
```

`INSUFFICIENT_EVIDENCE` propagates: it caps overall confidence and is shown in
the report. A module never invents a midpoint to appear complete.

---

## 4. The sixteen modules

| Module | Purpose | Deterministic | AI interprets | Required evidence |
|---|---|---|---|---|
| `market` | Price, liquidity, market structure | price, mcap, volume, volatility, depth | regime, liquidity adequacy | PRICE, MARKET |
| `fundamentals` | Is the project real and healthy? | age, docs presence, audit count | quality of what exists | DEVELOPMENT, TEAM |
| `tokenomics` | Supply and distribution | supply figures, inflation, unlock schedule, concentration | sustainability | TOKENOMICS, UNLOCK |
| `token_utility` | Does the token accrue value? | fee capture, staking, burn mechanics | strength of value accrual | TOKEN_UTILITY, REVENUE |
| `adoption` | Is usage growing? | users, addresses, tx counts, trends | organic vs incentivised | ADOPTION, ONCHAIN |
| `onchain` | Chain-level behaviour | holders, flows, whale movement, age distribution | pattern significance | ONCHAIN |
| `revenue` | Economics | fees, revenue, margins, growth | sustainability | REVENUE |
| `development` | Is it being built? | commits, contributors, release cadence | genuine vs cosmetic activity | DEVELOPMENT |
| `competition` | Relative position | peer market share, growth deltas | competitive trajectory | COMPETITION |
| `security` | Contract and protocol safety | audits, incidents, contract flags | residual risk | SECURITY |
| `scam` | Fraud indicators | honeypot, mint, liquidity lock, deployer history | suspicious vs confirmed | SCAM_INDICATOR |
| `regulatory` | Legal exposure | jurisdictions, filings, classifications | severity and likelihood | REGULATORY |
| `macro_geopolitical` | External conditions | rates, liquidity, sanctions exposure | transmission to this asset | MACRO |
| `news_catalysts` | Upcoming events | scheduled events, announcements | materiality | NEWS |
| `valuation` | Is the price reasonable? | ratios, peer comparables, implied caps | over/under-valuation | VALUATION, MARKET |
| `thesis` | Is the thesis intact? | assumption checks vs evidence | thesis health and trend | (all above) |

`decision` is deliberately **not** a research module — it is a deterministic
policy layer (`08 · Scoring and Decision`).

---

## 5. Execution model

```
             ┌──── market ────┐
             ├── fundamentals ┤
asset_id ────┼── tokenomics ──┼──► evidence graph ──► bull/bear ──► judge
             ├──   …16…      ┤
             └──  valuation ──┘
```

Modules run **in parallel** and are independent. None may consume another
module's output — that coupling would make them unversionable. Cross-module
synthesis happens exactly once, in the Evidence Graph.

---

## 6. Competition Intelligence — special note

Competition requires a **peer group** per asset and must detect the relative case:

> The project is growing — but its competitors are growing faster, so its market
> share is falling.

Price comparison alone cannot see this. The module compares, where data permits:
market share, users, active addresses, TVL, developers, fees, revenue, volume,
liquidity, integrations, ecosystem growth.

Peer groups are explicit records, not inferred at runtime, so a comparison is
reproducible.

---

## 7. Macro and Geopolitical — causal model required

```
❌  headline  →  SELL
```

Required chain instead:

```
Event
  ↓
Transmission Channel
  ↓
Market / Asset Exposure
  ↓
Expected Horizon
  ↓
Confidence
  ↓
Thesis Impact
```

**Transmission channels:** liquidity · interest rates · USD conditions ·
sanctions · exchange access · custody · ETF/institutional access · stablecoin
exposure · geographic concentration · regulation.

An event with **no identified transmission channel** to the asset produces
`thesis_impact = NONE`, regardless of how alarming the headline is.

### Market-wide vs asset-specific

These are separated in output. "Everything fell" is not evidence about this
asset. Conflating them produces panic decisions on assets whose fundamentals
never changed.
