# Vision and Architecture Principles

> **Status:** Architecture contract. Binding on all later phases.

---

## 1. What we are building

**Portfolio Investment Intelligence Platform.**

Not a trading bot. Not a signal service. Not a price predictor.

The system answers one central question, continuously, per asset:

> **Is my reason for owning this asset still valid — or has evidence appeared
> that means I should monitor it, reduce it, or exit?**

The difference matters. A trading bot asks *"will price go up?"*. This system
asks *"is the thesis intact?"*. Those questions have different inputs, different
time horizons, and different failure modes.

---

## 1b. What ships at launch

The eighteen questions below define the **product**. They do not all have to be
answered at full depth in the **first release**.

Launch scope is governed by [`CORE-LAUNCH-SCOPE.md`](./CORE-LAUNCH-SCOPE.md):

```
CORE / PRE-LAUNCH      Phases 0A · 0B · 1 · 2 · 3 · 4 · 5 · 6
ENHANCEMENTS           B1..B8, deferred
```

The North Star at launch is unchanged in substance:

> Is my reason for holding this asset still valid — or has evidence appeared
> that means I should keep holding, watch it, reduce it, or exit?

---

## 2. The eighteen questions

Every design decision traces back to enabling at least one of these:

| # | Question | Primary module |
|---|---|---|
| 1 | What do I own? | Portfolio Core (exists) |
| 2 | What is the real underlying asset? | Asset Identity |
| 3 | Why do I hold it? | Thesis Memory |
| 4 | Is the project healthy? | Fundamentals |
| 5 | Is the token a good investment? | Tokenomics · Utility |
| 6 | Is the current price/valuation reasonable? | Valuation |
| 7 | Have tokenomics changed? | Tokenomics |
| 8 | Is usage growing? | Adoption · On-chain |
| 9 | Are competitors outpacing it? | Competition |
| 10 | Is there a security problem? | Security |
| 11 | Are there scam/rug/honeypot indicators? | Scam Gate |
| 12 | Are there regulatory risks? | Regulatory |
| 13 | Do political/geopolitical events affect it? | Macro/Geopolitical |
| 14 | Have market and liquidity conditions changed? | Market |
| 15 | Has on-chain data changed? | On-chain |
| 16 | Have thesis breakers appeared? | Thesis Breaker Engine |
| 17 | What changed since the last analysis? | Research Snapshot Versioning |
| 18 | Is the decision still HOLD? | Decision Policy |

If a proposed feature serves none of these, it is out of scope.

---

## 3. The governing principle

```
LLM interprets evidence. It does not manufacture evidence.
```

This is the constitutional rule of the system. Concretely:

- Every factual claim in a report traces to an `evidence_id` in the Evidence Store
- An LLM may **read, weigh, compare, and summarise** evidence
- An LLM may **never** be the origin of a number, a date, a TVL figure, a holder
  count, or a contract property
- A statement with no evidence reference is a **bug**, not a stylistic issue

### Why this is non-negotiable

An investment system whose facts cannot be audited is worse than no system,
because it produces confident-sounding output that cannot be checked. The moment
a model is allowed to supply a figure "from memory", every downstream score and
decision becomes unfalsifiable.

---

## 4. The pipeline

```
PORTFOLIO DATA
      │
      ▼
CANONICAL ASSET IDENTITY
      │
      ▼
DATA / RESEARCH COLLECTORS
      │
      ▼
EVIDENCE STORE
      │
      ▼
NORMALIZED SIGNALS
      │
      ▼
ASSESSMENT ENGINES
      │
      ▼
EVIDENCE GRAPH
      │
 ┌────┴────┐
 ▼         ▼
BULL      BEAR
 │         │
 └────┬────┘
      ▼
RISK JUDGE
      │
      ▼
THESIS IMPACT
      │
      ▼
DETERMINISTIC DECISION POLICY
      │
      ▼
INVESTMENT DECISION
      │
      ▼
THESIS MEMORY
      │
      ▼
CONTINUOUS MONITORING
```

Each arrow is a **contract boundary**. A stage may only consume the output of the
stage above it. Skipping a stage — for example letting a collector emit a
decision — is an architecture violation.

---

## 5. Signal ≠ Decision

The most common failure mode in crypto tooling is collapsing observation into
action. This system forbids it structurally.

```
Evidence   →   Signal   →   Assessment   →   Thesis Impact   →   Decision
```

### Worked example

| Stage | Value |
|---|---|
| **Evidence** | TVL fell 40% over 30d — source: DeFiLlama, Tier 2, `data_as_of` 2026-08-28 |
| **Signal** | Adoption deterioration |
| **Assessment** | Negative, Medium confidence |
| **Thesis Impact** | Moderate |
| **Decision** | `HOLD_MONITOR` |

### Explicitly forbidden

```
TVL -40%  →  SELL
```

A single metric may never map directly to an action. If a shortcut like this
appears in code review, it is rejected regardless of how well it backtests.

---

## 6. Layering rule

```
Portfolio Core           (exists today — source of truth for holdings)
        │
        │  reads only
        ▼
Intelligence Layer       (new — never writes holdings/transactions)
```

The Intelligence Layer:

- **reads** holdings, transactions, connections, prices, snapshots
- **writes** only to its own tables (assets, evidence, events, analyses, theses)
- **never** mutates Portfolio Core data
- **never** places orders — the system has no execution capability by design

If Intelligence is switched off entirely, the tracker keeps working unchanged.

---

## 7. Design invariants

| # | Invariant |
|---|---|
| I-1 | Every fact used in reasoning has an `evidence_id` |
| I-2 | Every analysis records the versions of the spec, scoring, and policy that produced it |
| I-3 | Confidence falls when critical evidence is stale or missing — it is never assumed |
| I-4 | Price movement alone never produces `EXIT` |
| I-5 | The decision enum is fixed; changing it requires an ADR |
| I-6 | Suspicious ≠ Confirmed; the gap is always visible to the user |
| I-7 | Asset decisions and portfolio actions are separate outputs |
| I-8 | Secrets are server-side only; no provider key ever reaches the client |
| I-9 | AI output is structured and schema-validated before use |
| I-10 | Absence of evidence is recorded explicitly, never silently treated as neutral |

---

## 8. Non-goals

Stated to prevent scope drift:

- ❌ Order execution / trading
- ❌ Price prediction presented as fact
- ❌ Copy-trading or social signal following
- ❌ Tax accounting
- ❌ Financial advice as a regulated activity
- ❌ Real-time / sub-second data
- ❌ Multi-tenant SaaS (single-operator system for now)
