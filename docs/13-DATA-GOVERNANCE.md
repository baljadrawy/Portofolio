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

## Live CORE security sources — verified 2026-09-01

These are the sources Phase 2 actually uses and stores evidence from. Under the
narrowed TD-24 rule, these are the ones that had to be resolved before launch.

### `direct-chain` — public blockchain RPC

| Field | Value |
|---|---|
| **Purpose** | deterministic contract/mint state |
| **Endpoints** | `*.publicnode.com` (EVM) · `api.mainnet-beta.solana.com` (Solana) |
| **Tier** | 1 — chain state read directly, not via an indexer's opinion |
| **API key** | none |
| **Commercial use** | **Unrestricted.** Public blockchain state is not a proprietary dataset. What we store is what the chain says. |
| **Caching / retention / redistribution** | **Unrestricted** for the same reason |
| **Attribution** | none required |
| **Cost** | free · public endpoints · no contract or quota |
| **Verified** | 2026-09-01 |
| **Note** | Public endpoints are best-effort. Rate limiting or downtime is treated as a provider failure, never as safety. |

### `goplus` — GoPlus Token Security API

| Field | Value |
|---|---|
| **Purpose** | honeypot, sell restriction, taxes, blacklist, mintable, holder count |
| **Endpoint** | `api.gopluslabs.io/api/v1/token_security` |
| **Tier** | 2 |
| **API key** | not required for the free tier |
| **Rate limit** | **30 requests/minute** (documented free tier) |
| **Commercial use** | 🔴 **RESTRICTED.** §6: *"You shall not directly use our original data to conduct any commercial activities and generate revenue without Goplus's explicit written permission."* Present use is personal/non-commercial, which is permitted. **Written permission is required before any commercial launch.** |
| **Attribution** | 🔴 **MANDATORY.** §3 requires a backlink or a *"Powered by Go+ Security"* mention; §5 requires displaying the GoPlus mark. Encoded as `GOPLUS_ATTRIBUTION` and returned in every assessment report. |
| **Caching** | ⚠️ `UNKNOWN` — the agreement contains no caching clause either permitting or prohibiting it |
| **Retention** | ⚠️ `UNKNOWN` — no clause |
| **Redistribution** | 🔴 Restricted. §6 prohibits data mining and collection without permission |
| **Cost** | free tier |
| **Verified** | 2026-09-01, against the published API License Agreement |

> **Why GoPlus is not the sole source.** Its commercial-use restriction and the
> unknown caching status make it unsuitable as a single point of dependency.
> It is therefore a **corroborating** provider: every capability it covers that
> can be established from chain state is also checked deterministically, and no
> CRITICAL disposition can rest on GoPlus alone.

### `internal-rules` — curated incident registry

| Field | Value |
|---|---|
| **Purpose** | known critical exploits |
| **Source** | maintained in-repo, currently **empty** |
| **Tier** | 2 |
| **All legal fields** | not applicable — our own data |
| **Limitation** | absence is not proof of absence. Recorded as **TD-27**. |

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
