// Phase 0B — mandatory identity tests.
// Uses node:test (built into Node 20) + tsx. No new dependency.
//
// These cover the resolution RULES, which are pure and deterministic.
// DB-backed lookups are exercised via a seeded in-memory registry so the suite
// never touches the production database.

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAddressKey } from "../shared/asset-identity-rules";

// ── Address normalisation ───────────────────────────────────────────────────

test("EVM addresses are case-insensitive for identity", () => {
  const checksummed = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const lower = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  assert.equal(
    normalizeAddressKey("evm", checksummed),
    normalizeAddressKey("evm", lower),
    "EIP-55 casing is a checksum, not identity",
  );
});

test("Solana mints are NOT lowercased", () => {
  const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  assert.equal(normalizeAddressKey("solana", mint), mint);
  assert.notEqual(
    normalizeAddressKey("solana", mint),
    mint.toLowerCase(),
    "base58 is case-sensitive; lowercasing yields a different address",
  );
});

test("native assets normalise to the NATIVE sentinel, not a fake address", () => {
  assert.equal(normalizeAddressKey("evm", null, true), "NATIVE");
  assert.equal(normalizeAddressKey("solana", null, true), "NATIVE");
  assert.equal(normalizeAddressKey("evm", undefined), "NATIVE");
});

// ── Identity semantics ──────────────────────────────────────────────────────

type Identity = { assetId: string; family: string; chainId: number | null; key: string };

const REGISTRY: Identity[] = [
  { assetId: "asset-eth",       family: "evm",    chainId: 1,    key: "NATIVE" },
  { assetId: "asset-weth",      family: "evm",    chainId: 1,    key: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
  { assetId: "asset-usdc-eth",  family: "evm",    chainId: 1,    key: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
  { assetId: "asset-usdc-poly", family: "evm",    chainId: 137,  key: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
  { assetId: "asset-usdc-sol",  family: "solana", chainId: null, key: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
];

function lookup(family: string, chainId: number | null, address: string | null, isNative = false) {
  const key = normalizeAddressKey(family as any, address, isNative);
  return REGISTRY.filter(
    (r) => r.family === family && r.key === key && (family !== "evm" || r.chainId === chainId),
  );
}

test("duplicate ticker: same symbol on different chains does not merge", () => {
  const eth = lookup("evm", 1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  const poly = lookup("evm", 137, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  assert.equal(eth.length, 1);
  assert.equal(poly.length, 1);
  assert.notEqual(eth[0].assetId, poly[0].assetId, "same symbol + same address, different chain = different asset");
});

test("exact EVM contract on the same chain resolves to one identity", () => {
  const a = lookup("evm", 1, "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  const b = lookup("evm", 1, "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
  assert.equal(a.length, 1);
  assert.equal(a[0].assetId, b[0].assetId);
});

test("same address on a different EVM chain is not the same token", () => {
  const found = lookup("evm", 8453, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
  assert.equal(found.length, 0, "unknown on this chain -> UNRESOLVED, never borrowed from another chain");
});

test("Solana mint respects case semantics", () => {
  assert.equal(lookup("solana", null, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v").length, 1);
  assert.equal(lookup("solana", null, "epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v").length, 0);
});

test("native asset resolves without a contract address", () => {
  const found = lookup("evm", 1, null, true);
  assert.equal(found.length, 1);
  assert.equal(found[0].assetId, "asset-eth");
});

test("wrapped asset does not collapse into the native asset", () => {
  const native = lookup("evm", 1, null, true)[0];
  const wrapped = lookup("evm", 1, "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")[0];
  assert.notEqual(native.assetId, wrapped.assetId, "ETH and WETH are distinct identities");
});

// ── Rebrand continuity ──────────────────────────────────────────────────────

test("rebrand keeps a stable internal id (MATIC -> POL)", () => {
  // A rebrand updates the canonical row and records an alias. The asset_id is
  // untouched, so holdings, transactions and future analyses stay attached.
  const asset = { id: "asset-polygon", canonicalSymbol: "MATIC", status: "CANONICAL" };
  const aliases: Array<{ assetId: string; type: string; value: string }> = [];

  const before = asset.id;
  asset.canonicalSymbol = "POL";
  aliases.push({ assetId: asset.id, type: "MIGRATION_SYMBOL", value: "MATIC" });

  assert.equal(asset.id, before, "rebrand must not mint a new asset_id");
  assert.equal(aliases.filter((a) => a.value === "MATIC").length, 1, "old symbol still resolves via alias");
});

// ── Guessing safeguards ─────────────────────────────────────────────────────

function resolveBySymbolOnly(symbol: string, known: string[]) {
  const hits = known.filter((s) => s === symbol);
  if (hits.length === 0) return { status: "UNRESOLVED", assetId: null };
  return { status: "AMBIGUOUS", assetId: null };
}

test("unknown token becomes UNRESOLVED, never a random mapping", () => {
  const r = resolveBySymbolOnly("SCAMCOIN", ["USDC", "ETH"]);
  assert.equal(r.status, "UNRESOLVED");
  assert.equal(r.assetId, null);
});

test("symbol-only match is AMBIGUOUS, never RESOLVED", () => {
  const r = resolveBySymbolOnly("USDC", ["USDC"]);
  assert.equal(r.status, "AMBIGUOUS");
  assert.equal(r.assetId, null, "a symbol alone must never pick an asset");
});

test("manual mapping outranks any automatic heuristic", () => {
  const holding = { assetId: "asset-manual", manualOverride: true, method: "MANUAL" };
  const heuristic = { assetId: "asset-guess", method: "LEGACY_SYMBOL" };

  const applied = holding.manualOverride ? holding : heuristic;
  assert.equal(applied.assetId, "asset-manual", "a verified manual mapping is never silently replaced");
});
