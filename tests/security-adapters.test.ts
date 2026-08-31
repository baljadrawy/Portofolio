// Phase 2 — adapter contract tests. Fixtures only: no network access.

import { test } from "node:test";
import assert from "node:assert/strict";
import { GoPlusAdapter } from "../server/services/security/goplus";
import { DirectChainAdapter } from "../server/services/security/direct-chain";
import { InternalRulesAdapter, type CuratedIncident } from "../server/services/security/internal-rules";
import { observationsToEvidence } from "../server/services/security-provider";

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

test("empty registry reports no incident but declares its caveat", async () => {
  const r = await new InternalRulesAdapter([]).assess(EVM);
  assert.equal(r.status, "OK");
  const o = r.observations[0];
  assert.equal(o.normalized, false);
  assert.match(String((o.raw as any).coverageCaveat), /absence is not proof of absence/);
});

test("a resolved historical incident does not assert present risk", async () => {
  // Event Fact vs Current Assessment: the exploit happened; it is no longer live.
  const inc: CuratedIncident = {
    networkFamily: "evm", chainId: 1, addressKey: EVM.contractAddress.toLowerCase(),
    title: "historical exploit", occurredAt: "2026-01-01", severity: "CRITICAL",
    reference: "https://example.test/report", unresolved: false,
  };
  const r = await new InternalRulesAdapter([inc]).assess(EVM);
  assert.equal(r.observations[0].normalized, false, "resolved incident must not assert current risk");
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
  assert.equal((await new InternalRulesAdapter([inc]).assess(EVM)).observations[0].normalized, true);
});

test("registry matching respects per-family address casing", async () => {
  const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const inc: CuratedIncident = {
    networkFamily: "solana", addressKey: mint, title: "x", occurredAt: "2026-01-01",
    severity: "CRITICAL", reference: "r", unresolved: true,
  };
  const hit = await new InternalRulesAdapter([inc]).assess({ networkFamily: "solana", contractAddress: mint });
  assert.equal(hit.observations[0].normalized, true);
  // Lowercasing a Solana mint yields a DIFFERENT address and must not match.
  const miss = await new InternalRulesAdapter([inc]).assess({ networkFamily: "solana", contractAddress: mint.toLowerCase() });
  assert.equal(miss.observations[0].normalized, false);
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
