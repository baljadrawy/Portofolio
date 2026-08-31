// Pure evidence rules — no database, no services, no I/O.
// Everything here is deterministic and unit-testable in isolation.

// ── Source tiers ────────────────────────────────────────────────────────────

export type SourceTier = 1 | 2 | 3 | 4 | 5;

/**
 * A tier caps how much confidence a source can carry ALONE. It is not a claim
 * that the source is correct.
 *
 *   Source Tier  ≠  Evidence Confidence
 *
 * A Tier 1 regulator can publish something ambiguous; a Tier 2 explorer can
 * return a deterministic on-chain fact. Collapsing the two into one number
 * would lose exactly the distinction that matters when sources disagree.
 */
export const TIER_CONFIDENCE_CEILING: Record<SourceTier, number> = {
  1: 100,
  2: 85,
  3: 70,
  4: 40,
  5: 15,
};

/** Below this, a source may not alone support a critical conclusion. */
export const CRITICAL_CONCLUSION_MIN_TIER: SourceTier = 2;

export function canSupportCriticalConclusionAlone(tier: SourceTier): boolean {
  return tier <= CRITICAL_CONCLUSION_MIN_TIER;
}

export function isValidTier(v: unknown): v is SourceTier {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

// ── Freshness ───────────────────────────────────────────────────────────────

export type EvidenceCategory =
  | "PRICE" | "MARKET" | "ONCHAIN" | "SECURITY" | "NEWS"
  | "TOKEN_UNLOCK" | "TOKENOMICS" | "DEVELOPMENT" | "FUNDAMENTALS"
  | "COMPETITION" | "REGULATORY" | "GEOPOLITICAL";

export type FreshnessStatus = "FRESH" | "AGING" | "STALE" | "UNKNOWN";

export interface FreshnessThresholds {
  freshSeconds: number;
  agingSeconds: number;
  /** Event-driven categories do not decay on a clock. */
  eventDriven?: boolean;
}

/**
 * PROPOSED defaults, not locked facts. Tunable per asset and per category.
 * No empirical study backs these numbers; they are starting points and are
 * versioned so a change is visible in every snapshot that used the old set.
 */
export const FRESHNESS_POLICY_VERSION = "v1";

export const FRESHNESS_POLICY: Record<EvidenceCategory, FreshnessThresholds> = {
  PRICE:        { freshSeconds: 300,     agingSeconds: 1800 },
  MARKET:       { freshSeconds: 3600,    agingSeconds: 21600 },
  ONCHAIN:      { freshSeconds: 21600,   agingSeconds: 86400 },
  SECURITY:     { freshSeconds: 3600,    agingSeconds: 21600 },
  NEWS:         { freshSeconds: 21600,   agingSeconds: 86400 },
  TOKEN_UNLOCK: { freshSeconds: 86400,   agingSeconds: 259200 },
  TOKENOMICS:   { freshSeconds: 604800,  agingSeconds: 2592000 },
  DEVELOPMENT:  { freshSeconds: 604800,  agingSeconds: 2592000 },
  FUNDAMENTALS: { freshSeconds: 1209600, agingSeconds: 5184000 },
  COMPETITION:  { freshSeconds: 1209600, agingSeconds: 5184000 },
  REGULATORY:   { freshSeconds: 0, agingSeconds: 0, eventDriven: true },
  GEOPOLITICAL: { freshSeconds: 0, agingSeconds: 0, eventDriven: true },
};

/**
 * Deterministic freshness. Computed from (category, data time, as-of time),
 * never stored as a bare status that silently rots.
 *
 * Returns UNKNOWN when the data time is missing — absence of a timestamp is
 * never treated as "current".
 */
export function computeFreshness(
  category: EvidenceCategory,
  dataTime: Date | null | undefined,
  asOf: Date,
  policy: Record<EvidenceCategory, FreshnessThresholds> = FRESHNESS_POLICY,
): FreshnessStatus {
  if (!dataTime) return "UNKNOWN";
  const p = policy[category];
  if (!p) return "UNKNOWN";
  // Event-driven categories are superseded by newer events, not by elapsed time.
  if (p.eventDriven) return "FRESH";

  const ageSeconds = (asOf.getTime() - dataTime.getTime()) / 1000;
  if (ageSeconds < 0) return "UNKNOWN";           // data from the future
  if (ageSeconds <= p.freshSeconds) return "FRESH";
  if (ageSeconds <= p.agingSeconds) return "AGING";
  return "STALE";
}

/** Stale or unknown critical evidence must lower usable confidence. */
export function freshnessConfidenceCeiling(status: FreshnessStatus): number {
  switch (status) {
    case "FRESH": return 100;
    case "AGING": return 75;
    case "STALE": return 40;
    case "UNKNOWN": return 30;
  }
}

// ── Evidence hashing ────────────────────────────────────────────────────────

export const EVIDENCE_HASH_VERSION = "v1";

/**
 * Canonical JSON: keys sorted recursively, no incidental whitespace.
 *
 * Object key order is an accident of construction, so hashing raw JSON.stringify
 * would make the same fact hash differently depending on how it was built.
 */
export function canonicalize(value: unknown): string {
  const walk = (v: any): any => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(walk);
    return Object.keys(v).sort().reduce((acc: any, k) => {
      acc[k] = walk(v[k]);
      return acc;
    }, {});
  };
  return JSON.stringify(walk(value));
}

export interface HashableEvidence {
  assetId: string | null;
  category: string;
  evidenceType: string;
  sourceKey: string;
  observedAt: string | null;   // ISO
  effectiveAt: string | null;  // ISO
  rawValue: unknown;
}

/**
 * Deliberately EXCLUDES retrievedAt and any database id.
 *
 * Re-fetching the same fact five minutes later must produce the same hash —
 * otherwise deduplication is impossible and the store fills with identical
 * observations. `observedAt`/`effectiveAt` ARE included because a fact valid
 * for a different moment is a different fact.
 */
export function buildHashInput(e: HashableEvidence): string {
  return canonicalize({
    v: EVIDENCE_HASH_VERSION,
    assetId: e.assetId,
    category: e.category,
    evidenceType: e.evidenceType,
    sourceKey: e.sourceKey,
    observedAt: e.observedAt,
    effectiveAt: e.effectiveAt,
    rawValue: e.rawValue,
  });
}

// ── Deduplication vs corroboration ──────────────────────────────────────────

export type IngestionOutcome = "INSERTED" | "DUPLICATE" | "CORROBORATION" | "SUPERSEDES";

/**
 * Same source repeating itself is a duplicate.
 * A DIFFERENT source stating the same claim is corroboration and must be kept —
 * independent agreement is the only thing that raises confidence, and a global
 * content hash would silently discard it.
 */
export function classifyIngestion(
  incoming: { sourceKey: string; hash: string; observedAt: Date | null },
  existing: Array<{ sourceKey: string; hash: string; observedAt: Date | null }>,
): IngestionOutcome {
  const sameSourceSameHash = existing.some(
    (e) => e.sourceKey === incoming.sourceKey && e.hash === incoming.hash,
  );
  if (sameSourceSameHash) return "DUPLICATE";

  const otherSourceSameHash = existing.some(
    (e) => e.sourceKey !== incoming.sourceKey && e.hash === incoming.hash,
  );
  if (otherSourceSameHash) return "CORROBORATION";

  const sameSourceNewer = existing.some(
    (e) =>
      e.sourceKey === incoming.sourceKey &&
      e.hash !== incoming.hash &&
      incoming.observedAt != null &&
      e.observedAt != null &&
      incoming.observedAt.getTime() > e.observedAt.getTime(),
  );
  if (sameSourceNewer) return "SUPERSEDES";

  return "INSERTED";
}

// ── Temporal correctness ────────────────────────────────────────────────────

/**
 * Historical replay must not see the future.
 *
 * Evidence may participate in an analysis at cutoff T only if we had actually
 * retrieved it by T (retrievedAt <= T) AND it was already in force by T
 * (effectiveAt <= T when set). A regulation announced today but effective next
 * month is knowable now and in force later — those are different tests, which
 * is why both timestamps exist.
 */
export function isVisibleAt(
  e: { retrievedAt: Date; effectiveAt: Date | null },
  cutoff: Date,
): boolean {
  if (e.retrievedAt.getTime() > cutoff.getTime()) return false;
  if (e.effectiveAt && e.effectiveAt.getTime() > cutoff.getTime()) return false;
  return true;
}

// ── Coverage (input to confidence, never confidence itself) ─────────────────

export function computeCoverage(required: string[], available: string[]): number {
  if (required.length === 0) return 1;
  const have = new Set(available);
  return required.filter((c) => have.has(c)).length / required.length;
}

// ── Fail-safe modes ─────────────────────────────────────────────────────────

export type AnalysisMode = "FULL" | "PARTIAL" | "DEGRADED" | "INSUFFICIENT_EVIDENCE" | "FAILED";

export function analysisMode(opts: {
  coverage: number;
  missingCritical: boolean;
  anySourceFailed: boolean;
  allSourcesFailed: boolean;
}): AnalysisMode {
  if (opts.allSourcesFailed) return "FAILED";
  if (opts.missingCritical) return "INSUFFICIENT_EVIDENCE";
  if (opts.coverage < 0.5) return "DEGRADED";
  if (opts.anySourceFailed || opts.coverage < 1) return "PARTIAL";
  return "FULL";
}
