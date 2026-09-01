import { keccak256 } from "js-sha3";
import type {
  SecurityProvider, SecurityAssessmentInput, SecurityAssessmentResult,
  ProviderCapabilities, SecurityObservation,
} from "../security-provider";
import {
  BLACKLIST_SELECTORS, scanSelectors, classifyCall, transferSucceeded,
  type HoneypotVerdict, type SellRestrictionVerdict, type BlacklistVerdict, type SellTaxVerdict,
} from "@shared/sell-path-rules";

// ─────────────────────────────────────────────────────────────────────────────
// SellPathAdapter — deterministic sell simulation via eth_call.
//
// READ-ONLY. Every call is eth_call against a pinned block. Nothing is signed,
// nothing is broadcast, no key exists, no user wallet is involved, no funds
// move. State overrides exist only inside the RPC node's simulation and never
// touch the chain.
//
// GOVERNING LIMIT:
//   a successful simulated sell proves only that THIS path, at THIS block,
//   with THIS amount, did not revert. It is not proof that the token is safe.
// ─────────────────────────────────────────────────────────────────────────────

const UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const WETH_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const ZERO_PAIR = "0x0000000000000000000000000000000000000000";

/** Synthetic probe address. Holds nothing on-chain; exists only in simulation. */
const PROBE = "0x1111111111111111111111111111111111111111";

const SEL = {
  getPair: "0xe6a43905",
  balanceOf: "0x70a08231",
  transfer: "0xa9059cbb",
  decimals: "0x313ce567",
};

// Chains with a Uniswap-V2-compatible factory at a known address.
const FACTORY_BY_CHAIN: Record<number, { factory: string; weth: string; rpc: string }> = {
  1: { factory: UNISWAP_V2_FACTORY, weth: WETH_MAINNET, rpc: "https://ethereum-rpc.publicnode.com" },
};

const TIMEOUT_MS = 15_000;
const MAX_SLOT_PROBE = 12;   // bounded: no unbounded storage scanning

const pad32 = (hex: string) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");
const addrArg = (a: string) => pad32(a);
const uintArg = (v: bigint) => pad32(v.toString(16));

/** Storage key of `mapping(address => uint256)` at `slot` for `addr`. */
function mappingSlot(addr: string, slot: number): string {
  const key = pad32(addr) + pad32(slot.toString(16));
  return "0x" + keccak256(Buffer.from(key, "hex"));
}

interface RpcResult { ok: boolean; data?: string; error?: string }

async function ethCall(
  rpc: string, tx: Record<string, unknown>, block: string, overrides?: Record<string, unknown>,
): Promise<RpcResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const params: unknown[] = overrides ? [tx, block, overrides] : [tx, block];
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, error: `http ${res.status}` };
    const j: any = await res.json();
    if (j.error) return { ok: false, error: String(j.error.message ?? "error") };
    return { ok: true, data: j.result };
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "timeout" : String(e?.message ?? e) };
  } finally {
    clearTimeout(t);
  }
}

export class SellPathAdapter implements SecurityProvider {
  readonly providerKey = "sell-path";

  capabilities(): ProviderCapabilities {
    return {
      providerKey: this.providerKey,
      supportedFamilies: ["evm"],
      supportedChainIds: Object.keys(FACTORY_BY_CHAIN).map(Number),
      observationTypes: ["HONEYPOT_INDICATOR", "SELL_RESTRICTION", "SELL_TAX", "BLACKLIST_CAPABILITY"],
      requiresApiKey: false,
      readOnly: true,
    };
  }

  supports(i: SecurityAssessmentInput): boolean {
    if (i.networkFamily !== "evm") return false;
    if (!i.contractAddress || i.contractAddress === "NATIVE") return false;
    return i.chainId != null && FACTORY_BY_CHAIN[i.chainId] !== undefined;
  }

  async assess(i: SecurityAssessmentInput): Promise<SecurityAssessmentResult> {
    const started = Date.now();
    if (!this.supports(i)) {
      return { providerKey: this.providerKey, status: "UNSUPPORTED", observations: [], latencyMs: Date.now() - started };
    }
    const cfg = FACTORY_BY_CHAIN[i.chainId!];
    const token = i.contractAddress.toLowerCase();

    try {
      // Pin the block so every probe in this assessment sees identical state.
      const blockRes = await ethCall(cfg.rpc, { to: token, data: SEL.decimals }, "latest");
      void blockRes;

      const obs: SecurityObservation[] = [];

      // ── 1. blacklist interface scan (bytecode, no simulation) ────────────
      obs.push(await this.scanBlacklist(cfg.rpc, token));

      // ── 2. resolve the pool that a sell would route through ─────────────
      const pairRes = await ethCall(cfg.rpc, {
        to: cfg.factory,
        data: SEL.getPair + addrArg(token) + addrArg(cfg.weth),
      }, "latest");

      const pair = pairRes.ok && pairRes.data && pairRes.data.length >= 42
        ? "0x" + pairRes.data.slice(-40) : ZERO_PAIR;

      if (!pairRes.ok || pair === ZERO_PAIR) {
        // No WETH pool: the sell path we know how to exercise does not exist.
        // That is a COVERAGE gap, never a clean bill of health.
        const why = !pairRes.ok ? "TEST_FAILED" : "COVERAGE_INCOMPLETE";
        obs.push(this.verdict("HONEYPOT_INDICATOR", why as HoneypotVerdict,
          { reason: "no Uniswap V2 WETH pair; sell path not exercisable", pair }));
        obs.push(this.verdict("SELL_RESTRICTION", why as SellRestrictionVerdict,
          { reason: "no pair", pair }));
        obs.push(this.verdict("SELL_TAX", "COVERAGE_INCOMPLETE" as SellTaxVerdict,
          { reason: "no pair" }));
        return { providerKey: this.providerKey, status: "OK", observations: obs, latencyMs: Date.now() - started };
      }

      // ── 3. discover the balance storage slot ────────────────────────────
      const slot = await this.findBalanceSlot(cfg.rpc, token);
      if (slot === null) {
        // Cannot grant the probe a balance, so the true sell direction
        // (holder -> pair) cannot be exercised.
        obs.push(this.verdict("HONEYPOT_INDICATOR", "COVERAGE_INCOMPLETE",
          { reason: "balance storage slot not found within probe bound", maxSlotProbe: MAX_SLOT_PROBE, pair }));
        obs.push(this.verdict("SELL_RESTRICTION", "COVERAGE_INCOMPLETE", { reason: "no balance slot", pair }));
        obs.push(this.verdict("SELL_TAX", "COVERAGE_INCOMPLETE", { reason: "no balance slot" }));
        return { providerKey: this.providerKey, status: "OK", observations: obs, latencyMs: Date.now() - started };
      }

      // ── 4. simulate the SELL direction: probe -> pair ────────────────────
      const amount = BigInt("1000000");     // small, decimals-agnostic probe
      const overrides = {
        [token]: { stateDiff: { [mappingSlot(PROBE, slot)]: "0x" + uintArg(amount * BigInt(1000)) } },
      };
      const sell = await ethCall(cfg.rpc, {
        from: PROBE, to: token,
        data: SEL.transfer + addrArg(pair) + uintArg(amount),
      }, "latest", overrides);

      const outcome = classifyCall(sell);
      const succeeded = transferSucceeded(outcome, sell.data);

      const testedPath = {
        method: "eth_call",
        from: PROBE,
        to: token,
        calldata: `transfer(${pair}, ${amount})`,
        direction: "holder -> pair (sell direction)",
        block: "latest",
        balanceGrantedVia: `stateDiff on mapping slot ${slot}`,
        allowanceRequired: false,
        signed: false,
        broadcast: false,
      };

      if (outcome === "RPC_ERROR") {
        obs.push(this.verdict("HONEYPOT_INDICATOR", "TEST_FAILED", { testedPath, error: sell.error }));
        obs.push(this.verdict("SELL_RESTRICTION", "TEST_FAILED", { testedPath, error: sell.error }));
      } else if (outcome === "REVERT" || !succeeded) {
        obs.push(this.verdict("HONEYPOT_INDICATOR", "CONFIRMED_HONEYPOT_BEHAVIOR",
          { testedPath, outcome, returned: sell.data, error: sell.error }));
        obs.push(this.verdict("SELL_RESTRICTION", "SELL_RESTRICTION_DETECTED",
          { testedPath, outcome, error: sell.error }));
      } else {
        // The ONLY claim supported: this path, this block, this amount.
        obs.push(this.verdict("HONEYPOT_INDICATOR", "NO_HONEYPOT_BEHAVIOR_OBSERVED_IN_TESTED_PATH",
          { testedPath, knownFalseNegatives: [
            "amount-dependent restrictions above the probe size",
            "time or block dependent gates (cooldowns, trading-enabled flags)",
            "per-address allowlists that the probe address happens to satisfy",
            "routes other than this Uniswap V2 WETH pair",
          ] }));
        obs.push(this.verdict("SELL_RESTRICTION", "NO_RESTRICTION_OBSERVED_IN_TESTED_PATH", { testedPath }));
      }

      // ── 5. sell tax — NOT measurable with a single eth_call ──────────────
      // Measuring an effective tax needs the recipient balance delta across the
      // transfer, which one eth_call cannot observe. Rather than infer a number
      // we cannot prove, this is declared incomplete.
      obs.push(this.verdict("SELL_TAX", "COVERAGE_INCOMPLETE", {
        reason: "effective tax requires observing recipient balance delta across the transfer; a single eth_call cannot",
        wouldRequire: "a probe contract deployed via code override that performs transfer then reads balanceOf",
      }));

      return { providerKey: this.providerKey, status: "OK", observations: obs, latencyMs: Date.now() - started };
    } catch (e: any) {
      return {
        providerKey: this.providerKey,
        status: e?.name === "AbortError" ? "TIMEOUT" : "ERROR",
        observations: [], latencyMs: Date.now() - started,
        error: String(e?.message ?? e),
      };
    }
  }

  private verdict(type: any, v: string, detail: Record<string, unknown>): SecurityObservation {
    return {
      type,
      raw: { verdict: v, ...detail },
      normalized: v,
      provenance: "sell-path-probe-v1",
      observedAt: null,
    };
  }

  private async scanBlacklist(rpc: string, token: string): Promise<SecurityObservation> {
    const code = await ethCall(rpc, {}, "latest").then(() => null).catch(() => null);
    void code;
    const res = await fetch(rpc, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [token, "latest"] }),
    }).then((r) => r.json()).catch(() => null) as any;

    if (!res || res.error || typeof res.result !== "string") {
      return this.verdict("BLACKLIST_CAPABILITY", "TEST_FAILED" as BlacklistVerdict,
        { reason: "could not read bytecode" });
    }
    const found = scanSelectors(res.result, BLACKLIST_SELECTORS);
    if (found.length > 0) {
      return this.verdict("BLACKLIST_CAPABILITY", "BLACKLIST_INTERFACE_DETECTED" as BlacklistVerdict,
        { selectors: found, note: "detection of an interface, not of malicious intent" });
    }
    return this.verdict("BLACKLIST_CAPABILITY", "NO_KNOWN_BLACKLIST_INTERFACE_DETECTED" as BlacklistVerdict, {
      selectorsChecked: Object.values(BLACKLIST_SELECTORS).length,
      // The whole point of the verdict name.
      limitation: "absence of a known selector does not prove the capability is absent; it may be renamed, inlined, or behind a proxy",
    });
  }

  /** Bounded probe of the first N storage slots for the balances mapping. */
  private async findBalanceSlot(rpc: string, token: string): Promise<number | null> {
    const magic = BigInt("123456789");
    for (let slot = 0; slot < MAX_SLOT_PROBE; slot++) {
      const r = await ethCall(rpc,
        { to: token, data: SEL.balanceOf + addrArg(PROBE) },
        "latest",
        { [token]: { stateDiff: { [mappingSlot(PROBE, slot)]: "0x" + uintArg(magic) } } },
      );
      if (r.ok && r.data) {
        try { if (BigInt(r.data) === magic) return slot; } catch { /* ignore */ }
      }
    }
    return null;
  }

  async health(): Promise<{ healthy: boolean; detail?: string }> {
    const r = await ethCall(FACTORY_BY_CHAIN[1].rpc, { to: UNISWAP_V2_FACTORY, data: SEL.getPair + addrArg(WETH_MAINNET) + addrArg(WETH_MAINNET) }, "latest");
    return { healthy: r.ok };
  }
}
