// Phase 2 — adapter contract tests. Fixtures only: no network access.

import { test } from "node:test";
import assert from "node:assert/strict";
import { GoPlusAdapter } from "../server/services/security/goplus";
import { DirectChainAdapter } from "../server/services/security/direct-chain";
import { InternalRulesAdapter, type CuratedIncident } from "../server/services/security/internal-rules";
import { observationsToEvidence } from "../server/services/security-provider";
import { incidentAssuranceCredit, incidentBlocksClear, PRODUCTION_PROVIDER_KEYS,
  type IncidentIntelligenceStatus } from "../shared/security-rules";

const EVM = { networkFamily: "evm" as const, chainId: 1, contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" };

// ── supports() semantics ────────────────────────────────────────────────────

test("GoPlus rejects Solana and unsupported chains", () => {
  const g = new GoPlusAdapter();
  assert.equal(g.supports(EVM), true);
  assert.equal(g.supports({ ...EVM, chainId: 999999 }), false);
  assert.equal(g.supports({ networkFamily: "solana", contractAddress: "EPjFW" }), false);
});

test("adapters decline native assets rather than inventing a contract", () => {
  // Sending a fake contract address for ETH/SOL would be a fabricated input.
  for (const a of [new GoPlusAdapter(), new DirectChainAdapter()]) {
    assert.equal(a.supports({ ...EVM, contractAddress: "NATIVE" }), false);
    assert.equal(a.supports({ ...EVM, contractAddress: "" }), false);
  }
});

test("DirectChain supports both families but only configured EVM chains", () => {
  const d = new DirectChainAdapter();
  assert.equal(d.supports(EVM), true);
  assert.equal(d.supports({ ...EVM, chainId: 999999 }), false);
  assert.equal(d.supports({ networkFamily: "solana", contractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }), true);
});

test("unsupported input returns UNSUPPORTED with zero observations", async () => {
  const r = await new GoPlusAdapter().assess({ ...EVM, chainId: 999999 });
  assert.equal(r.status, "UNSUPPORTED");
  assert.equal(r.observations.length, 0);
});

test("all adapters declare themselves read-only and key-free", () => {
  for (const a of [new GoPlusAdapter(), new DirectChainAdapter(), new InternalRulesAdapter()]) {
    const c = a.capabilities();
    assert.equal(c.readOnly, true);
    assert.equal(c.requiresApiKey, false);
  }
});

// ── GoPlus normalisation, via the private method through a fixture ──────────

class TestableGoPlus extends GoPlusAdapter {
  norm(r: Record<string, any>) { return (this as any).normalize(r); }
}

test("GoPlus '1'/'0' strings normalise to booleans", () => {
  const o = new TestableGoPlus().norm({ is_honeypot: "1", is_proxy: "0" });
  assert.equal(o.find((x: any) => x.type === "HONEYPOT_INDICATOR")!.normalized, true);
  assert.equal(o.find((x: any) => x.type === "PROXY_UPGRADEABILITY")!.normalized, false);
});

test("a MISSING GoPlus field produces no observation, not a false", () => {
  // Coercing an absent field to false turns "we do not know" into "it is safe".
  const o = new TestableGoPlus().norm({ is_proxy: "0" });
  assert.equal(o.find((x: any) => x.type === "HONEYPOT_INDICATOR"), undefined);
  assert.equal(o.length, 1);
});

test("empty-string and null GoPlus fields are ignored", () => {
  assert.equal(new TestableGoPlus().norm({ is_honeypot: "", is_proxy: null }).length, 0);
});

test("GoPlus supplies no timestamp, so observedAt stays null rather than invented", () => {
  const o = new TestableGoPlus().norm({ is_honeypot: "1" });
  assert.equal(o[0].observedAt, null);
});

test("non-numeric tax values are dropped, not coerced to zero", () => {
  assert.equal(new TestableGoPlus().norm({ buy_tax: "abc" }).length, 0);
  assert.equal(new TestableGoPlus().norm({ buy_tax: "0.05" })[0].normalized, 0.05);
});

// ── Internal incident registry ──────────────────────────────────────────────

// ── Phase 2E contract correction ────────────────────────────────────────────
// The five tests that stood here pinned the previous contract, in which the
// internal registry answered a mandatory CORE capability and could assert
// VERIFIED_NO_KNOWN_CRITICAL_INCIDENT for an in-scope asset. Phase 2D showed
// that contract cannot be honoured by any source: exhaustive negative incident
// coverage is an open-world problem. The tests below pin the corrected
// contract, which is strictly more conservative — it removed the only path
// that ever produced a positive assurance from an absence.

test("an empty registry produces NO observation at all, not a clean verdict", async () => {
  const adapter = new InternalRulesAdapter([], []);
  const r = await adapter.assess({ networkFamily: "evm", chainId: 1, contractAddress: "0xabc" } as any);
  assert.equal(r.status, "OK");
  assert.equal(r.observations.length, 0,
    "silence must not be encoded as an observation — there is no fact to report");
});

test("no assurance credit exists for any incident status", () => {
  const all: IncidentIntelligenceStatus[] = [
    "ACTIVE_CRITICAL_INCIDENT_FOUND", "INCIDENT_CONFLICT_UNRESOLVED",
    "NO_ACTIVE_CRITICAL_INCIDENT_FOUND_IN_QUERIED_SOURCES",
    "NOT_AVAILABLE", "SOURCE_FAILED", "NOT_APPLICABLE",
  ];
  // Including the one that means "we looked and found nothing". Especially it.
  for (const st of all) assert.equal(incidentAssuranceCredit(st), 0, st);
});

test("only a found incident blocks CLEAR; silence and failure never do", () => {
  assert.equal(incidentBlocksClear("ACTIVE_CRITICAL_INCIDENT_FOUND"), true);
  assert.equal(incidentBlocksClear("INCIDENT_CONFLICT_UNRESOLVED"), true);
  assert.equal(incidentBlocksClear("NOT_AVAILABLE"), false);
  assert.equal(incidentBlocksClear("SOURCE_FAILED"), false);
  assert.equal(incidentBlocksClear("NO_ACTIVE_CRITICAL_INCIDENT_FOUND_IN_QUERIED_SOURCES"), false);
});

test("a matching unresolved critical incident is reported as active", async () => {
  const adapter = new InternalRulesAdapter([{
    networkFamily: "evm", chainId: 1, addressKey: "0xbad",
    title: "drained via reentrancy", occurredAt: "2025-01-01",
    severity: "CRITICAL", reference: "https://example.test/advisory", unresolved: true,
  }], []);
  const r = await adapter.assess({ networkFamily: "evm", chainId: 1, contractAddress: "0xBAD" } as any);
  assert.equal(r.observations.length, 1);
  assert.equal(r.observations[0].normalized, "ACTIVE_CRITICAL_INCIDENT_FOUND");
});

test("a resolved historical incident stays on record without claiming active risk", async () => {
  const adapter = new InternalRulesAdapter([{
    networkFamily: "evm", chainId: 1, addressKey: "0xold",
    title: "exploited and since patched", occurredAt: "2024-03-02",
    severity: "CRITICAL", reference: "https://example.test/postmortem", unresolved: false,
  }], []);
  const r = await adapter.assess({ networkFamily: "evm", chainId: 1, contractAddress: "0xOLD" } as any);
  // The incident fact survives — it happened, permanently. Its CURRENT impact
  // is a separate axis and is not asserted to be critical.
  assert.equal((r.observations[0].raw as any).matches.length, 1);
  assert.notEqual(r.observations[0].normalized, "ACTIVE_CRITICAL_INCIDENT_FOUND");
});

test("a Solana mint is matched case-sensitively", async () => {
  const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const adapter = new InternalRulesAdapter([{
    networkFamily: "solana", addressKey: mint, title: "t", occurredAt: "2025-01-01",
    severity: "CRITICAL", reference: "https://example.test/x", unresolved: true,
  }], []);
  const hit = await adapter.assess({ networkFamily: "solana", contractAddress: mint } as any);
  assert.equal(hit.observations.length, 1);
  // Lowercasing a base58 mint would stop it matching itself.
  const miss = await adapter.assess({ networkFamily: "solana", contractAddress: mint.toLowerCase() } as any);
  assert.equal(miss.observations.length, 0);
});
test("a resolved historical incident does not assert present risk", async () => {
  // Event Fact vs Current Assessment: the exploit happened; it is no longer live.
  const inc: CuratedIncident = {
    networkFamily: "evm", chainId: 1, addressKey: EVM.contractAddress.toLowerCase(),
    title: "historical exploit", occurredAt: "2026-01-01", severity: "CRITICAL",
    reference: "https://example.test/report", unresolved: false,
  };
  const r = await new InternalRulesAdapter([inc]).assess(EVM);
  assert.notEqual(r.observations[0].normalized, "ACTIVE_CRITICAL_INCIDENT_FOUND", "resolved incident must not assert current risk");
  const matches = (r.observations[0].raw as any).matches;
  assert.equal(matches.length, 1, "but the historical fact is still recorded");
  assert.equal(matches[0].occurredAt, "2026-01-01");
});

test("an unresolved critical incident does assert present risk", async () => {
  const inc: CuratedIncident = {
    networkFamily: "evm", chainId: 1, addressKey: EVM.contractAddress.toLowerCase(),
    title: "active exploit", occurredAt: "2026-08-01", severity: "CRITICAL",
    reference: "https://example.test/live", unresolved: true,
  };
  assert.equal((await new InternalRulesAdapter([inc]).assess(EVM)).observations[0].normalized, "ACTIVE_CRITICAL_INCIDENT_FOUND");
});

test("registry matching respects per-family address casing", async () => {
  const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const inc: CuratedIncident = {
    networkFamily: "solana", addressKey: mint, title: "x", occurredAt: "2026-01-01",
    severity: "CRITICAL", reference: "r", unresolved: true,
  };
  const hit = await new InternalRulesAdapter([inc]).assess({ networkFamily: "solana", contractAddress: mint });
  assert.equal(hit.observations[0].normalized, "ACTIVE_CRITICAL_INCIDENT_FOUND");
  // Lowercasing a Solana mint yields a DIFFERENT address and must not match.
  // After Phase 2E a non-match emits no observation at all rather than a
  // "clean" verdict, so the assertion is on silence.
  const miss = await new InternalRulesAdapter([inc]).assess({ networkFamily: "solana", contractAddress: mint.toLowerCase() });
  assert.equal(miss.observations.length, 0);
});

// ── Evidence normalisation ──────────────────────────────────────────────────

test("adapter observations become Evidence with a provider-neutral source key", () => {
  const ev = observationsToEvidence(
    { providerKey: "goplus", status: "OK", latencyMs: 1,
      observations: [{ type: "HONEYPOT_INDICATOR", raw: { is_honeypot: "1" }, normalized: true }] },
    "asset-1",
  );
  assert.equal(ev[0].sourceKey, "security:goplus");
  assert.equal(ev[0].category, "SECURITY");
  assert.deepEqual(ev[0].rawValue, { is_honeypot: "1" });
});

test("no vendor name leaks into the evidence field names", () => {
  const ev = observationsToEvidence(
    { providerKey: "goplus", status: "OK", latencyMs: 1,
      observations: [{ type: "HONEYPOT_INDICATOR", raw: {}, normalized: true }] },
    "a1",
  );
  for (const k of Object.keys(ev[0])) {
    assert.ok(!/goplus|palisade|vendor/i.test(k), `vendor leaked: ${k}`);
  }
});


// ── Production provider set (REMEDIATION C) ─────────────────────────────────

test("GoPlus is NOT in the production provider set", () => {
  // Its licence restricts commercial use and is silent on caching/retention.
  // Silence is not permission, and the Evidence Store caches by design.
  assert.ok(!(PRODUCTION_PROVIDER_KEYS as readonly string[]).includes("goplus"));
  assert.deepEqual([...PRODUCTION_PROVIDER_KEYS], ["direct-chain", "sell-path", "internal-rules"]);
});

test("CONTRACT_CODE_PRESENT claims only what eth_getCode proves", () => {
  // eth_getCode proves bytecode exists at the address. It says nothing about
  // whether source was published or verified on an explorer.
  const d = new DirectChainAdapter();
  assert.ok(d.capabilities().observationTypes.includes("CONTRACT_CODE_PRESENT"));
  assert.ok(!(d.capabilities().observationTypes as string[]).includes("SOURCE_CODE_VERIFIED"));
});
