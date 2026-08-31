// Phase 1 — SecurityProvider contract tests.
// Uses a FakeProvider throughout: no live API, no network, no vendor.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  observationsToEvidence, failureReducesCoverage, SecurityProviderRegistry,
  type SecurityProvider, type SecurityAssessmentInput, type SecurityAssessmentResult,
  type ProviderCapabilities,
} from "../server/services/security-provider";

class FakeProvider implements SecurityProvider {
  readonly providerKey = "fake";
  constructor(private mode: "ok" | "timeout" | "malformed" = "ok") {}

  capabilities(): ProviderCapabilities {
    return {
      providerKey: this.providerKey,
      supportedFamilies: ["evm"],
      supportedChainIds: [1, 137],
      observationTypes: ["HONEYPOT_INDICATOR", "MINT_AUTHORITY"],
      requiresApiKey: false,
      readOnly: true,
    };
  }

  supports(i: SecurityAssessmentInput): boolean {
    const c = this.capabilities();
    return c.supportedFamilies.includes(i.networkFamily) &&
      (i.chainId == null || c.supportedChainIds.includes(i.chainId));
  }

  async assess(i: SecurityAssessmentInput): Promise<SecurityAssessmentResult> {
    if (!this.supports(i)) {
      return { providerKey: this.providerKey, status: "UNSUPPORTED", observations: [], latencyMs: 0 };
    }
    if (this.mode === "timeout") {
      return { providerKey: this.providerKey, status: "TIMEOUT", observations: [], latencyMs: 5000, error: "timeout" };
    }
    if (this.mode === "malformed") {
      return { providerKey: this.providerKey, status: "MALFORMED", observations: [], latencyMs: 12, error: "unparseable" };
    }
    return {
      providerKey: this.providerKey,
      status: "OK",
      latencyMs: 42,
      observations: [
        { type: "HONEYPOT_INDICATOR", raw: { canSell: true }, normalized: false, observedAt: new Date("2026-09-01T00:00:00Z") },
        { type: "MINT_AUTHORITY", raw: { mintable: false }, normalized: false },
      ],
    };
  }

  async health() { return { healthy: this.mode === "ok" }; }
}

const EVM_INPUT: SecurityAssessmentInput = {
  networkFamily: "evm", chainId: 1,
  contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

test("supported asset produces observations", async () => {
  const r = await new FakeProvider().assess(EVM_INPUT);
  assert.equal(r.status, "OK");
  assert.equal(r.observations.length, 2);
});

test("unsupported chain is reported, not guessed", async () => {
  const r = await new FakeProvider().assess({ ...EVM_INPUT, chainId: 8453 });
  assert.equal(r.status, "UNSUPPORTED");
  assert.equal(r.observations.length, 0);
});

test("unsupported family is reported", async () => {
  const r = await new FakeProvider().assess({ networkFamily: "solana", contractAddress: "EPjFW" });
  assert.equal(r.status, "UNSUPPORTED");
});

test("timeout yields zero observations, never a clean bill of health", async () => {
  const r = await new FakeProvider("timeout").assess(EVM_INPUT);
  assert.equal(r.status, "TIMEOUT");
  assert.equal(r.observations.length, 0);
  assert.equal(failureReducesCoverage(r), true, "failure must reduce coverage, not imply safety");
});

test("malformed provider output does not become evidence", async () => {
  const r = await new FakeProvider("malformed").assess(EVM_INPUT);
  assert.equal(r.status, "MALFORMED");
  assert.equal(observationsToEvidence(r, "asset-1").length, 0);
});

test("provider unavailable does NOT mean the asset is safe", async () => {
  const r = await new FakeProvider("timeout").assess(EVM_INPUT);
  const ev = observationsToEvidence(r, "asset-1");
  assert.equal(ev.length, 0);
  assert.ok(!ev.some((e) => e.evidenceType === "HONEYPOT_INDICATOR"),
    "absence of a finding is not a finding of absence");
});

test("observations normalise into Evidence with a provider-neutral source key", async () => {
  const r = await new FakeProvider().assess(EVM_INPUT);
  const ev = observationsToEvidence(r, "asset-1");
  assert.equal(ev.length, 2);
  assert.equal(ev[0].category, "SECURITY");
  assert.equal(ev[0].sourceKey, "security:fake");
  assert.equal(ev[0].assetId, "asset-1");
  assert.ok(ev[0].rawValue !== undefined, "raw provider payload is preserved");
});

test("evidence carries no vendor-specific field", async () => {
  const r = await new FakeProvider().assess(EVM_INPUT);
  const keys = Object.keys(observationsToEvidence(r, "a1")[0]);
  for (const k of keys) {
    assert.ok(!/palisade|goplus|vendor/i.test(k), `vendor name leaked into schema: ${k}`);
  }
});

test("assessment input carries no portfolio data", () => {
  const keys = Object.keys(EVM_INPUT);
  for (const forbidden of ["amount", "balance", "quantity", "portfolioValue", "userId", "wallet", "holdings"]) {
    assert.ok(!keys.includes(forbidden), `privacy leak: ${forbidden}`);
  }
  assert.deepEqual(keys.sort(), ["chainId", "contractAddress", "networkFamily"]);
});

test("registry selects only providers that support the input", () => {
  const reg = new SecurityProviderRegistry();
  reg.register(new FakeProvider());
  assert.equal(reg.supporting(EVM_INPUT).length, 1);
  assert.equal(reg.supporting({ networkFamily: "solana", contractAddress: "X" }).length, 0);
  assert.deepEqual(reg.list(), ["fake"]);
});

test("providers declare themselves read-only", () => {
  assert.equal(new FakeProvider().capabilities().readOnly, true);
});
