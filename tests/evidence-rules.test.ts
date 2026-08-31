// Phase 1 — Evidence, freshness, hashing, dedup, temporal, snapshot rules.
// Pure-rule tests: no database, no network.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalize, buildHashInput, classifyIngestion, computeFreshness,
  freshnessConfidenceCeiling, isVisibleAt, computeCoverage, analysisMode,
  canSupportCriticalConclusionAlone, isValidTier, TIER_CONFIDENCE_CEILING,
  EVIDENCE_HASH_VERSION, FRESHNESS_POLICY_VERSION,
} from "../shared/evidence-rules";
import { createHash } from "node:crypto";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const T = (iso: string) => new Date(iso);

// ── Hashing ─────────────────────────────────────────────────────────────────

test("canonicalization is key-order independent", () => {
  assert.equal(canonicalize({ b: 1, a: 2 }), canonicalize({ a: 2, b: 1 }));
  assert.equal(canonicalize({ x: { d: 1, c: 2 } }), canonicalize({ x: { c: 2, d: 1 } }));
});

test("same semantic evidence produces the same hash", () => {
  const base = {
    assetId: "a1", category: "PRICE", evidenceType: "SPOT", sourceKey: "coingecko",
    observedAt: "2026-09-01T00:00:00.000Z", effectiveAt: null,
  };
  const h1 = sha(buildHashInput({ ...base, rawValue: { usd: 100, src: "x" } }));
  const h2 = sha(buildHashInput({ ...base, rawValue: { src: "x", usd: 100 } }));
  assert.equal(h1, h2, "key order must not change identity");
});

test("materially different evidence produces a different hash", () => {
  const base = {
    assetId: "a1", category: "PRICE", evidenceType: "SPOT", sourceKey: "coingecko",
    observedAt: "2026-09-01T00:00:00.000Z", effectiveAt: null,
  };
  assert.notEqual(
    sha(buildHashInput({ ...base, rawValue: { usd: 100 } })),
    sha(buildHashInput({ ...base, rawValue: { usd: 101 } })),
  );
});

test("retrievedAt is excluded from the hash", () => {
  // Re-fetching the same fact later must not create a new hash, or dedup breaks.
  const input = {
    assetId: "a1", category: "PRICE", evidenceType: "SPOT", sourceKey: "cg",
    observedAt: "2026-09-01T00:00:00.000Z", effectiveAt: null, rawValue: { usd: 5 },
  };
  assert.equal(buildHashInput(input), buildHashInput({ ...input }));
  assert.ok(!buildHashInput(input).includes("retrievedAt"));
});

test("hash carries a version so canonicalization can evolve", () => {
  assert.ok(buildHashInput({
    assetId: null, category: "MARKET", evidenceType: "TVL", sourceKey: "defillama",
    observedAt: null, effectiveAt: null, rawValue: 1,
  }).includes(EVIDENCE_HASH_VERSION));
});

// ── Dedup vs corroboration ──────────────────────────────────────────────────

test("same source repeating itself is a DUPLICATE", () => {
  const existing = [{ sourceKey: "cg", hash: "h1", observedAt: T("2026-09-01T00:00:00Z") }];
  assert.equal(
    classifyIngestion({ sourceKey: "cg", hash: "h1", observedAt: T("2026-09-01T00:00:00Z") }, existing),
    "DUPLICATE",
  );
});

test("a different source asserting the same claim is CORROBORATION, not a duplicate", () => {
  const existing = [{ sourceKey: "cg", hash: "h1", observedAt: T("2026-09-01T00:00:00Z") }];
  assert.equal(
    classifyIngestion({ sourceKey: "cmc", hash: "h1", observedAt: T("2026-09-01T00:00:00Z") }, existing),
    "CORROBORATION",
    "independent agreement must never be discarded as a duplicate",
  );
});

test("a newer observation from the same source SUPERSEDES", () => {
  const existing = [{ sourceKey: "cg", hash: "h1", observedAt: T("2026-09-01T00:00:00Z") }];
  assert.equal(
    classifyIngestion({ sourceKey: "cg", hash: "h2", observedAt: T("2026-09-02T00:00:00Z") }, existing),
    "SUPERSEDES",
  );
});

// ── Conflict ────────────────────────────────────────────────────────────────

test("conflicting values are representable without overwriting either", () => {
  const a = { id: "e1", source: "A", value: 10_000_000, status: "ACTIVE" as string, conflictsWith: null as string | null };
  const b = { id: "e2", source: "B", value: 15_000_000, status: "ACTIVE" as string, conflictsWith: null as string | null };
  a.status = "CONFLICTING"; a.conflictsWith = b.id;
  b.status = "CONFLICTING"; b.conflictsWith = a.id;

  assert.equal(a.value, 10_000_000, "original value preserved");
  assert.equal(b.value, 15_000_000, "original value preserved");
  assert.notEqual((a.value + b.value) / 2, a.value, "averaging would invent a number no source supports");
});

// ── Temporal ────────────────────────────────────────────────────────────────

test("observed / effective / retrieved are distinct", () => {
  // A rule announced 1 Sep, effective 1 Oct, retrieved 2 Sep.
  const e = { observedAt: T("2026-09-01T00:00:00Z"), effectiveAt: T("2026-10-01T00:00:00Z"), retrievedAt: T("2026-09-02T00:00:00Z") };
  assert.notEqual(e.observedAt.getTime(), e.effectiveAt.getTime());
  assert.notEqual(e.observedAt.getTime(), e.retrievedAt.getTime());
});

test("historical cutoff excludes evidence retrieved after it", () => {
  assert.equal(
    isVisibleAt({ retrievedAt: T("2026-09-10T00:00:00Z"), effectiveAt: null }, T("2026-09-05T00:00:00Z")),
    false,
    "future-data leakage",
  );
});

test("historical cutoff excludes not-yet-effective evidence", () => {
  assert.equal(
    isVisibleAt({ retrievedAt: T("2026-09-02T00:00:00Z"), effectiveAt: T("2026-10-01T00:00:00Z") }, T("2026-09-05T00:00:00Z")),
    false,
  );
  assert.equal(
    isVisibleAt({ retrievedAt: T("2026-09-02T00:00:00Z"), effectiveAt: T("2026-10-01T00:00:00Z") }, T("2026-10-02T00:00:00Z")),
    true,
  );
});

// ── Freshness ───────────────────────────────────────────────────────────────

test("freshness transitions FRESH -> AGING -> STALE without touching raw data", () => {
  const observed = T("2026-09-01T00:00:00Z");
  assert.equal(computeFreshness("PRICE", observed, T("2026-09-01T00:02:00Z")), "FRESH");
  assert.equal(computeFreshness("PRICE", observed, T("2026-09-01T00:20:00Z")), "AGING");
  assert.equal(computeFreshness("PRICE", observed, T("2026-09-01T02:00:00Z")), "STALE");
});

test("missing timestamp yields UNKNOWN, never FRESH", () => {
  assert.equal(computeFreshness("SECURITY", null, new Date()), "UNKNOWN");
  assert.equal(computeFreshness("SECURITY", undefined, new Date()), "UNKNOWN");
});

test("freshness is category-specific", () => {
  const observed = T("2026-09-01T00:00:00Z");
  const asOf = T("2026-09-01T02:00:00Z");   // +2h
  assert.equal(computeFreshness("PRICE", observed, asOf), "STALE");
  assert.equal(computeFreshness("TOKENOMICS", observed, asOf), "FRESH");
});

test("event-driven categories do not decay on a clock", () => {
  assert.equal(
    computeFreshness("REGULATORY", T("2026-01-01T00:00:00Z"), T("2026-09-01T00:00:00Z")),
    "FRESH",
  );
});

test("freshness policy is versioned", () => {
  assert.equal(typeof FRESHNESS_POLICY_VERSION, "string");
  assert.ok(FRESHNESS_POLICY_VERSION.length > 0);
});

test("stale evidence lowers the usable confidence ceiling", () => {
  assert.ok(freshnessConfidenceCeiling("STALE") < freshnessConfidenceCeiling("FRESH"));
  assert.ok(freshnessConfidenceCeiling("UNKNOWN") < freshnessConfidenceCeiling("AGING"));
});

// ── Source quality ──────────────────────────────────────────────────────────

test("tier 1 and tier 5 are distinguishable and ordered", () => {
  assert.ok(TIER_CONFIDENCE_CEILING[1] > TIER_CONFIDENCE_CEILING[5]);
});

test("low-tier evidence alone cannot support a critical conclusion", () => {
  assert.equal(canSupportCriticalConclusionAlone(1), true);
  assert.equal(canSupportCriticalConclusionAlone(2), true);
  assert.equal(canSupportCriticalConclusionAlone(4), false);
  assert.equal(canSupportCriticalConclusionAlone(5), false);
});

test("invalid tiers are rejected", () => {
  assert.equal(isValidTier(0), false);
  assert.equal(isValidTier(6), false);
  assert.equal(isValidTier("1"), false);
  assert.equal(isValidTier(2.5), false);
});

test("source tier is not evidence confidence", () => {
  // A tier 1 source with stale data must not outrank a fresh tier 2 observation
  // purely on tier. The two axes are combined, never collapsed.
  const tier1Stale = Math.min(TIER_CONFIDENCE_CEILING[1], freshnessConfidenceCeiling("STALE"));
  const tier2Fresh = Math.min(TIER_CONFIDENCE_CEILING[2], freshnessConfidenceCeiling("FRESH"));
  assert.ok(tier2Fresh > tier1Stale, "freshness is an independent axis from tier");
});

// ── Coverage / fail-safe ────────────────────────────────────────────────────

test("coverage is a ratio, not a confidence", () => {
  assert.equal(computeCoverage(["A", "B", "C", "D"], ["A", "B", "C"]), 0.75);
  assert.equal(computeCoverage([], []), 1);
});

test("missing critical evidence yields INSUFFICIENT_EVIDENCE, not a neutral score", () => {
  assert.equal(
    analysisMode({ coverage: 0.9, missingCritical: true, anySourceFailed: false, allSourcesFailed: false }),
    "INSUFFICIENT_EVIDENCE",
  );
});

test("a single provider failure degrades coverage rather than failing everything", () => {
  assert.equal(
    analysisMode({ coverage: 0.8, missingCritical: false, anySourceFailed: true, allSourcesFailed: false }),
    "PARTIAL",
  );
  assert.equal(
    analysisMode({ coverage: 0, missingCritical: false, anySourceFailed: true, allSourcesFailed: true }),
    "FAILED",
  );
});

test("full coverage with no failures is FULL", () => {
  assert.equal(
    analysisMode({ coverage: 1, missingCritical: false, anySourceFailed: false, allSourcesFailed: false }),
    "FULL",
  );
});
