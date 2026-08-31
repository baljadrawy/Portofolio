# Portfolio Intelligence, Monitoring, and Scenarios

> 🔴 **POST-LAUNCH (B4)** — with two exceptions.
>
> CORE keeps only what is trivial on top of per-asset results: **holdings ranked by
> risk/action**, and **critical warnings across the portfolio**. Everything else here —
> health score, concentration, correlation, exposure models, scenario analysis — is
> deferred. **Portfolio optimisation is explicitly not a launch blocker.**
>
> **Status:** Architecture contract. Phases 7–8. Data model designed now,
> implementation deferred.

---

## 1. Asset Decision ≠ Portfolio Action

Two separate outputs, never merged:

```
ASSET DECISION      "is this asset worth holding?"        (asset-level analysis)
PORTFOLIO ACTION    "what should I do given my portfolio?" (portfolio-level)
```

### Worked example

```
SOL
  Asset Decision:    HOLD           ← the thesis is intact
  Portfolio Action:  REDUCE EXPOSURE
  Reason:            42% of portfolio in a single asset — concentration risk
```

Both statements are true simultaneously. Collapsing them would either force a
false `REDUCE` on the asset thesis, or hide a real portfolio risk. The separation
is required by Question 1 and Question 18 being different questions.

---

## 2. Portfolio Intelligence dimensions

| Dimension | Measures |
|---|---|
| Concentration | per asset, per **economic group** (see `02 · Asset Identity`) |
| Correlation | co-movement clusters — apparent diversification that isn't |
| Liquidity | exit capacity vs. position size |
| Sector exposure | L1 / DeFi / infra / gaming / … |
| Chain exposure | single-chain dependency |
| Security exposure | aggregate exposure to flagged contracts |
| Regulatory exposure | jurisdictional clustering |
| Unlock exposure | upcoming supply events across holdings |
| Thesis health distribution | how many holdings are `WEAKENING` / `IMPAIRED` |
| Risk clustering | correlated failure modes across positions |

### Concentration uses economic groups

Holding ETH on four chains is **one** exposure, not four. Computing
concentration per asset row would report false diversification — which is why
economic grouping is defined in the identity layer rather than here.

---

## 3. Continuous Monitoring

Data model designed now; **not implemented** in early phases.

### Triggers

| Trigger | Mechanism |
|---|---|
| Scheduled re-analysis | cadence per asset, informed by thesis status |
| Event-driven re-analysis | a relevant Event Store entry fires |
| Freshness-driven refresh | critical evidence crossed into `STALE` |
| Thesis change detection | assumption test flipped |

### Alert types

```
THESIS WEAKENED
SECURITY RISK INCREASED
COMPETITOR GAINING SHARE
MAJOR TOKEN UNLOCK
REGULATORY RISK CHANGED
CRITICAL INCIDENT
THESIS BREAKER DETECTED
```

Alerts are **evidence-backed by construction** — each references the evidence and
events that raised it. An alert with no evidence chain is a defect.

---

## 4. Scenarios — secondary output

12-month / 3-year / 5-year scenarios are explicitly **secondary**. They are not
the product.

Each scenario set contains `BEAR` · `BASE` · `BULL`, and each scenario must state:

```
scenario
├── horizon                12M | 3Y | 5Y
├── case                   BEAR | BASE | BULL
├── assumptions[]          what must be true
├── supply_assumption      circulating supply at horizon
├── implied_market_cap
├── valuation_range
└── confidence
```

### Arithmetic consistency — enforced

```
price × supply = market cap
```

Any target violating this identity is **rejected or corrected**, not displayed.
Price targets inconsistent with supply assumptions are the most common form of
crypto analysis nonsense, and the system must be structurally unable to produce
them.

### Presentation rule

```
❌  Price forecasts presented as fact
✅  Conditional scenarios with explicit assumptions and confidence
```

---

## 5. Portfolio Core boundary — restated

```
Portfolio Core  (exists today)
   Wallets · Exchanges · Holdings · Transactions · Prices · History
                    │
                    │  read-only
                    ▼
          Intelligence Layer  (new)
```

Portfolio Core remains the **sole source of truth** for what is owned.
Intelligence never writes to it. Disabling Intelligence leaves a fully functional
tracker.
