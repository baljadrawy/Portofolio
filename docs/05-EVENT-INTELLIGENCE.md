# Event Intelligence Model

> **Status:** Architecture contract. Phase 2.

---

## 1. One store, not one silo per type

A single `event` table serves every category. Separate stores per event type
would prevent the two things that matter most:

- one event affecting **many assets**
- cross-category correlation ("a regulatory event *and* an unlock in the same week")

---

## 2. Event contract

```
event
├── event_id
├── event_type            see §3
│
├── title
├── summary
│
├── started_at            when the event began / became true
├── detected_at           when WE detected it
├── resolved_at           nullable
│
├── severity              INFO | LOW | MEDIUM | HIGH | CRITICAL
├── scope                 MARKET_WIDE | SECTOR | ASSET_SPECIFIC
├── confidence            0–100
│
├── affected_assets[]     asset_id + per-asset impact
├── evidence_ids[]        MANDATORY — an event with no evidence is a rumour
│
├── thesis_impact         NONE | MINOR | MODERATE | MAJOR | BREAKER_CANDIDATE
├── status                SUSPECTED | CONFIRMED | RESOLVED | FALSE_POSITIVE
└── created_at / updated_at
```

### `SUSPECTED` is a first-class state

Events frequently surface first on Tier-4 sources. Such an event is recorded as
`SUSPECTED` with low confidence. It may drive *monitoring*, never a decision,
until corroborated at Tier 1–2.

---

## 3. Event types

```
SECURITY            TOKEN_UNLOCK        REGULATORY          GEOPOLITICAL
COMPETITOR          GOVERNANCE          OUTAGE              TEAM
MARKET              LISTING             DELISTING           LEGAL
TOKENOMICS_CHANGE   PROTOCOL_UPGRADE    STABLECOIN_EVENT
```

---

## 4. One event → many assets

Required capability. Example:

```
event: "Major bridge exploit — $200M"
  scope: SECTOR
  affected_assets:
    - bridge_token      impact: MAJOR    (protocol itself compromised)
    - chain_a_native    impact: MODERATE (liquidity + confidence effect)
    - chain_b_native    impact: MODERATE
    - unrelated_l1      impact: MINOR    (sector sentiment only)
```

Impact is **per asset**, not a single global severity. The same event is
existential for one holding and background noise for another.

---

## 5. Security Incident Attribution — locked rule

> **A vulnerability in an application built on a chain is not a vulnerability in
> the chain.**

This rule is not negotiable and not model-adjustable.

### Affected component taxonomy

```
BASE_PROTOCOL        the chain / consensus layer itself
DAPP                 an application deployed on a chain
BRIDGE               cross-chain infrastructure
EXCHANGE             centralised venue
WALLET               client software
ECOSYSTEM_PROJECT    project in the ecosystem, not the chain
```

### The canonical error this prevents

```
❌  "A DeFi app on Ethereum was exploited"  →  "Ethereum is compromised"
```

Attributing a dapp exploit to the base protocol would mark ETH's thesis as broken
on the basis of evidence that says nothing about Ethereum's security. Absent
evidence of a **protocol-level** flaw, base-protocol thesis impact is `NONE`.

### Incident record

```
security_incident
├── incident_id
├── event_id
├── affected_component      taxonomy above
├── affected_asset_id       the asset ACTUALLY compromised
├── severity
├── funds_affected          amount + currency, nullable
├── resolved                boolean
├── remediation             what was done
├── recurrence_risk         LOW | MEDIUM | HIGH
├── asset_thesis_impact     per affected asset
└── evidence_ids[]
```

### Second-order effects are allowed — but must be labelled

An exchange hack may legitimately affect a token's liquidity thesis. That is
recorded as a **liquidity/market** impact with its own evidence, never as a
security failure of the token itself.

---

## 6. Event lifecycle

```
SUSPECTED ──corroborated──► CONFIRMED ──fixed──► RESOLVED
    │                            │
    └──────refuted───────────────┴──► FALSE_POSITIVE
```

`FALSE_POSITIVE` events are **retained**, not deleted. They are the training data
for measuring the system's false-positive rate over time.

---

## 7. Deduplication

The same real-world event arrives from many sources. Candidates are merged when
they share `event_type`, overlapping `affected_assets`, and a close `started_at`.

Merging **unions** the evidence rather than discarding any — corroboration is the
point.
