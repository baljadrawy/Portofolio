// Pure security rules — no network, no database, no provider SDK.
// Deterministic and unit-testable in isolation.

export const SECURITY_POLICY_VERSION = "security-policy-v3";

/**
 * Providers permitted in the production CORE path.
 *
 * Declared here, in a pure module, so it is a POLICY statement testable without
 * booting the database — and so the production set cannot drift silently.
 *
 * GoPlus is deliberately absent: its licence restricts commercial use without
 * written permission and is silent on caching and retention. Silence is not
 * permission, and the Evidence Store caches and retains by design.
 */
export const PRODUCTION_PROVIDER_KEYS = ["direct-chain", "sell-path", "internal-rules"] as const;

// ── Capabilities ────────────────────────────────────────────────────────────

export type SecurityCapability =
  | "CONTRACT_CODE_PRESENT" | "HONEYPOT_INDICATOR" | "SELL_RESTRICTION"
  | "BUY_TAX" | "SELL_TAX" | "MINT_AUTHORITY" | "UNLIMITED_MINT_RISK"
  | "FREEZE_AUTHORITY" | "BLACKLIST_CAPABILITY" | "OWNERSHIP_PRIVILEGE"
  | "PROXY_UPGRADEABILITY" | "ADMIN_PRIVILEGES" | "LIQUIDITY_RISK"
  | "HOLDER_CONCENTRATION" | "KNOWN_CRITICAL_EXPLOIT";

/**
 * Applicability is per network family and is NOT a coverage gap.
 *
 * NOT_APPLICABLE  the question is meaningless here (an EVM proxy slot on a
 *                 Solana mint, a contract check on a native asset)
 * UNSUPPORTED     meaningful, but no configured source can answer it
 * UNKNOWN         meaningful and supported, but we did not obtain an answer
 * FAILED          we tried and the attempt errored
 *
 * Collapsing these four is how a system reports a clean bill of health for a
 * check it never ran.
 */
export type CapabilityState = "CHECKED" | "NOT_APPLICABLE" | "UNSUPPORTED" | "UNKNOWN" | "FAILED";

/**
 * DETERMINISTIC          answerable from chain state or a bounded probe. Its
 *                        scope is knowable, so "we checked and found nothing"
 *                        is a real result.
 * EXTERNAL_INTELLIGENCE  a fact about the outside world, reported by people.
 *                        No source can enumerate everything that happened, so
 *                        absence here is never a result — only a silence.
 *
 * Phase 2D established this empirically: no legally usable incident source
 * declares coverage over the asset class. Phase 2E draws the consequence —
 * these two kinds cannot share one coverage denominator, because a missing
 * deterministic check means "we did not look" while missing external
 * intelligence means "nobody can look exhaustively".
 */
export type CapabilityKind = "DETERMINISTIC" | "EXTERNAL_INTELLIGENCE";

export interface CapabilitySpec {
  capability: SecurityCapability;
  kind: CapabilityKind;
  evm: boolean;
  solana: boolean;
  nativeApplicable: boolean;
  coreRequired: boolean;
  /** Can it be established from chain state alone, with no provider opinion? */
  deterministic: boolean;
  falsePositiveSensitivity: "LOW" | "MEDIUM" | "HIGH";
}

export const CAPABILITY_MATRIX: CapabilitySpec[] = [
  { capability: "CONTRACT_CODE_PRESENT", kind: "DETERMINISTIC", evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: true,  falsePositiveSensitivity: "LOW" },
  { capability: "HONEYPOT_INDICATOR", kind: "DETERMINISTIC",   evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: false, falsePositiveSensitivity: "HIGH" },
  { capability: "SELL_RESTRICTION", kind: "DETERMINISTIC",     evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: false, falsePositiveSensitivity: "HIGH" },
  { capability: "BUY_TAX", kind: "DETERMINISTIC",              evm: true,  solana: false, nativeApplicable: false, coreRequired: false, deterministic: false, falsePositiveSensitivity: "MEDIUM" },
  { capability: "SELL_TAX", kind: "DETERMINISTIC",             evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: false, falsePositiveSensitivity: "MEDIUM" },
  { capability: "MINT_AUTHORITY", kind: "DETERMINISTIC",       evm: true,  solana: true,  nativeApplicable: false, coreRequired: true,  deterministic: true,  falsePositiveSensitivity: "LOW" },
  { capability: "UNLIMITED_MINT_RISK", kind: "DETERMINISTIC",  evm: true,  solana: true,  nativeApplicable: false, coreRequired: true,  deterministic: false, falsePositiveSensitivity: "MEDIUM" },
  { capability: "FREEZE_AUTHORITY", kind: "DETERMINISTIC",     evm: false, solana: true,  nativeApplicable: false, coreRequired: true,  deterministic: true,  falsePositiveSensitivity: "LOW" },
  { capability: "BLACKLIST_CAPABILITY", kind: "DETERMINISTIC", evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: false, falsePositiveSensitivity: "MEDIUM" },
  { capability: "OWNERSHIP_PRIVILEGE", kind: "DETERMINISTIC",  evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: true,  falsePositiveSensitivity: "MEDIUM" },
  { capability: "PROXY_UPGRADEABILITY", kind: "DETERMINISTIC", evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: true,  falsePositiveSensitivity: "MEDIUM" },
  { capability: "ADMIN_PRIVILEGES", kind: "DETERMINISTIC",     evm: true,  solana: false, nativeApplicable: false, coreRequired: false, deterministic: true,  falsePositiveSensitivity: "MEDIUM" },
  { capability: "LIQUIDITY_RISK", kind: "DETERMINISTIC",       evm: true,  solana: true,  nativeApplicable: false, coreRequired: false, deterministic: false, falsePositiveSensitivity: "MEDIUM" },
  { capability: "HOLDER_CONCENTRATION", kind: "DETERMINISTIC", evm: true,  solana: true,  nativeApplicable: false, coreRequired: false, deterministic: false, falsePositiveSensitivity: "HIGH" },
  // coreRequired is FALSE by contract correction, not by convenience. It is not
  // optional — an active incident still vetoes CLEAR (see computeDisposition).
  // What was removed is the requirement to PROVE ITS ABSENCE, which no source
  // can do. Its launch requirement moved to Phase 3, not away. See TD-27/TD-40.
  { capability: "KNOWN_CRITICAL_EXPLOIT", kind: "EXTERNAL_INTELLIGENCE", evm: true, solana: true, nativeApplicable: true,  coreRequired: false, deterministic: false, falsePositiveSensitivity: "LOW" },
];

/**
 * The DETERMINISTIC CORE set — the checks whose scope we can state and whose
 * completion we can verify. External intelligence is excluded by construction,
 * so it can never silently become part of a coverage ratio.
 */
export function coreCapabilitiesFor(family: "evm" | "solana", isNative: boolean): SecurityCapability[] {
  return CAPABILITY_MATRIX.filter(
    (c) => c.kind === "DETERMINISTIC" && c.coreRequired &&
      (family === "evm" ? c.evm : c.solana) && (!isNative || c.nativeApplicable),
  ).map((c) => c.capability);
}

// ── Security disposition ────────────────────────────────────────────────────

/**
 * This is a SECURITY disposition, not an investment decision.
 * HOLD / REDUCE / EXIT do not exist at this layer and must not be introduced.
 */
export type SecurityDisposition = "CLEAR" | "CAUTION" | "CRITICAL" | "INSUFFICIENT_EVIDENCE";

/**
 * External incident intelligence — status, never assurance.
 *
 * LOCKED RULES:
 *   ABSENCE FROM AN INCOMPLETE SOURCE  ≠  VERIFIED ABSENCE OF INCIDENTS
 *   NO EVIDENCE FOUND                  ≠  EVIDENCE OF NO INCIDENT
 *
 * `VERIFIED_NO_KNOWN_CRITICAL_INCIDENT` was removed in Phase 2E. It claimed
 * verified global absence, which is not a defensible statement about an
 * open world: no source enumerates every incident that has ever occurred, so
 * no lookup can establish that none did.
 *
 * What replaces it says only what actually happened — sources were queried and
 * returned nothing — and carries zero assurance weight.
 */
export type IncidentIntelligenceStatus =
  /** A credible, currently-active critical incident was found. Vetoes CLEAR. */
  | "ACTIVE_CRITICAL_INCIDENT_FOUND"
  /** Credible sources disagree on whether a critical incident is unresolved. */
  | "INCIDENT_CONFLICT_UNRESOLVED"
  /** A real lookup ran and returned nothing. Informational ONLY. */
  | "NO_ACTIVE_CRITICAL_INCIDENT_FOUND_IN_QUERIED_SOURCES"
  /** No provider configured, or no lookup was performed. */
  | "NOT_AVAILABLE"
  /** A lookup was attempted and the source errored, timed out, or malformed. */
  | "SOURCE_FAILED"
  /** The question does not apply to this asset. */
  | "NOT_APPLICABLE";

/**
 * Zero. Always. The return type is the literal `0`, so a future change that
 * tries to grant assurance for a not-found result fails to compile rather than
 * quietly reintroducing proof-by-absence.
 */
export function incidentAssuranceCredit(_s: IncidentIntelligenceStatus): 0 {
  return 0;
}

/** Only a found incident blocks. Silence never blocks and never clears. */
export function incidentBlocksClear(s: IncidentIntelligenceStatus): boolean {
  return s === "ACTIVE_CRITICAL_INCIDENT_FOUND" || s === "INCIDENT_CONFLICT_UNRESOLVED";
}

/**
 * Incident intelligence NEVER counts toward deterministic coverage — in either
 * direction. A found incident blocks through the disposition, not by inflating
 * a ratio; a silent source does not deflate one.
 */
export function incidentCountsTowardDeterministicCoverage(): false {
  return false;
}

export interface IncidentIntelligenceReport {
  status: IncidentIntelligenceStatus;
  /** Sources actually queried. Empty means no lookup happened. */
  sourcesQueried: string[];
  /** Incidents affirmatively found. Absence of findings is not a finding. */
  positiveFindings: number;
  /** Structurally zero — see incidentAssuranceCredit. */
  assuranceCredit: 0;
  /** Why the status is what it is, in one line, for a human reading a report. */
  detail: string;
}

export interface Finding {
  capability: SecurityCapability;
  severity: "INFO" | "CAUTION" | "CRITICAL";
  deterministic: boolean;
  /** How many independent sources assert it. */
  corroboration: number;
  freshness: "FRESH" | "AGING" | "STALE" | "UNKNOWN";
  /**
   * Whether `freshness` was computed from an observation time the source
   * actually stated, or fell back to the moment we retrieved it.
   *
   * RETRIEVED means the evidence row carries `observedAt = null` — the source
   * told us a fact but not when it became true. The fallback is sound for a
   * live chain read, which is by construction current, but it must stay
   * visible: a caller that treats RETRIEVED freshness as an observed
   * timestamp is reading a guarantee that was never made.
   */
  freshnessBasis: "OBSERVED" | "RETRIEVED";
  evidenceIds: string[];
  detail: string;
}

export interface DispositionInput {
  findings: Finding[];
  coreRequired: SecurityCapability[];
  checked: SecurityCapability[];
  conflicts: SecurityCapability[];
  providerFailures: number;
  providersAttempted: number;
  /**
   * External incident intelligence. Optional: an assessment that performed no
   * incident lookup at all is NOT_AVAILABLE, which is honest and non-blocking.
   */
  incidentIntelligence?: IncidentIntelligenceReport;
}

export interface DispositionResult {
  disposition: SecurityDisposition;
  policyVersion: string;
  reasons: string[];
  /** DETERMINISTIC checks only. External intelligence is never in this ratio. */
  coverage: { required: number; checked: number; ratio: number; missing: SecurityCapability[] };
  /** Reported alongside coverage, never folded into it. */
  incidentIntelligence: IncidentIntelligenceReport;
}

/**
 * A CRITICAL finding is only allowed to drive the disposition when it is
 * actually established:
 *
 *   deterministic  → chain state proved it, one source is enough
 *   provider-only  → requires corroboration (>= 2 independent sources)
 *
 * A single weak provider signal can therefore never produce CRITICAL by itself.
 * Stale evidence can never establish CRITICAL either — a honeypot flag from
 * three weeks ago is a reason to re-check, not a verdict.
 */
export function isEstablishedCritical(f: Finding): boolean {
  if (f.severity !== "CRITICAL") return false;
  if (f.freshness === "STALE" || f.freshness === "UNKNOWN") return false;
  return f.deterministic || f.corroboration >= 2;
}

export const NO_INCIDENT_LOOKUP: IncidentIntelligenceReport = {
  status: "NOT_AVAILABLE",
  sourcesQueried: [],
  positiveFindings: 0,
  assuranceCredit: 0,
  detail: "no incident intelligence source is configured; this asset was not searched",
};

export function computeDisposition(input: DispositionInput): DispositionResult {
  const reasons: string[] = [];
  const incidentIntelligence = input.incidentIntelligence ?? NO_INCIDENT_LOOKUP;
  const missing = input.coreRequired.filter((c) => !input.checked.includes(c));
  const coverage = {
    required: input.coreRequired.length,
    checked: input.coreRequired.filter((c) => input.checked.includes(c)).length,
    ratio: input.coreRequired.length === 0 ? 1 : input.coreRequired.filter((c) => input.checked.includes(c)).length / input.coreRequired.length,
    missing,
  };

  const establishedCritical = input.findings.filter(isEstablishedCritical);
  const unestablishedCritical = input.findings.filter((f) => f.severity === "CRITICAL" && !isEstablishedCritical(f));

  // 1. Established critical wins outright.
  if (establishedCritical.length > 0) {
    for (const f of establishedCritical) {
      reasons.push(`CRITICAL: ${f.capability} — ${f.detail} (${f.deterministic ? "deterministic" : `corroborated x${f.corroboration}`})`);
    }
    return { disposition: "CRITICAL", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage, incidentIntelligence };
  }

  // 2. A credible active incident vetoes CLEAR on its own authority.
  //
  //    This is the half of incident intelligence that survives the Phase 2E
  //    correction intact. Finding an incident is a positive observation about
  //    the world and it is trusted. NOT finding one is silence, and silence is
  //    handled nowhere in this function — deliberately, because there is no
  //    rule to write. It neither blocks nor clears.
  if (incidentBlocksClear(incidentIntelligence.status)) {
    reasons.push(
      incidentIntelligence.status === "ACTIVE_CRITICAL_INCIDENT_FOUND"
        ? `CRITICAL: active critical incident — ${incidentIntelligence.detail}`
        : `Unresolved incident conflict — ${incidentIntelligence.detail}`,
    );
    return {
      disposition: incidentIntelligence.status === "ACTIVE_CRITICAL_INCIDENT_FOUND" ? "CRITICAL" : "INSUFFICIENT_EVIDENCE",
      policyVersion: SECURITY_POLICY_VERSION, reasons, coverage, incidentIntelligence,
    };
  }

  // 3. Conflicting critical evidence is surfaced, never silently resolved to
  //    the scarier side. Conservative here means "we do not know", not "danger".
  if (input.conflicts.length > 0) {
    reasons.push(`Sources disagree on: ${input.conflicts.join(", ")} — conflict surfaced, not resolved`);
    return { disposition: "INSUFFICIENT_EVIDENCE", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage, incidentIntelligence };
  }

  // 4. An empty CORE set cannot produce CLEAR. A native asset has no token
  //    contract, so every contract-level capability is inapplicable and the
  //    required set is empty — which would make CLEAR vacuously true. A verdict
  //    that holds because nothing was asked is not a verdict.
  if (coverage.required === 0) {
    reasons.push("No CORE security capability applies to this asset; contract-level assessment is not meaningful");
    return { disposition: "INSUFFICIENT_EVIDENCE", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage, incidentIntelligence };
  }

  // 5. A missing CORE capability means we did not look. That is not safety.
  if (missing.length > 0) {
    reasons.push(`Core capabilities not checked: ${missing.join(", ")}`);
    return { disposition: "INSUFFICIENT_EVIDENCE", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage, incidentIntelligence };
  }

  // 4. Every provider failed → we know nothing.
  if (input.providersAttempted > 0 && input.providerFailures === input.providersAttempted) {
    reasons.push("All providers failed — no security signal obtained");
    return { disposition: "INSUFFICIENT_EVIDENCE", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage, incidentIntelligence };
  }

  // 5. Unestablished critical signals downgrade to CAUTION, never CLEAR and
  //    never CRITICAL.
  if (unestablishedCritical.length > 0) {
    for (const f of unestablishedCritical) {
      reasons.push(`CAUTION: ${f.capability} flagged but not established (${f.freshness}, corroboration ${f.corroboration})`);
    }
    return { disposition: "CAUTION", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage, incidentIntelligence };
  }

  const cautions = input.findings.filter((f) => f.severity === "CAUTION");
  if (cautions.length > 0) {
    for (const f of cautions) reasons.push(`CAUTION: ${f.capability} — ${f.detail}`);
    return { disposition: "CAUTION", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage, incidentIntelligence };
  }

  // 6. Partial provider failure with full core coverage is still not CLEAR.
  if (input.providerFailures > 0) {
    reasons.push(`${input.providerFailures}/${input.providersAttempted} providers failed — coverage reduced`);
    return { disposition: "CAUTION", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage, incidentIntelligence };
  }

  reasons.push("All core capabilities checked; no caution or critical findings");
  return { disposition: "CLEAR", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage, incidentIntelligence };
}

// ── EVM chain-state helpers ─────────────────────────────────────────────────

/** EIP-1967 and the older zeppelin-os slot. USDC uses the LATTER. */
export const PROXY_SLOTS = {
  EIP1967_IMPLEMENTATION: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  EIP1967_ADMIN:          "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
  ZEPPELINOS_IMPLEMENTATION: "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3",
} as const;

/**
 * EIP-7702 lets an EOA carry a delegation indicator `0xef0100 || address`.
 * Treating that as "this is a contract" misclassifies ordinary wallets, so the
 * prefix is excluded explicitly.
 */
export const EIP7702_DELEGATION_PREFIX = "0xef0100";

export function isContractCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const c = code.toLowerCase();
  if (c === "0x" || c === "0x0") return false;
  if (c.startsWith(EIP7702_DELEGATION_PREFIX)) return false;
  return c.length > 2;
}

export function slotIsSet(slotValue: string | null | undefined): boolean {
  if (!slotValue) return false;
  try { return BigInt(slotValue) !== BigInt(0); } catch { return false; }
}

export function addressFromSlot(slotValue: string): string {
  return "0x" + slotValue.slice(-40);
}

/**
 * Proxy detection covers known slot patterns only. A negative result means
 * "no KNOWN proxy pattern found", not "definitely not a proxy" — USDC is a
 * live example that fails EIP-1967 while genuinely being a proxy.
 */
export type ProxyDetection = "KNOWN_PROXY_PATTERN_DETECTED" | "NO_KNOWN_PROXY_PATTERN_DETECTED";

export function detectProxy(slots: { eip1967?: string; zeppelin?: string }): {
  detection: ProxyDetection;
  /** True only when a pattern matched. Never asserts "not upgradeable". */
  isProxy: boolean;
  pattern: string | null;
  implementation: string | null;
  patternsChecked: string[];
} {
  const patternsChecked = ["EIP-1967", "zeppelinos"];
  if (slotIsSet(slots.eip1967))
    return { detection: "KNOWN_PROXY_PATTERN_DETECTED", isProxy: true, pattern: "EIP-1967", implementation: addressFromSlot(slots.eip1967!), patternsChecked };
  if (slotIsSet(slots.zeppelin))
    return { detection: "KNOWN_PROXY_PATTERN_DETECTED", isProxy: true, pattern: "zeppelinos", implementation: addressFromSlot(slots.zeppelin!), patternsChecked };
  // NOT "definitely not upgradeable" — only these two patterns were examined.
  return { detection: "NO_KNOWN_PROXY_PATTERN_DETECTED", isProxy: false, pattern: null, implementation: null, patternsChecked };
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function isRenounced(owner: string | null | undefined): boolean {
  return !owner || owner.toLowerCase() === ZERO_ADDRESS;
}
