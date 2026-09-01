// Pure rules for EVM sell-path probing. No network, no database.

// ── Capability truth models ─────────────────────────────────────────────────
//
// Each of these deliberately avoids a bare boolean, because a boolean would
// imply a certainty the measurement does not provide.

export type HoneypotVerdict =
  | "CONFIRMED_HONEYPOT_BEHAVIOR"
  | "NO_HONEYPOT_BEHAVIOR_OBSERVED_IN_TESTED_PATH"
  | "COVERAGE_INCOMPLETE"
  | "TEST_FAILED"
  | "NOT_APPLICABLE";

export type SellRestrictionVerdict =
  | "SELL_RESTRICTION_DETECTED"
  | "NO_RESTRICTION_OBSERVED_IN_TESTED_PATH"
  | "COVERAGE_INCOMPLETE"
  | "TEST_FAILED"
  | "NOT_APPLICABLE";

/**
 * Effective deduction on the tested path.
 *
 * The name says "OBSERVED … ON_TESTED_PATH" because that is all a single
 * simulation establishes. A zero deduction here does NOT mean the token has no
 * sell tax — it means this amount, from this sender, into this pair, at this
 * block, lost nothing.
 */
export type SellDeductionVerdict =
  | "EFFECTIVE_DEDUCTION_OBSERVED_ON_TESTED_PATH"
  | "ZERO_DEDUCTION_OBSERVED_ON_TESTED_PATH"
  | "TRANSFER_REVERTED"
  | "COVERAGE_INCOMPLETE"
  | "TEST_FAILED"
  | "NOT_APPLICABLE";

/** Backwards-compatible alias; the category stays SELL_TAX. */
export type SellTaxVerdict = SellDeductionVerdict;

/**
 * Deduction thresholds.
 *
 * RATIONALE, not invented numbers:
 *   1.0  — a 100% deduction means the recipient receives nothing. The transfer
 *          call may succeed, but the position is economically unsellable, which
 *          is what a honeypot achieves. Deterministic and unambiguous.
 *   0.5  — above half the value destroyed, the asset cannot be exited at any
 *          reasonable loss. Treated as CRITICAL.
 *   0.0  — any measurable deduction is worth surfacing as CAUTION; the size is
 *          reported so a human judges it. No opinion is encoded about what
 *          level is "acceptable".
 */
export const DEDUCTION_CRITICAL_RATIO = 0.5;
export const DEDUCTION_TOTAL_RATIO = 1.0;

export type DeductionSeverity = "NONE" | "CAUTION" | "CRITICAL";

export function classifyDeduction(requested: bigint, received: bigint): {
  severity: DeductionSeverity; ratio: number; deduction: bigint;
} {
  if (requested <= BigInt(0)) return { severity: "NONE", ratio: 0, deduction: BigInt(0) };
  const capped = received < BigInt(0) ? BigInt(0) : received;
  const deduction = requested > capped ? requested - capped : BigInt(0);
  // Ratio via a scaled integer division to avoid float error on huge values.
  const ratio = Number((deduction * BigInt(1_000_000)) / requested) / 1_000_000;
  if (ratio >= DEDUCTION_CRITICAL_RATIO) return { severity: "CRITICAL", ratio, deduction };
  if (deduction > BigInt(0)) return { severity: "CAUTION", ratio, deduction };
  return { severity: "NONE", ratio: 0, deduction: BigInt(0) };
}

export type BlacklistVerdict =
  | "BLACKLIST_INTERFACE_DETECTED"
  | "NO_KNOWN_BLACKLIST_INTERFACE_DETECTED"
  | "COVERAGE_INCOMPLETE"
  | "TEST_FAILED"
  | "NOT_APPLICABLE";

/**
 * Only these verdicts represent a completed check. The "no X observed" cases
 * are genuine observations but of LIMITED coverage — they are recorded, they
 * inform the disposition, and they never stand alone as proof of safety.
 */
export function isPositiveDetection(v: string): boolean {
  return v === "CONFIRMED_HONEYPOT_BEHAVIOR" ||
    v === "SELL_RESTRICTION_DETECTED" ||
    v === "BLACKLIST_INTERFACE_DETECTED" ||
    v === "EFFECTIVE_DEDUCTION_OBSERVED_ON_TESTED_PATH" ||
    v === "MINT_INTERFACE_DETECTED" ||
    v === "TRANSFER_REVERTED";
}

/** COVERAGE_INCOMPLETE, TEST_FAILED and UNKNOWN are not completed checks. */
export function countsAsChecked(v: string): boolean {
  return v !== "COVERAGE_INCOMPLETE" && v !== "TEST_FAILED" && v !== "UNKNOWN";
}

// ── Known selectors ─────────────────────────────────────────────────────────

/**
 * Blacklist/freeze interfaces seen on real tokens, keyed by 4-byte selector.
 *
 * DETECTION ONLY. A selector that is absent proves nothing: the same capability
 * can be implemented under any name, inlined, or reached through a proxy. That
 * is why the negative verdict is NO_KNOWN_BLACKLIST_INTERFACE_DETECTED and
 * never "no blacklist capability".
 */
export const BLACKLIST_SELECTORS: Record<string, string> = {
  "fe575a87": "isBlackListed(address)",
  "e47d6060": "isBlackListed(address)",
  "0ecb93c0": "addBlackList(address)",
  "e4997dc5": "removeBlackList(address)",
  "f9f92be4": "blacklist(address)",
  "1a895266": "unBlacklist(address)",
  "59bf1abe": "isFrozen(address)",
  "d4ce1415": "isBlacklisted(address)",
  "9811c7c1": "blacklisters(address)",
  "3092afd5": "removeBlacklist(address)",
  "8456cb59": "pause()",
  "3f4ba83a": "unpause()",
};

/**
 * Mint interfaces, same DETECTION_ONLY contract as the blacklist table.
 * ERC-20 does not standardise minting, so absence proves nothing — a token can
 * mint through any internal path under any name.
 */
export const MINT_SELECTORS: Record<string, string> = {
  "40c10f19": "mint(address,uint256)",
  "a0712d68": "mint(uint256)",
  "94bf804d": "mint(uint256,address)",
  "d0def521": "mint(address,string)",
  "449a52f8": "mintTo(address,uint256)",
  "6a627842": "mint(address)",
  "1249c58b": "mint()",
  "983b2d56": "addMinter(address)",
  "aa271e1a": "isMinter(address)",
  "42966c68": "burn(uint256)",
};

/** Scans runtime bytecode for known selectors. Presence only, never absence. */
export function scanSelectors(code: string, table: Record<string, string>): string[] {
  // KNOWN IMPRECISION: a 4-byte sequence can also appear inside constants or
  // packed data, so this can over-report. That is acceptable only because every
  // selector finding maps to CAUTION and never to CRITICAL — an over-report
  // costs a warning, not a false accusation.
  const hex = code.toLowerCase().replace(/^0x/, "");
  const found: string[] = [];
  for (const [sel, name] of Object.entries(table)) {
    // A PUSH4 of the selector is how solc dispatches; substring match is a
    // sufficient and deliberately conservative heuristic for DETECTION.
    if (hex.includes(sel)) found.push(name);
  }
  return Array.from(new Set(found));
}

// ── Revert classification ───────────────────────────────────────────────────

export type CallOutcome = "SUCCESS" | "REVERT" | "RPC_ERROR";

/**
 * A revert during a simulated sell is evidence of restriction ONLY when the
 * call itself was well-formed. An RPC transport failure must never be read as
 * token behaviour — that is how an outage becomes a false accusation.
 */
export function classifyCall(result: { ok: boolean; data?: string; error?: string }): CallOutcome {
  if (result.ok) return "SUCCESS";
  const e = (result.error ?? "").toLowerCase();
  if (e.includes("revert") || e.includes("execution reverted")) return "REVERT";
  if (e.includes("timeout") || e.includes("fetch") || e.includes("http") || e.includes("network")) return "RPC_ERROR";
  // Unrecognised: treat as transport, not as token guilt.
  return "RPC_ERROR";
}

/**
 * Non-standard ERC-20s (USDT is the canonical example) return no data from
 * transfer. Empty return data after a non-reverting call is SUCCESS.
 */
export function transferSucceeded(outcome: CallOutcome, data: string | undefined): boolean {
  if (outcome !== "SUCCESS") return false;
  if (!data || data === "0x") return true;          // USDT-style
  try { return BigInt(data) !== BigInt(0); } catch { return true; }
}


// ── Coverage quality ────────────────────────────────────────────────────────

/**
 * How well a capability was actually covered. "Checked" is not one thing:
 * a behavioural simulation and a selector scan are different kinds of answer.
 */
export type CoverageQuality =
  | "COMPLETE_FOR_DEFINED_CORE_CHECK"   // the CORE check ran fully within its scope
  | "DETECTION_ONLY"                    // presence detectable, absence not provable
  | "PARTIAL"
  | "UNKNOWN"
  | "FAILED"
  | "NOT_APPLICABLE";

/**
 * Blacklist is DETECTION_ONLY and will remain so without a full analyser.
 * It counts toward CORE coverage, but the CLEAR definition states explicitly
 * that a clear result never asserts the capability is absent.
 */
export const CAPABILITY_COVERAGE_QUALITY: Record<string, CoverageQuality> = {
  CONTRACT_CODE_PRESENT: "COMPLETE_FOR_DEFINED_CORE_CHECK",
  PROXY_UPGRADEABILITY: "DETECTION_ONLY",
  OWNERSHIP_PRIVILEGE: "DETECTION_ONLY",
  MINT_AUTHORITY: "COMPLETE_FOR_DEFINED_CORE_CHECK",
  FREEZE_AUTHORITY: "COMPLETE_FOR_DEFINED_CORE_CHECK",
  UNLIMITED_MINT_RISK: "COMPLETE_FOR_DEFINED_CORE_CHECK",
  HONEYPOT_INDICATOR: "PARTIAL",
  SELL_RESTRICTION: "PARTIAL",
  SELL_TAX: "PARTIAL",
  BLACKLIST_CAPABILITY: "DETECTION_ONLY",
  MINT_AUTHORITY_EVM: "DETECTION_ONLY",
  KNOWN_CRITICAL_EXPLOIT: "UNKNOWN",
};

/**
 * FORMAL DEFINITION OF `CLEAR`.
 *
 * Kept in code, not only in prose, so it travels with every result.
 */
export const CLEAR_DEFINITION =
  "No critical security behaviour was established within the completed CORE " +
  "security checks at the assessed state. CLEAR does NOT mean the asset is " +
  "safe, is not a scam, has no malicious capability, or carries no future " +
  "risk. Several CORE checks are DETECTION_ONLY or PARTIAL: they can prove " +
  "presence but cannot prove absence.";
