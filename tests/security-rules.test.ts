// Phase 2 — capability matrix, disposition engine, EVM chain-state helpers.
// Pure rules: no network, no database.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeDisposition, NO_INCIDENT_LOOKUP, type IncidentIntelligenceReport, isEstablishedCritical, coreCapabilitiesFor,
  isContractCode, detectProxy, slotIsSet, isRenounced,
  EIP7702_DELEGATION_PREFIX, SECURITY_POLICY_VERSION, CAPABILITY_MATRIX,
  type Finding,
} from "../shared/security-rules";

const f = (o: Partial<Finding>): Finding => ({
  capability: "HONEYPOT_INDICATOR", severity: "CRITICAL", deterministic: false,
  corroboration: 1, freshness: "FRESH", freshnessBasis: "OBSERVED", evidenceIds: [], detail: "t", ...o,
});
const base = {
  coreRequired: ["HONEYPOT_INDICATOR"] as any, checked: ["HONEYPOT_INDICATOR"] as any,
  conflicts: [], providerFailures: 0, providersAttempted: 1,
};

// ── EVM chain-state correctness ─────────────────────────────────────────────

test("EIP-7702 delegated EOA is NOT a contract", () => {
  // Verified live: a well-known EOA returns 0xef0100<address>. Treating that as
  // a contract would misclassify ordinary wallets.
  assert.equal(isContractCode("0xef01005a7fc11397e9a8ad41bf10bf13f22b0a63f96f6d"), false);
  assert.ok(EIP7702_DELEGATION_PREFIX === "0xef0100");
});

test("empty code is not a contract; real bytecode is", () => {
  assert.equal(isContractCode("0x"), false);
  assert.equal(isContractCode(null), false);
  assert.equal(isContractCode("0x60806040"), true);
});

test("proxy detection covers the legacy slot, not only EIP-1967", () => {
  // Verified live: USDC is a proxy but its EIP-1967 slot is zero.
  const usdcLike = detectProxy({
    eip1967: "0x0000000000000000000000000000000000000000000000000000000000000000",
    zeppelin: "0x00000000000000000000000043506849d7c04f9138d1a2050bbf3a0c054402dd",
  });
  assert.equal(usdcLike.isProxy, true);
  assert.equal(usdcLike.pattern, "zeppelinos");
  assert.equal(usdcLike.implementation, "0x43506849d7c04f9138d1a2050bbf3a0c054402dd");
});

test("no known proxy pattern means not-detected, never proven-absent", () => {
  const r = detectProxy({ eip1967: "0x0", zeppelin: "0x0" });
  assert.equal(r.detection, "NO_KNOWN_PROXY_PATTERN_DETECTED");
  assert.equal(r.isProxy, false);
  assert.equal(r.pattern, null);
  // The patterns actually examined are recorded, so the claim stays bounded.
  assert.deepEqual(r.patternsChecked, ["EIP-1967", "zeppelinos"]);
});

test("a detected proxy is labelled as a detection, not an exhaustive verdict", () => {
  const r = detectProxy({ zeppelin: "0x00000000000000000000000043506849d7c04f9138d1a2050bbf3a0c054402dd" });
  assert.equal(r.detection, "KNOWN_PROXY_PATTERN_DETECTED");
});

test("zero slot and renounced ownership", () => {
  assert.equal(slotIsSet("0x0"), false);
  assert.equal(slotIsSet("0x00000000000000000000000000000000000000000000000000000000000000ff"), true);
  assert.equal(isRenounced("0x0000000000000000000000000000000000000000"), true);
  assert.equal(isRenounced(null), true);
  assert.equal(isRenounced("0xfcb19e6a322b27c06842a71e8c725399f049ae3a"), false);
});

// ── Capability matrix ───────────────────────────────────────────────────────

test("core capabilities differ per network family", () => {
  const evm = coreCapabilitiesFor("evm", false);
  const sol = coreCapabilitiesFor("solana", false);
  assert.ok(evm.includes("HONEYPOT_INDICATOR"));
  assert.ok(!sol.includes("HONEYPOT_INDICATOR"), "honeypot is an EVM concept");
  assert.ok(sol.includes("FREEZE_AUTHORITY"));
  assert.ok(!evm.includes("FREEZE_AUTHORITY"), "no EVM freeze authority equivalent");
});

test("a native asset has no deterministic CORE capability at all", () => {
  // Corrected in Phase 2E. Previously this returned KNOWN_CRITICAL_EXPLOIT,
  // which is external intelligence rather than a deterministic check — the
  // conflation this phase removed. A native asset has no token contract, so
  // there is genuinely nothing here to verify deterministically, and the
  // disposition must refuse to call that CLEAR.
  const native = coreCapabilitiesFor("evm", true);
  assert.deepEqual(native, []);
  assert.ok(!native.includes("CONTRACT_CODE_PRESENT"), "a native asset has no contract");
});

test("every capability declares false-positive sensitivity", () => {
  for (const c of CAPABILITY_MATRIX) {
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(c.falsePositiveSensitivity), c.capability);
  }
});

// ── Established-critical rule ───────────────────────────────────────────────

test("a single non-deterministic signal is NOT established critical", () => {
  assert.equal(isEstablishedCritical(f({ deterministic: false, corroboration: 1 })), false);
});

test("corroborated or deterministic critical IS established", () => {
  assert.equal(isEstablishedCritical(f({ deterministic: false, corroboration: 2 })), true);
  assert.equal(isEstablishedCritical(f({ deterministic: true, corroboration: 1 })), true);
});

test("stale evidence can never establish critical", () => {
  assert.equal(isEstablishedCritical(f({ deterministic: true, freshness: "STALE" })), false);
  assert.equal(isEstablishedCritical(f({ corroboration: 3, freshness: "UNKNOWN" })), false);
});

// ── Disposition ─────────────────────────────────────────────────────────────

test("confirmed critical honeypot yields CRITICAL", () => {
  const r = computeDisposition({ ...base, findings: [f({ deterministic: true })] });
  assert.equal(r.disposition, "CRITICAL");
  assert.match(r.reasons[0], /HONEYPOT_INDICATOR/);
});

test("a single weak warning downgrades to CAUTION, never CRITICAL", () => {
  const r = computeDisposition({ ...base, findings: [f({ deterministic: false, corroboration: 1 })] });
  assert.equal(r.disposition, "CAUTION");
});

test("conflicting sources surface the conflict instead of picking the scarier side", () => {
  const r = computeDisposition({ ...base, findings: [], conflicts: ["HONEYPOT_INDICATOR"] as any });
  assert.equal(r.disposition, "INSUFFICIENT_EVIDENCE");
  assert.match(r.reasons[0], /disagree/);
});

test("missing core capability is INSUFFICIENT_EVIDENCE, not CLEAR", () => {
  const r = computeDisposition({ ...base, findings: [], checked: [] as any });
  assert.equal(r.disposition, "INSUFFICIENT_EVIDENCE");
  assert.deepEqual(r.coverage.missing, ["HONEYPOT_INDICATOR"]);
});

test("all providers failing can never yield CLEAR", () => {
  const r = computeDisposition({ ...base, findings: [], providerFailures: 2, providersAttempted: 2 });
  assert.notEqual(r.disposition, "CLEAR");
  assert.equal(r.disposition, "INSUFFICIENT_EVIDENCE");
});

test("partial provider failure is CAUTION, not CLEAR", () => {
  const r = computeDisposition({ ...base, findings: [], providerFailures: 1, providersAttempted: 2 });
  assert.equal(r.disposition, "CAUTION");
});

test("high holder concentration alone is CAUTION, not CRITICAL", () => {
  const r = computeDisposition({
    ...base,
    coreRequired: ["HOLDER_CONCENTRATION"] as any,
    checked: ["HOLDER_CONCENTRATION"] as any,
    findings: [f({ capability: "HOLDER_CONCENTRATION", severity: "CAUTION" })],
  });
  assert.equal(r.disposition, "CAUTION");
});

test("a verified benign contract with full coverage is CLEAR", () => {
  const r = computeDisposition({ ...base, findings: [] });
  assert.equal(r.disposition, "CLEAR");
});

test("coverage is reported separately from disposition", () => {
  const r = computeDisposition({
    ...base,
    coreRequired: ["A", "B", "C", "D"] as any,
    checked: ["A", "B", "C"] as any,
    findings: [],
  });
  assert.equal(r.coverage.ratio, 0.75);
  assert.equal(r.coverage.required, 4);
  assert.equal(r.coverage.checked, 3);
});

test("every disposition carries a policy version", () => {
  assert.equal(computeDisposition({ ...base, findings: [] }).policyVersion, SECURITY_POLICY_VERSION);
});

test("no investment decision vocabulary exists at this layer", () => {
  const r = computeDisposition({ ...base, findings: [f({ deterministic: true })] });
  for (const forbidden of ["HOLD", "SELL", "EXIT", "REDUCE", "BUY"]) {
    assert.notEqual(r.disposition as string, forbidden);
  }
});

// ── Phase 2B: sell-path verdicts in the disposition ─────────────────────────

test("a confirmed honeypot is CRITICAL from a single deterministic observation", () => {
  const r = computeDisposition({
    ...base,
    coreRequired: ["HONEYPOT_INDICATOR"] as any,
    checked: ["HONEYPOT_INDICATOR"] as any,
    findings: [f({ capability: "HONEYPOT_INDICATOR", severity: "CRITICAL", deterministic: true })],
  });
  assert.equal(r.disposition, "CRITICAL");
});

test("a blacklist INTERFACE is CAUTION, never CRITICAL", () => {
  // USDC and USDT both expose one by design. Treating the interface as proof of
  // malice would flag the two largest stablecoins on Ethereum.
  const r = computeDisposition({
    ...base,
    coreRequired: ["BLACKLIST_CAPABILITY"] as any,
    checked: ["BLACKLIST_CAPABILITY"] as any,
    findings: [f({ capability: "BLACKLIST_CAPABILITY", severity: "CAUTION", deterministic: true })],
  });
  assert.equal(r.disposition, "CAUTION");
});

test("missing honeypot coverage blocks CLEAR", () => {
  const r = computeDisposition({
    ...base,
    coreRequired: ["HONEYPOT_INDICATOR", "SELL_RESTRICTION"] as any,
    checked: ["SELL_RESTRICTION"] as any,
    findings: [],
  });
  assert.equal(r.disposition, "INSUFFICIENT_EVIDENCE");
  assert.deepEqual(r.coverage.missing, ["HONEYPOT_INDICATOR"]);
});

test("missing blacklist coverage blocks CLEAR", () => {
  const r = computeDisposition({
    ...base,
    coreRequired: ["HONEYPOT_INDICATOR", "BLACKLIST_CAPABILITY"] as any,
    checked: ["HONEYPOT_INDICATOR"] as any,
    findings: [],
  });
  assert.equal(r.disposition, "INSUFFICIENT_EVIDENCE");
});

test("full coverage with only bounded negative observations permits CLEAR", () => {
  // "No restriction observed in the tested path" is a real observation. With
  // every CORE capability checked and nothing flagged, CLEAR is allowed — the
  // bounded-coverage caveat travels in the evidence payload, not in a veto.
  const r = computeDisposition({
    ...base,
    coreRequired: ["HONEYPOT_INDICATOR", "SELL_RESTRICTION", "BLACKLIST_CAPABILITY"] as any,
    checked: ["HONEYPOT_INDICATOR", "SELL_RESTRICTION", "BLACKLIST_CAPABILITY"] as any,
    findings: [],
  });
  assert.equal(r.disposition, "CLEAR");
});

test("a RETRIEVED freshness basis stays visible on the finding", () => {
  // The basis is not decorative. FRESH-by-RETRIEVED means the source never
  // stated when the fact became true; we substituted the moment we asked.
  // Sound for a live chain read, misleading if silently read as observed.
  const retrieved = f({ freshnessBasis: "RETRIEVED" });
  assert.equal(retrieved.freshness, "FRESH");
  assert.equal(retrieved.freshnessBasis, "RETRIEVED");
  // It must not quietly change how a critical is established — the basis
  // records provenance, it does not grant or withhold standing.
  assert.equal(
    isEstablishedCritical(f({ severity: "CRITICAL", deterministic: true, freshnessBasis: "RETRIEVED" })),
    isEstablishedCritical(f({ severity: "CRITICAL", deterministic: true, freshnessBasis: "OBSERVED" })),
  );
});


// ── Phase 2E — deterministic security vs external incident intelligence ─────
//
// The contract these tests pin: finding an incident is knowledge and it acts;
// not finding one is silence and it does nothing. Before this correction the
// second half was wired backwards — silence blocked CLEAR for every asset
// forever, which read as rigour but was really an inability to answer.

const CORE3 = ["HONEYPOT_INDICATOR", "SELL_RESTRICTION", "BLACKLIST_CAPABILITY"] as any;

function incident(over: Partial<IncidentIntelligenceReport>): IncidentIntelligenceReport {
  return { status: "NOT_AVAILABLE", sourcesQueried: [], positiveFindings: 0, assuranceCredit: 0, detail: "t", ...over };
}

test("deterministic checks complete + incident intelligence unavailable → CLEAR permitted", () => {
  const r = computeDisposition({
    findings: [], coreRequired: CORE3, checked: CORE3, conflicts: [],
    providerFailures: 0, providersAttempted: 2,
    incidentIntelligence: incident({ status: "NOT_AVAILABLE" }),
  });
  assert.equal(r.disposition, "CLEAR");
  // CLEAR here is the bounded statement, and the unknown is still on the face
  // of the result rather than swallowed by it.
  assert.equal(r.incidentIntelligence.status, "NOT_AVAILABLE");
  assert.equal(r.incidentIntelligence.assuranceCredit, 0);
});

test("an active critical incident vetoes CLEAR even when every check is clean", () => {
  const r = computeDisposition({
    findings: [], coreRequired: CORE3, checked: CORE3, conflicts: [],
    providerFailures: 0, providersAttempted: 2,
    incidentIntelligence: incident({ status: "ACTIVE_CRITICAL_INCIDENT_FOUND", positiveFindings: 1 }),
  });
  assert.equal(r.disposition, "CRITICAL");
});

test("an unresolved incident conflict blocks CLEAR without asserting danger", () => {
  const r = computeDisposition({
    findings: [], coreRequired: CORE3, checked: CORE3, conflicts: [],
    providerFailures: 0, providersAttempted: 2,
    incidentIntelligence: incident({ status: "INCIDENT_CONFLICT_UNRESOLVED" }),
  });
  assert.equal(r.disposition, "INSUFFICIENT_EVIDENCE");
});

test("an incident source failure does not block deterministic CLEAR, and is disclosed", () => {
  const r = computeDisposition({
    findings: [], coreRequired: CORE3, checked: CORE3, conflicts: [],
    providerFailures: 0, providersAttempted: 2,
    incidentIntelligence: incident({ status: "SOURCE_FAILED", sourcesQueried: ["internal-rules"] }),
  });
  assert.equal(r.disposition, "CLEAR");
  assert.equal(r.incidentIntelligence.status, "SOURCE_FAILED");
  assert.equal(r.incidentIntelligence.assuranceCredit, 0, "a failure must never earn assurance");
});

test("a missing deterministic capability still blocks CLEAR regardless of incident status", () => {
  for (const st of ["NOT_AVAILABLE", "NO_ACTIVE_CRITICAL_INCIDENT_FOUND_IN_QUERIED_SOURCES"] as const) {
    const r = computeDisposition({
      findings: [], coreRequired: CORE3, checked: ["HONEYPOT_INDICATOR"] as any, conflicts: [],
      providerFailures: 0, providersAttempted: 2,
      incidentIntelligence: incident({ status: st }),
    });
    assert.equal(r.disposition, "INSUFFICIENT_EVIDENCE", st);
    assert.ok(r.coverage.missing.length > 0);
  }
});

test("a search that found nothing earns no assurance and is named for what it is", () => {
  const r = computeDisposition({
    findings: [], coreRequired: CORE3, checked: CORE3, conflicts: [],
    providerFailures: 0, providersAttempted: 2,
    incidentIntelligence: incident({
      status: "NO_ACTIVE_CRITICAL_INCIDENT_FOUND_IN_QUERIED_SOURCES",
      sourcesQueried: ["internal-rules"],
    }),
  });
  // The name says "in queried sources". It does not say verified absence, and
  // no type in the union can express verified absence any more.
  assert.equal(r.incidentIntelligence.status, "NO_ACTIVE_CRITICAL_INCIDENT_FOUND_IN_QUERIED_SOURCES");
  assert.equal(r.incidentIntelligence.assuranceCredit, 0);
  assert.equal(r.coverage.required, 3, "incident intelligence never enters the deterministic denominator");
});

test("incident intelligence defaults to NOT_AVAILABLE when the caller omits it", () => {
  const r = computeDisposition({
    findings: [], coreRequired: CORE3, checked: CORE3, conflicts: [],
    providerFailures: 0, providersAttempted: 1,
  });
  assert.equal(r.incidentIntelligence.status, "NOT_AVAILABLE");
  assert.equal(r.incidentIntelligence, NO_INCIDENT_LOOKUP);
});

test("a native asset cannot reach a vacuous CLEAR on an empty capability set", () => {
  // Required set is empty, so "no critical behaviour was established" would be
  // trivially true. A verdict that holds because nothing was asked is not one.
  const r = computeDisposition({
    findings: [], coreRequired: [], checked: [], conflicts: [],
    providerFailures: 0, providersAttempted: 1,
  });
  assert.equal(r.disposition, "INSUFFICIENT_EVIDENCE");
});
