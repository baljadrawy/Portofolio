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

export type SellTaxVerdict =
  | "OBSERVED_EFFECTIVE_TAX"
  | "NO_TAX_OBSERVED_IN_TESTED_PATH"
  | "COVERAGE_INCOMPLETE"
  | "TEST_FAILED"
  | "NOT_APPLICABLE";

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
    v === "OBSERVED_EFFECTIVE_TAX";
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

/** Scans runtime bytecode for known selectors. Presence only, never absence. */
export function scanSelectors(code: string, table: Record<string, string>): string[] {
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
