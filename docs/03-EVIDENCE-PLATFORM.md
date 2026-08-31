# Evidence Platform

> 🟢 **CORE / PRE-LAUNCH** — required for the Core Launch Gate. Scope contract: [`CORE-LAUNCH-SCOPE.md`](./CORE-LAUNCH-SCOPE.md).
>
> **Status:** **FOUNDATION IMPLEMENTED (Phase 1, 2026-09-01).**
>
> Tables: `evidence_sources` · `evidence` · `evidence_snapshots` ·
> `evidence_snapshot_items`. Rules: `shared/evidence-rules.ts` (pure).
> Services: `server/services/evidence.ts`. Migration: `migrations/0002_evidence_core.sql`.
>
> Where implementation differs from this document, the code is authoritative:
> the contract here uses `data_as_of`; the implementation splits it into
> **`observed_at`** (when the fact was true) and **`effective_at`** (when it
> comes into force), because a regulation announced today and effective next
> month needs both to be replayable without leaking the future.
>
> Full store, conflict-resolution engine, and Event Store remain Phase 2.
>
> **Status:** Architecture contract.
> **Phased delivery:** minimal Evidence Core + provenance contract in **Phase 1**;
> full store, snapshots, conflict handling, and freshness enforcement in **Phase 2**.
> **Governing rule:** `LLM interprets evidence. It does not manufacture evidence.`

> **Security findings are evidence.** They are written into this store like any
> other fact — never into a separate security-only datastore. See
> `07-SECURITY-AND-SCAM-ENGINE.md` §0.

---

## 1. Purpose

A single, auditable store for **every fact** the system reasons about.

The anti-pattern this prevents:

```
❌  Each AI agent holds its own private "facts", none traceable,
    none comparable, none reproducible.
```

If two modules disagree about TVL, the disagreement must be inspectable down to
two rows with two sources and two timestamps — not buried inside two prompts.

---

## 2. Evidence contract

```
evidence
├── evidence_id
├── asset_id              nullable — market-wide evidence has no asset
│
├── category              see §3
├── source                'defillama' | 'etherscan' | 'sec.gov' | …
├── source_type           API | DOCUMENT | ONCHAIN | ARTICLE | SOCIAL | FILING
├── source_tier           1 | 2 | 3 | 4 | 5   (see 04 · Source Quality)
├── reference             url / provider endpoint / tx hash / doc id
│
├── retrieved_at          when WE fetched it
├── data_as_of            when the DATA itself is valid for
├── freshness_status      FRESH | AGING | STALE | UNKNOWN   (derived)
│
├── confidence            0–100, source-tier and corroboration aware
│
├── raw_value             exactly as received — never edited
├── normalized_value      typed, unit-normalised, comparable
├── unit                  USD | PERCENT | COUNT | BOOLEAN | ADDRESS | …
│
├── metadata              provider response meta, query params, pagination
├── evidence_hash         content hash — see §7
│
├── superseded_by         evidence_id of a newer observation, nullable
└── created_at
```

### `retrieved_at` vs `data_as_of` — why both

A provider queried today may return a metric computed three days ago. Confusing
"when we asked" with "when it was true" is how stale data silently inflates
confidence. Both are mandatory; freshness is always computed from `data_as_of`.

---

## 3. Evidence categories

Aligned to the research modules (`05-RESEARCH-MODULES.md`):

```
PRICE            MARKET           TOKENOMICS       TOKEN_UTILITY
ADOPTION         ONCHAIN          REVENUE          DEVELOPMENT
COMPETITION      SECURITY         SCAM_INDICATOR   REGULATORY
MACRO            NEWS             VALUATION        GOVERNANCE
TEAM             LIQUIDITY        UNLOCK           IDENTITY_RESOLUTION
```

---

## 4. Deduplication

Two observations are **the same evidence** when:

```
same (asset_id, category, source, data_as_of, evidence_hash)
```

- Identical repeat fetch → **no new row**; only `retrieved_at` is refreshed
- Same source, newer `data_as_of` → **new row**, old row gets `superseded_by`
- Different source, same fact → **both retained** (this is corroboration, §6)

History is never overwritten. Superseding is a link, not a delete.

---

## 5. Conflicting sources

Conflict is expected — DeFiLlama and a project's own dashboard routinely disagree.

**Resolution order:**

| Step | Rule |
|---|---|
| 1 | Higher `source_tier` wins (Tier 1 beats Tier 2 beats Tier 3…) |
| 2 | Same tier → fresher `data_as_of` wins |
| 3 | Same tier and freshness → **both retained, conflict flagged** |
| 4 | An unresolved conflict on a critical input **lowers confidence** for every dependent assessment |

### Hard rule

> A conflict is **never** silently averaged. Averaging two contradictory figures
> produces a number that no source supports and that nobody can defend.

Conflicts surface in the report as an explicit disagreement with both values shown.

---

## 6. Corroboration

Independent sources agreeing raises confidence — but only if they are genuinely
independent.

| Situation | Effect |
|---|---|
| 2+ independent sources agree | Confidence increases |
| Sources share an upstream provider | **No** increase — this is one source wearing two hats |
| Single Tier-4/5 source only | Confidence capped low; cannot alone support a decision |

The "shared upstream" caveat is important in crypto, where many aggregators
resell the same underlying feed.

---

## 7. Evidence hashing and reproducibility

```
evidence_hash = hash(canonical(raw_value) + source + data_as_of + reference)
```

Purpose:

- Detect a source **silently rewriting history** (same URL, different content)
- Enable exact deduplication
- Make an analysis reproducible: an `evidence_snapshot_id` freezes the exact set
  of evidence rows an analysis consumed

### Evidence snapshots

```
evidence_snapshot
├── snapshot_id
├── asset_id
├── evidence_ids[]        the frozen set
├── created_at
└── coverage_report       which categories were present / missing / stale
```

An analysis references a snapshot. Re-running the same snapshot through the same
spec/scoring/policy versions **must** reproduce the same structured result. This
is what makes `24 · Research Snapshot Versioning` meaningful rather than
decorative.

---

## 8. Missing evidence

**The most important rule in this document.**

```
Missing evidence is recorded explicitly as MISSING.
It is never treated as neutral, and never treated as absence of risk.
```

| Handling | Effect |
|---|---|
| Category not collected | Recorded in `coverage_report` as `MISSING` |
| Critical category missing | Confidence is **capped**, not merely reduced |
| Optional category missing | Confidence reduced proportionally |
| Collector failed | Recorded as `COLLECTION_FAILED` with the error — distinct from "data does not exist" |

The distinction between *"we could not check"* and *"we checked and found
nothing"* is preserved everywhere. Collapsing them is how a system reports a
clean bill of health for an asset it never examined.

---

## 9. Caching

Caching is a **collector-layer** concern. The Evidence Store is the system of
record and is never bypassed.

| Rule | |
|---|---|
| TTL per category | Derived from the Freshness Matrix (`04 · Freshness`) |
| Cache hit | Still produces/refreshes an evidence row — reasoning always reads the store |
| Security category | Never served from a long cache; treated as immediate-refresh |
| Cache poisoning defence | `evidence_hash` mismatch on a cache hit invalidates the entry |

---

## 10. Provenance guarantee

Every claim in every generated report must satisfy:

```
claim → evidence_ids[] → source + tier + data_as_of + reference
```

A report sentence without an evidence reference is a **defect**. Report
generation must fail validation rather than emit an unsourced claim.

---

## 11. Open questions

| # | Question |
|---|---|
| Q-1 | Retention policy — is evidence kept indefinitely, or rolled up after N months? |
| Q-2 | Where is `raw_value` stored for large payloads — inline JSONB or object storage with a pointer? |
| Q-3 | Is `confidence` computed at write time, read time, or both? |
| Q-4 | Do we store negative observations ("no security advisories found") as evidence rows? (Recommended: yes.) |
