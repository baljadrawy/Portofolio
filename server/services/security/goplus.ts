import type {
  SecurityProvider, SecurityAssessmentInput, SecurityAssessmentResult,
  ProviderCapabilities, SecurityObservation,
} from "../security-provider";

// ─────────────────────────────────────────────────────────────────────────────
// GoPlus Token Security adapter.
//
// LICENSE OBLIGATIONS (verified 2026-09-01 against the published API License
// Agreement — see docs/13-DATA-GOVERNANCE.md):
//
//   ATTRIBUTION IS MANDATORY. §3: "Your Application should source attribution
//   via a backlink or a mention that Your Application is 'Powered by Go+
//   Security'." §5 also requires displaying the GoPlus mark.
//
//   COMMERCIAL USE IS RESTRICTED. §6: "You shall not directly use our original
//   data to conduct any commercial activities and generate revenue without
//   Goplus's explicit written permission."
//
// The constant below is exported so any surface rendering this provider's
// evidence can satisfy the attribution requirement, and so the obligation is
// visible in code rather than buried in a document.
// ─────────────────────────────────────────────────────────────────────────────

export const GOPLUS_ATTRIBUTION = "Powered by Go+ Security";
export const GOPLUS_COMMERCIAL_USE = "RESTRICTED — written permission required";

const BASE = "https://api.gopluslabs.io/api/v1/token_security";
const TIMEOUT_MS = 15_000;

// Chains GoPlus documents for token_security. Not every chain we track.
const SUPPORTED_CHAIN_IDS = [1, 56, 137, 8453, 42161, 10, 43114, 250, 25, 128, 100, 324, 59144, 5000, 534352];

export class GoPlusAdapter implements SecurityProvider {
  readonly providerKey = "goplus";

  capabilities(): ProviderCapabilities {
    return {
      providerKey: this.providerKey,
      supportedFamilies: ["evm"],
      supportedChainIds: SUPPORTED_CHAIN_IDS,
      observationTypes: [
        "HONEYPOT_INDICATOR", "SELL_RESTRICTION", "BUY_TAX", "SELL_TAX",
        "MINT_AUTHORITY", "BLACKLIST_CAPABILITY", "PROXY_UPGRADEABILITY",
        "OWNERSHIP_PRIVILEGE", "HOLDER_CONCENTRATION", "CONTRACT_VERIFIED",
      ],
      requiresApiKey: false,
      readOnly: true,
    };
  }

  supports(i: SecurityAssessmentInput): boolean {
    if (i.networkFamily !== "evm") return false;
    if (!i.contractAddress || i.contractAddress === "NATIVE") return false;
    return i.chainId != null && SUPPORTED_CHAIN_IDS.includes(i.chainId);
  }

  async assess(i: SecurityAssessmentInput): Promise<SecurityAssessmentResult> {
    const started = Date.now();
    if (!this.supports(i)) {
      return { providerKey: this.providerKey, status: "UNSUPPORTED", observations: [], latencyMs: Date.now() - started };
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      // Only chain id and contract address leave this process. No balance,
      // no portfolio value, no identity.
      const url = `${BASE}/${i.chainId}?contract_addresses=${encodeURIComponent(i.contractAddress.toLowerCase())}`;
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });

      if (res.status === 429) {
        return { providerKey: this.providerKey, status: "RATE_LIMITED", observations: [], latencyMs: Date.now() - started, error: "429" };
      }
      if (res.status >= 500) {
        return { providerKey: this.providerKey, status: "ERROR", observations: [], latencyMs: Date.now() - started, error: `HTTP ${res.status}` };
      }
      if (!res.ok) {
        return { providerKey: this.providerKey, status: "ERROR", observations: [], latencyMs: Date.now() - started, error: `HTTP ${res.status}` };
      }

      const json: any = await res.json().catch(() => null);
      if (!json || typeof json !== "object" || json.code !== 1) {
        return { providerKey: this.providerKey, status: "MALFORMED", observations: [], latencyMs: Date.now() - started, error: json?.message ?? "unexpected body" };
      }

      const key = Object.keys(json.result ?? {})[0];
      const r = key ? json.result[key] : null;
      // A recognised-but-empty result means "no data for this token", which is
      // NOT a clean bill of health.
      if (!r) {
        return { providerKey: this.providerKey, status: "OK", observations: [], latencyMs: Date.now() - started };
      }

      return {
        providerKey: this.providerKey,
        status: "OK",
        observations: this.normalize(r),
        latencyMs: Date.now() - started,
      };
    } catch (e: any) {
      const timeout = e?.name === "AbortError";
      return {
        providerKey: this.providerKey,
        status: timeout ? "TIMEOUT" : "ERROR",
        observations: [],
        latencyMs: Date.now() - started,
        error: timeout ? "timeout" : String(e?.message ?? e),
      };
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * GoPlus returns "0" / "1" strings, and OMITS a field when it has no answer.
   * A missing field must stay missing — coercing it to false would turn "we do
   * not know" into "it is safe", which is the exact failure this layer exists
   * to prevent.
   */
  private normalize(r: Record<string, any>): SecurityObservation[] {
    const out: SecurityObservation[] = [];
    // GoPlus provides no observation timestamp, so observedAt is left null
    // rather than invented. Freshness will read UNKNOWN, which is correct.
    const flag = (field: string, type: any) => {
      if (r[field] === undefined || r[field] === null || r[field] === "") return;
      out.push({ type, raw: { [field]: r[field] }, normalized: r[field] === "1", observedAt: null });
    };
    const num = (field: string, type: any, unit: string) => {
      if (r[field] === undefined || r[field] === null || r[field] === "") return;
      const v = Number(r[field]);
      if (Number.isNaN(v)) return;
      out.push({ type, raw: { [field]: r[field] }, normalized: v, unit, observedAt: null });
    };

    flag("is_honeypot", "HONEYPOT_INDICATOR");
    flag("cannot_sell_all", "SELL_RESTRICTION");
    flag("is_mintable", "MINT_AUTHORITY");
    flag("is_blacklisted", "BLACKLIST_CAPABILITY");
    flag("is_proxy", "PROXY_UPGRADEABILITY");
    flag("can_take_back_ownership", "OWNERSHIP_PRIVILEGE");
    flag("is_open_source", "CONTRACT_VERIFIED");
    num("buy_tax", "BUY_TAX", "RATIO");
    num("sell_tax", "SELL_TAX", "RATIO");
    num("holder_count", "HOLDER_CONCENTRATION", "COUNT");
    return out;
  }

  async health(): Promise<{ healthy: boolean; detail?: string }> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(`${BASE}/1?contract_addresses=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`, { signal: ctrl.signal });
      clearTimeout(t);
      return { healthy: res.ok };
    } catch (e: any) {
      return { healthy: false, detail: String(e?.message ?? e) };
    }
  }
}
