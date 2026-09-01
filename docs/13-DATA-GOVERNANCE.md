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

### `direct-chain` — hosted public RPC

> **Correction (remediation).** An earlier draft recorded this as "No ToS —
> public chain state". That conflated two different things:
>
> ```
> blockchain DATA   ≠   the hosted RPC SERVICE that serves it
> ```
>
> The data is public and carries no licence. The **endpoint** is somebody's
> hosted service and has its own acceptable-use terms.

| Field | Value |
|---|---|
| **Purpose** | deterministic contract/mint state |
| **Data licence** | ✅ **None applicable.** What we store are facts read from public chain state — bytecode presence, storage slots, mint/freeze authority. These are not a proprietary dataset and no party licenses them. |
| **Service providers** | **PublicNode** (`*.publicnode.com`) — EVM · **Solana Foundation** (`api.mainnet-beta.solana.com`) — Solana |
| **Service terms** | ⚠️ `UNKNOWN — REQUIRES REVIEW` for the acceptable-use policy of each hosted endpoint |
| **Why the unknown does not block** | The terms that could bind us are about **usage of the service** (rate limits, fair use), not about **ownership of the data**. Nothing we store is theirs. If an endpoint's policy disallowed our call pattern, the remedy is to change endpoint or self-host — not to delete evidence. |
| **API key** | none |
| **Attribution** | none required |
| **Cost** | free, best-effort |
| **Verified** | 2026-09-01 |
| **Note** | Best-effort endpoints. Rate limiting or downtime is a provider failure, never safety. Two of four endpoints evaluated were already unusable. |
| **Exit** | running our own node removes even the service-terms question. Not required now. |

### `goplus` — 🔴 REMOVED FROM PRODUCTION (DEVELOPMENT_ONLY)

> **Decision:** `DEVELOPMENT_ONLY`. **Not registered in the production
> provider set.** Enforced in `shared/security-rules.ts` via
> `PRODUCTION_PROVIDER_KEYS` and covered by a test.
>
> **Why removal rather than owner acceptance.** Owner acceptance is not a legal
> resolution and has been struck from the project's options. The licence
> restricts commercial use without written permission, restricts
> redistribution, and is **silent on caching and retention**. Silence is not
> permission, and the Evidence Store exists precisely to cache and retain.
> Written permission could not be obtained within this phase.
>
> **What that costs:** honeypot, sell restriction, sell tax and blacklist
> become uncovered for EVM tokens. Those assets now return
> `INSUFFICIENT_EVIDENCE` — a real capability gap, and never a false CLEAR.
> Tracked as **TD-32**.
>
> **Alternatives examined:** honeypot.is (restricts competitive use and
> resale) and HoneyDB (non-commercial only) carry comparable or worse
> constraints. No legally cleaner source was found for these capabilities.

### `goplus` — evaluated terms (retained for the record)

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
