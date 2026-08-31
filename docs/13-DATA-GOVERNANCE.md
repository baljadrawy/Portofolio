# Data Governance — External Sources

> **Status:** Living register. Phase 1.
> **Rule:** legal terms are **never guessed**. An unverified field is recorded
> as `UNKNOWN — REQUIRES REVIEW`, which is a stronger statement than a
> plausible-looking assumption.

---

## Why this exists

The Evidence Store will hold third-party data. Whether we may cache it, retain
it, or redistribute it is a licensing question, not an engineering one. Recording
"we did not check" honestly is what keeps a later reviewer from inheriting a
false assurance.

---

## Register

### Sources already used by the running application

| Field | Etherscan | Solscan | CoinGecko | CoinMarketCap | Binance |
|---|---|---|---|---|---|
| **Purpose** | EVM chain state, tokens, txs | Solana chain state | market/price | market/price | exchange holdings |
| **Reference** | etherscan.io | solscan.io | coingecko.com | coinmarketcap.com | binance.com |
| **API key** | YES | YES | optional | YES | user-supplied |
| **Tier** | 2 | 2 | 2 | 2 | 2 |
| **License / ToS** | `UNKNOWN — REQUIRES REVIEW` | `UNKNOWN — REQUIRES REVIEW` | `UNKNOWN — REQUIRES REVIEW` | `UNKNOWN — REQUIRES REVIEW` | `UNKNOWN — REQUIRES REVIEW` |
| **Commercial use** | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |
| **Attribution required** | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |
| **Caching allowed** | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |
| **Retention limits** | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |
| **Redistribution** | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |
| **Verified on** | — | — | — | — | — |

> These are **pre-existing integrations** inherited by the Intelligence Layer,
> not new ones introduced by Phase 1. Their terms were never reviewed. The
> Evidence Store makes caching and retention explicit, which raises the
> importance of the review — recorded as **TD-24**.

### Evaluated but not integrated

| Field | Palisade |
|---|---|
| **Repository** | `github.com/palisadescan/palisade` |
| **Commit evaluated** | `7df719d` (2026-07-30) |
| **License** | **MIT** — verified from `LICENSE` in the cloned tree |
| **Commercial use** | Permitted (MIT) |
| **Attribution** | Copyright notice required (MIT) |
| **Redistribution** | Permitted (MIT) |
| **Upstream data sources** | GoPlus · DexScreener · Blockscout — **their** terms are the real constraint, and are `UNKNOWN — REQUIRES REVIEW` |
| **Decision** | `REFERENCE_ONLY` — see `12-EXTERNAL-REFERENCES.md` |

---

## Privacy contract — enforced in code

`SecurityAssessmentInput` carries exactly three fields:

```ts
{ networkFamily, chainId, contractAddress }
```

No balance, no portfolio value, no user identity, no unrelated wallet addresses.
A contract-security question needs a chain and an address; anything more is data
the provider has no need for. This is a **type-level** guarantee, not a
convention — and it is covered by a test that fails if a portfolio field appears.

### Absolute prohibitions

```
NEVER send or store in the Intelligence Layer:
  seed phrases · private keys · signing keys
```

Phase 1 is read-only. No custody, no signing, no transaction execution.

---

## Pre-launch requirement (narrowed)

```
Any source CORE actually uses AND whose data the system stores must have its
terms known well enough for that specific use BEFORE launch.
```

This is deliberately narrower than reviewing every conceivable source. It is
also non-negotiable: `UNKNOWN` may not remain open past launch for a source we
are actively caching, where the storage itself could breach its terms.

Sources not used by CORE may stay `UNKNOWN` indefinitely.

Classification: **TD-24 = PRE-LAUNCH BLOCKER (narrowed)**.

---

## Follow-up

| # | Action |
|---|---|
| 1 | Review ToS for Etherscan, Solscan, CoinGecko, CoinMarketCap, Binance — caching and retention specifically (TD-24) |
| 2 | Record the verification date per source once reviewed |
| 3 | Re-verify before any redistribution of derived data |
