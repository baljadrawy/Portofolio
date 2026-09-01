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

export interface CapabilitySpec {
  capability: SecurityCapability;
  evm: boolean;
  solana: boolean;
  nativeApplicable: boolean;
  coreRequired: boolean;
  /** Can it be established from chain state alone, with no provider opinion? */
  deterministic: boolean;
  falsePositiveSensitivity: "LOW" | "MEDIUM" | "HIGH";
}

export const CAPABILITY_MATRIX: CapabilitySpec[] = [
  { capability: "CONTRACT_CODE_PRESENT", evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: true,  falsePositiveSensitivity: "LOW" },
  { capability: "HONEYPOT_INDICATOR",   evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: false, falsePositiveSensitivity: "HIGH" },
  { capability: "SELL_RESTRICTION",     evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: false, falsePositiveSensitivity: "HIGH" },
  { capability: "BUY_TAX",              evm: true,  solana: false, nativeApplicable: false, coreRequired: false, deterministic: false, falsePositiveSensitivity: "MEDIUM" },
  { capability: "SELL_TAX",             evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: false, falsePositiveSensitivity: "MEDIUM" },
  { capability: "MINT_AUTHORITY",       evm: true,  solana: true,  nativeApplicable: false, coreRequired: true,  deterministic: true,  falsePositiveSensitivity: "LOW" },
  { capability: "UNLIMITED_MINT_RISK",  evm: true,  solana: true,  nativeApplicable: false, coreRequired: true,  deterministic: false, falsePositiveSensitivity: "MEDIUM" },
  { capability: "FREEZE_AUTHORITY",     evm: false, solana: true,  nativeApplicable: false, coreRequired: true,  deterministic: true,  falsePositiveSensitivity: "LOW" },
  { capability: "BLACKLIST_CAPABILITY", evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: false, falsePositiveSensitivity: "MEDIUM" },
  { capability: "OWNERSHIP_PRIVILEGE",  evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: true,  falsePositiveSensitivity: "MEDIUM" },
  { capability: "PROXY_UPGRADEABILITY", evm: true,  solana: false, nativeApplicable: false, coreRequired: true,  deterministic: true,  falsePositiveSensitivity: "MEDIUM" },
  { capability: "ADMIN_PRIVILEGES",     evm: true,  solana: false, nativeApplicable: false, coreRequired: false, deterministic: true,  falsePositiveSensitivity: "MEDIUM" },
  { capability: "LIQUIDITY_RISK",       evm: true,  solana: true,  nativeApplicable: false, coreRequired: false, deterministic: false, falsePositiveSensitivity: "MEDIUM" },
  { capability: "HOLDER_CONCENTRATION", evm: true,  solana: true,  nativeApplicable: false, coreRequired: false, deterministic: false, falsePositiveSensitivity: "HIGH" },
  { capability: "KNOWN_CRITICAL_EXPLOIT", evm: true, solana: true, nativeApplicable: true,  coreRequired: true,  deterministic: false, falsePositiveSensitivity: "LOW" },
];

export function coreCapabilitiesFor(family: "evm" | "solana", isNative: boolean): SecurityCapability[] {
  return CAPABILITY_MATRIX.filter(
    (c) => c.coreRequired && (family === "evm" ? c.evm : c.solana) && (!isNative || c.nativeApplicable),
  ).map((c) => c.capability);
}

// ── Security disposition ────────────────────────────────────────────────────

/**
 * This is a SECURITY disposition, not an investment decision.
 * HOLD / REDUCE / EXIT do not exist at this layer and must not be introduced.
 */
export type SecurityDisposition = "CLEAR" | "CAUTION" | "CRITICAL" | "INSUFFICIENT_EVIDENCE";

/**
 * Incident-coverage semantics.
 *
 * LOCKED RULE:
 *   ABSENCE FROM AN INCOMPLETE REGISTRY  ≠  VERIFIED ABSENCE OF INCIDENTS
 *
 * A source may only assert VERIFIED_NO_KNOWN_CRITICAL_INCIDENT when it has a
 * declared, non-empty coverage scope that actually includes the asset. An empty
 * or scope-less registry yields COVERAGE_UNKNOWN, which does not count as a
 * checked capability and therefore cannot contribute to CLEAR.
 */
export type IncidentCoverage =
  | "VERIFIED_NO_KNOWN_CRITICAL_INCIDENT"
  | "KNOWN_CRITICAL_INCIDENT"
  | "COVERAGE_UNKNOWN"
  | "NOT_APPLICABLE";

/** Only a source with real coverage can produce a positive assurance. */
export function incidentCoverageFrom(opts: {
  registrySize: number;
  coverageScopeDeclared: boolean;
  assetInScope: boolean;
  hasUnresolvedCritical: boolean;
}): IncidentCoverage {
  if (opts.hasUnresolvedCritical) return "KNOWN_CRITICAL_INCIDENT";
  if (!opts.coverageScopeDeclared || opts.registrySize === 0) return "COVERAGE_UNKNOWN";
  if (!opts.assetInScope) return "COVERAGE_UNKNOWN";
  return "VERIFIED_NO_KNOWN_CRITICAL_INCIDENT";
}

/** COVERAGE_UNKNOWN must not be treated as a completed check. */
export function incidentCoverageCountsAsChecked(c: IncidentCoverage): boolean {
  return c === "VERIFIED_NO_KNOWN_CRITICAL_INCIDENT" || c === "KNOWN_CRITICAL_INCIDENT" || c === "NOT_APPLICABLE";
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
}

export interface DispositionResult {
  disposition: SecurityDisposition;
  policyVersion: string;
  reasons: string[];
  coverage: { required: number; checked: number; ratio: number; missing: SecurityCapability[] };
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

export function computeDisposition(input: DispositionInput): DispositionResult {
  const reasons: string[] = [];
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
    return { disposition: "CRITICAL", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage };
  }

  // 2. Conflicting critical evidence is surfaced, never silently resolved to
  //    the scarier side. Conservative here means "we do not know", not "danger".
  if (input.conflicts.length > 0) {
    reasons.push(`Sources disagree on: ${input.conflicts.join(", ")} — conflict surfaced, not resolved`);
    return { disposition: "INSUFFICIENT_EVIDENCE", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage };
  }

  // 3. A missing CORE capability means we did not look. That is not safety.
  if (missing.length > 0) {
    reasons.push(`Core capabilities not checked: ${missing.join(", ")}`);
    return { disposition: "INSUFFICIENT_EVIDENCE", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage };
  }

  // 4. Every provider failed → we know nothing.
  if (input.providersAttempted > 0 && input.providerFailures === input.providersAttempted) {
    reasons.push("All providers failed — no security signal obtained");
    return { disposition: "INSUFFICIENT_EVIDENCE", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage };
  }

  // 5. Unestablished critical signals downgrade to CAUTION, never CLEAR and
  //    never CRITICAL.
  if (unestablishedCritical.length > 0) {
    for (const f of unestablishedCritical) {
      reasons.push(`CAUTION: ${f.capability} flagged but not established (${f.freshness}, corroboration ${f.corroboration})`);
    }
    return { disposition: "CAUTION", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage };
  }

  const cautions = input.findings.filter((f) => f.severity === "CAUTION");
  if (cautions.length > 0) {
    for (const f of cautions) reasons.push(`CAUTION: ${f.capability} — ${f.detail}`);
    return { disposition: "CAUTION", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage };
  }

  // 6. Partial provider failure with full core coverage is still not CLEAR.
  if (input.providerFailures > 0) {
    reasons.push(`${input.providerFailures}/${input.providersAttempted} providers failed — coverage reduced`);
    return { disposition: "CAUTION", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage };
  }

  reasons.push("All core capabilities checked; no caution or critical findings");
  return { disposition: "CLEAR", policyVersion: SECURITY_POLICY_VERSION, reasons, coverage };
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
