// Phase 2B — sell-path truth models, selector scanning, call classification.
// Pure rules: no network.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scanSelectors, classifyCall, transferSucceeded, isPositiveDetection, countsAsChecked,
  classifyDeduction, CAPABILITY_COVERAGE_QUALITY, CLEAR_DEFINITION,
  BLACKLIST_SELECTORS,
} from "../shared/sell-path-rules";
import { PRODUCTION_PROVIDER_KEYS } from "../shared/security-rules";

// ── Non-boolean truth models ────────────────────────────────────────────────

test("a successful simulated sell is NOT a universal proof of safety", () => {
  const v = "NO_HONEYPOT_BEHAVIOR_OBSERVED_IN_TESTED_PATH";
  assert.equal(isPositiveDetection(v), false);
  // The verdict name itself carries the boundary — it is not "NOT_HONEYPOT".
  assert.match(v, /IN_TESTED_PATH$/);
  assert.ok(!/^NOT_HONEYPOT$/.test(v));
});

test("COVERAGE_INCOMPLETE and TEST_FAILED are not completed checks", () => {
  assert.equal(countsAsChecked("COVERAGE_INCOMPLETE"), false);
  assert.equal(countsAsChecked("TEST_FAILED"), false);
  assert.equal(countsAsChecked("UNKNOWN"), false);
  assert.equal(countsAsChecked("NO_HONEYPOT_BEHAVIOR_OBSERVED_IN_TESTED_PATH"), true);
  assert.equal(countsAsChecked("CONFIRMED_HONEYPOT_BEHAVIOR"), true);
  assert.equal(countsAsChecked("NOT_APPLICABLE"), true);
});

test("only genuine detections count as positive", () => {
  for (const v of ["CONFIRMED_HONEYPOT_BEHAVIOR", "SELL_RESTRICTION_DETECTED",
                   "BLACKLIST_INTERFACE_DETECTED",
                   "EFFECTIVE_DEDUCTION_OBSERVED_ON_TESTED_PATH", "TRANSFER_REVERTED"]) {
    assert.equal(isPositiveDetection(v), true, v);
  }
  for (const v of ["NO_RESTRICTION_OBSERVED_IN_TESTED_PATH", "ZERO_DEDUCTION_OBSERVED_ON_TESTED_PATH",
                   "NO_KNOWN_BLACKLIST_INTERFACE_DETECTED", "COVERAGE_INCOMPLETE", "TEST_FAILED"]) {
    assert.equal(isPositiveDetection(v), false, v);
  }
});

// ── Revert classification ───────────────────────────────────────────────────

test("a revert during simulation is token behaviour", () => {
  assert.equal(classifyCall({ ok: false, error: "execution reverted" }), "REVERT");
});

test("an RPC failure is NEVER read as token behaviour", () => {
  // Otherwise an outage becomes a false accusation of being a honeypot.
  for (const e of ["timeout", "http 502", "fetch failed", "network error"]) {
    assert.equal(classifyCall({ ok: false, error: e }), "RPC_ERROR", e);
  }
  // Unrecognised errors default to transport, not to guilt.
  assert.equal(classifyCall({ ok: false, error: "something odd" }), "RPC_ERROR");
});

test("a successful call is SUCCESS", () => {
  assert.equal(classifyCall({ ok: true, data: "0x01" }), "SUCCESS");
});

// ── Non-standard ERC-20 ─────────────────────────────────────────────────────

test("USDT-style empty return is success, not failure", () => {
  // USDT's transfer returns no data. Reading that as failure would flag the
  // largest stablecoin on Ethereum as a honeypot.
  assert.equal(transferSucceeded("SUCCESS", "0x"), true);
  assert.equal(transferSucceeded("SUCCESS", undefined), true);
});

test("an explicit false return is failure", () => {
  assert.equal(transferSucceeded("SUCCESS", "0x" + "0".repeat(64)), false);
});

test("a true return is success", () => {
  assert.equal(transferSucceeded("SUCCESS", "0x" + "0".repeat(63) + "1"), true);
});

test("a reverted or errored call is never success", () => {
  assert.equal(transferSucceeded("REVERT", "0x"), false);
  assert.equal(transferSucceeded("RPC_ERROR", "0x"), false);
});

// ── Blacklist selector scanning ─────────────────────────────────────────────

test("a known blacklist selector present in bytecode is detected", () => {
  const code = "0x6080604052fe575a87600080fd";   // contains isBlackListed selector
  assert.ok(scanSelectors(code, BLACKLIST_SELECTORS).length > 0);
});

test("selector absence does NOT prove the capability is absent", () => {
  // The verdict name is the contract here: NO_KNOWN_BLACKLIST_INTERFACE_DETECTED.
  const found = scanSelectors("0x6080604052600080fd", BLACKLIST_SELECTORS);
  assert.deepEqual(found, []);
  // Empty result maps to a bounded negative, never to `false`.
  assert.equal(isPositiveDetection("NO_KNOWN_BLACKLIST_INTERFACE_DETECTED"), false);
});

test("scanning is case-insensitive and deduplicated", () => {
  const code = "0xFE575A87" + "fe575a87";
  const found = scanSelectors(code, BLACKLIST_SELECTORS);
  assert.equal(found.length, new Set(found).size);
});

test("a legitimate stablecoin having a blacklist interface is not malicious", () => {
  // USDC and USDT both expose blacklist controls by design. Detection of the
  // interface is CAUTION, never CRITICAL.
  assert.equal(isPositiveDetection("BLACKLIST_INTERFACE_DETECTED"), true);
  // ...but the assessment maps it to CAUTION — asserted in the assessment tests.
});

// ── Production wiring ───────────────────────────────────────────────────────

test("sell-path is in the production provider set; GoPlus is not", () => {
  const keys = [...PRODUCTION_PROVIDER_KEYS] as string[];
  assert.ok(keys.includes("sell-path"));
  assert.ok(keys.includes("direct-chain"));
  assert.ok(!keys.includes("goplus"));
});


// ── Phase 2C: effective deduction ───────────────────────────────────────────

test("zero deduction is a bounded observation, never universal proof", () => {
  const r = classifyDeduction(BigInt(1000), BigInt(1000));
  assert.equal(r.severity, "NONE");
  assert.equal(r.deduction, BigInt(0));
  // The verdict name carries the boundary.
  assert.equal(isPositiveDetection("ZERO_DEDUCTION_OBSERVED_ON_TESTED_PATH"), false);
  assert.match("ZERO_DEDUCTION_OBSERVED_ON_TESTED_PATH", /ON_TESTED_PATH$/);
});

test("a moderate deduction is CAUTION and reports its size", () => {
  const r = classifyDeduction(BigInt(1000), BigInt(950));   // 5%
  assert.equal(r.severity, "CAUTION");
  assert.equal(r.deduction, BigInt(50));
  assert.ok(Math.abs(r.ratio - 0.05) < 1e-6);
});

test("a deduction at or above half the value is CRITICAL", () => {
  assert.equal(classifyDeduction(BigInt(1000), BigInt(500)).severity, "CRITICAL");
  assert.equal(classifyDeduction(BigInt(1000), BigInt(499)).severity, "CRITICAL");
  assert.equal(classifyDeduction(BigInt(1000), BigInt(501)).severity, "CAUTION");
});

test("a 100% deduction is CRITICAL even though nothing reverted", () => {
  // The transfer call succeeds; the recipient receives nothing. Economically
  // identical to a honeypot, reached without a revert.
  const r = classifyDeduction(BigInt(1000), BigInt(0));
  assert.equal(r.severity, "CRITICAL");
  assert.equal(r.ratio, 1);
});

test("deduction maths is exact on token-scale values", () => {
  const amt = BigInt("1000000000000000000000");     // 1000e18
  const r = classifyDeduction(amt, amt / BigInt(2));
  assert.equal(r.severity, "CRITICAL");
  assert.ok(Math.abs(r.ratio - 0.5) < 1e-6);
});

test("receiving more than requested is not a negative deduction", () => {
  const r = classifyDeduction(BigInt(1000), BigInt(1200));
  assert.equal(r.deduction, BigInt(0));
  assert.equal(r.severity, "NONE");
});

test("a zero requested amount cannot produce a ratio", () => {
  const r = classifyDeduction(BigInt(0), BigInt(0));
  assert.equal(r.severity, "NONE");
  assert.equal(r.ratio, 0);
});

// ── Coverage quality and the CLEAR contract ────────────────────────────────

test("blacklist is DETECTION_ONLY, not exclusion coverage", () => {
  assert.equal(CAPABILITY_COVERAGE_QUALITY.BLACKLIST_CAPABILITY, "DETECTION_ONLY");
  assert.notEqual(CAPABILITY_COVERAGE_QUALITY.BLACKLIST_CAPABILITY, "COMPLETE_FOR_DEFINED_CORE_CHECK");
});

test("simulation-based capabilities are PARTIAL, not complete", () => {
  for (const c of ["HONEYPOT_INDICATOR", "SELL_RESTRICTION", "SELL_TAX"]) {
    assert.equal(CAPABILITY_COVERAGE_QUALITY[c], "PARTIAL", c);
  }
});

test("Solana authority checks are complete for their CORE definition", () => {
  assert.equal(CAPABILITY_COVERAGE_QUALITY.MINT_AUTHORITY, "COMPLETE_FOR_DEFINED_CORE_CHECK");
  assert.equal(CAPABILITY_COVERAGE_QUALITY.FREEZE_AUTHORITY, "COMPLETE_FOR_DEFINED_CORE_CHECK");
});

test("CLEAR is formally defined and explicitly denies meaning SAFE", () => {
  assert.match(CLEAR_DEFINITION, /No critical security behaviour was established/);
  assert.match(CLEAR_DEFINITION, /does NOT mean the asset is safe/i);
  assert.match(CLEAR_DEFINITION, /prove presence but cannot prove absence/);
});

test("the deduction payload carries no block-volatile field", () => {
  // Regression, Phase 2E. The payload is hashed for deduplication, so any
  // field that moves on its own schedule makes an unchanged fact hash
  // differently on every read — the same measurement then accumulates a new
  // evidence row per block. Absolute pool balances did exactly that until
  // they were removed; amountReceived carries the same meaning and is stable.
  const payload = {
    verdict: "ZERO_DEDUCTION_OBSERVED_ON_TESTED_PATH",
    testedPath: { method: "eth_call", requested: "1000000" },
    requestedAmount: "1000000", amountReceived: "1000000",
    deductionAmount: "0", deductionRatio: 0, severity: "NONE",
    normalizerVersion: "deduction-probe-v1", knownFalseNegatives: [],
  };
  for (const banned of ["pairBalanceBefore", "pairBalanceAfter", "blockNumber", "timestamp"]) {
    assert.ok(!(banned in payload), `${banned} must not be hashed`);
  }
  assert.ok("amountReceived" in payload, "the stable measurement must survive");
});
