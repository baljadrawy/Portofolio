# Source Quality and Freshness Policy

> **Status:** Architecture contract. Phase 2.

---

## 1. Source tiers

Every evidence row carries a `source_tier`. Tier drives conflict resolution
(`03 · Evidence Platform` §5) and caps confidence.

### Tier 1 — Authoritative

Facts that are definitionally true, or issued by the entity with authority over them.

- Blockchain state read directly (balances, contract code, storage)
- Official project documentation and official GitHub organisation
- Regulator publications (SEC, MAS, FCA, ESMA, …)
- Court filings and government records
- Official security advisories from the affected project

### Tier 2 — Structured reputable providers

- CoinMarketCap · CoinGecko
- DeFiLlama
- TokenUnlocks
- Block explorers (Etherscan, Solscan — *as API providers, not as chain state*)
- Established analytics APIs

> **Note on explorers:** reading a balance *through* Etherscan is Tier 2 (we
> trust their indexing). Reading chain state directly from a node would be
> Tier 1. This project currently uses explorer APIs — evidence is tagged
> accordingly and honestly.

### Tier 3 — Reputable journalism

Established financial and crypto press with editorial standards and corrections
policies.

### Tier 4 — Community

X, Reddit, Discord, forums, Telegram.

**Use:** sentiment measurement and *discovery* of things to verify.
**Never:** treated alone as high-confidence fact.

A Tier-4 claim is a lead. It is promoted only when corroborated at Tier 1–2.

### Tier 5 — Unknown / unverifiable

SEO blogs, anonymous newsletters, content farms, unattributed claims.

Rejected by default. Retained only when the *existence of the claim* is itself
the signal (e.g. coordinated shilling as a scam indicator) — and tagged so it can
never leak into factual reasoning.

---

## 2. Tier → confidence ceiling

| Tier | Max confidence from this source alone |
|---|---|
| 1 | 100 |
| 2 | 85 |
| 3 | 70 |
| 4 | 40 |
| 5 | 15 |

Corroboration across independent sources may raise confidence above a single
source's ceiling — bounded by the highest tier present.

---

## 3. Source Conflict Resolution Policy

```
1.  Higher tier wins
2.  Same tier  → fresher data_as_of wins
3.  Same tier + same freshness → retain both, flag CONFLICT
4.  Unresolved conflict on a critical input → cap confidence for dependents
5.  NEVER average conflicting values
```

Every applied resolution is itself recorded, so "why did we believe X over Y" is
answerable months later.

---

## 4. Freshness Matrix (v1 — tunable)

`asOf` is mandatory on every report. These thresholds are **starting defaults**,
explicitly designed to be configurable per asset and per category. They are not
claimed to be empirically derived.

| Category | FRESH | AGING | STALE beyond |
|---|---|---|---|
| Price | < 5 min | 5–30 min | 30 min |
| Market data | < 1 h | 1–6 h | 6 h |
| On-chain | < 6 h | 6–24 h | 24 h |
| Security | < 1 h | 1–6 h | 6 h |
| News | < 6 h | 6–24 h | 24 h |
| Token unlock | < 24 h | 1–3 d | 3 d |
| Tokenomics | < 7 d | 7–30 d | 30 d |
| Development | < 7 d | 7–30 d | 30 d |
| Fundamentals | < 14 d | 14–60 d | 60 d |
| Competition | < 14 d | 14–60 d | 60 d |
| Regulation | event-driven | — | superseded only by a newer event |
| Geopolitical | event-driven | — | superseded only by a newer event |

**Event-driven categories** do not decay on a clock. A regulatory position from
eight months ago is still current *if nothing has happened since*. Their
freshness is a function of event coverage, not elapsed time.

---

## 5. Freshness states

| State | Meaning |
|---|---|
| `FRESH` | Within the fresh window |
| `AGING` | Usable, confidence reduced |
| `STALE` | Usable only with explicit labelling; **cannot support high confidence** |
| `UNKNOWN` | No `data_as_of` available — treated as `STALE` |

### Hard rule

```
Confidence MUST NOT be high when critical evidence is STALE.
```

This is enforced in the Decision Policy layer, not left to model judgement.

---

## 6. Report requirements

Every generated report displays:

- a top-level `asOf`
- per-category freshness state
- an explicit list of `STALE` and `MISSING` categories
- the confidence impact of each

A report that looks complete while resting on month-old security data is more
dangerous than a report that admits the gap.
