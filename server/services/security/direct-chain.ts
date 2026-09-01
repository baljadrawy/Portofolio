import type {
  SecurityProvider, SecurityAssessmentInput, SecurityAssessmentResult,
  ProviderCapabilities, SecurityObservation,
} from "../security-provider";
import {
  PROXY_SLOTS, detectProxy, isContractCode, isRenounced, addressFromSlot, slotIsSet,
} from "@shared/security-rules";

// ─────────────────────────────────────────────────────────────────────────────
// DirectChainAdapter — deterministic verification from chain state.
//
// Preferred over any provider opinion wherever it can answer, per the
// "deterministic verification first" rule. Uses public RPC endpoints: no API
// key, no terms-of-service constraint on storing what a public blockchain says.
//
// Read-only. It issues eth_getCode / eth_getStorageAt / eth_call and
// getAccountInfo. It never signs, never sends a transaction, never holds a key.
// ─────────────────────────────────────────────────────────────────────────────

const EVM_RPC: Record<number, string> = {
  1:     "https://ethereum-rpc.publicnode.com",
  56:    "https://bsc-rpc.publicnode.com",
  137:   "https://polygon-bor-rpc.publicnode.com",
  8453:  "https://base-rpc.publicnode.com",
  42161: "https://arbitrum-one-rpc.publicnode.com",
  10:    "https://optimism-rpc.publicnode.com",
  43114: "https://avalanche-c-chain-rpc.publicnode.com",
  100:   "https://gnosis-rpc.publicnode.com",
};

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const TIMEOUT_MS = 12_000;

async function rpc(url: string, method: string, params: unknown[]): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message ?? "rpc error");
    return json.result;
  } finally {
    clearTimeout(t);
  }
}

export class DirectChainAdapter implements SecurityProvider {
  readonly providerKey = "direct-chain";

  capabilities(): ProviderCapabilities {
    return {
      providerKey: this.providerKey,
      supportedFamilies: ["evm", "solana"],
      supportedChainIds: Object.keys(EVM_RPC).map(Number),
      observationTypes: [
        "CONTRACT_CODE_PRESENT", "PROXY_UPGRADEABILITY", "OWNERSHIP_PRIVILEGE",
        "MINT_AUTHORITY", "FREEZE_AUTHORITY",
      ],
      requiresApiKey: false,
      readOnly: true,
    };
  }

  supports(i: SecurityAssessmentInput): boolean {
    // A native asset has no contract to inspect. NOT_APPLICABLE, not a gap.
    if (!i.contractAddress || i.contractAddress === "NATIVE") return false;
    if (i.networkFamily === "solana") return true;
    return i.chainId != null && EVM_RPC[i.chainId] !== undefined;
  }

  async assess(i: SecurityAssessmentInput): Promise<SecurityAssessmentResult> {
    const started = Date.now();
    if (!this.supports(i)) {
      return { providerKey: this.providerKey, status: "UNSUPPORTED", observations: [], latencyMs: Date.now() - started };
    }
    try {
      const observations =
        i.networkFamily === "solana"
          ? await this.assessSolana(i.contractAddress)
          : await this.assessEvm(i.chainId!, i.contractAddress);
      return { providerKey: this.providerKey, status: "OK", observations, latencyMs: Date.now() - started };
    } catch (e: any) {
      const timeout = e?.name === "AbortError";
      return {
        providerKey: this.providerKey,
        status: timeout ? "TIMEOUT" : "ERROR",
        observations: [],
        latencyMs: Date.now() - started,
        error: timeout ? "timeout" : String(e?.message ?? e),
      };
    }
  }

  private async assessEvm(chainId: number, address: string): Promise<SecurityObservation[]> {
    const url = EVM_RPC[chainId];
    const out: SecurityObservation[] = [];

    // Chain state is read "as of a block". Using wall-clock time here would
    // make every re-read a different fact and break idempotent ingestion.
    const block = await rpc(url, "eth_getBlockByNumber", ["latest", false]).catch(() => null);
    const blockNumber = block?.number ?? null;


    const code = await rpc(url, "eth_getCode", [address, "latest"]);
    const isContract = isContractCode(code);
    out.push({
      type: "CONTRACT_CODE_PRESENT",
      raw: { codeLength: typeof code === "string" ? code.length : 0, prefix: typeof code === "string" ? code.slice(0, 8) : null },
      normalized: isContract,
      provenance: `evm block ${blockNumber}`,
      observedAt: null,
    });

    // A non-contract address cannot have proxy slots or an owner.
    if (!isContract) return out;

    const [eip1967, zeppelin, admin] = await Promise.all([
      rpc(url, "eth_getStorageAt", [address, PROXY_SLOTS.EIP1967_IMPLEMENTATION, "latest"]).catch(() => null),
      rpc(url, "eth_getStorageAt", [address, PROXY_SLOTS.ZEPPELINOS_IMPLEMENTATION, "latest"]).catch(() => null),
      rpc(url, "eth_getStorageAt", [address, PROXY_SLOTS.EIP1967_ADMIN, "latest"]).catch(() => null),
    ]);

    const proxy = detectProxy({ eip1967: eip1967 ?? undefined, zeppelin: zeppelin ?? undefined });
    out.push({
      type: "PROXY_UPGRADEABILITY",
      // Recorded honestly: a false here means "no KNOWN pattern matched".
      raw: { eip1967, zeppelin, patternsChecked: ["EIP-1967", "zeppelinos"] },
      normalized: proxy.isProxy,
      provenance: `evm block ${blockNumber}`,
      observedAt: null,
    });

    if (slotIsSet(admin)) {
      out.push({
        type: "OWNERSHIP_PRIVILEGE",
        raw: { source: "EIP-1967 admin slot", value: admin },
        normalized: addressFromSlot(admin!),
        provenance: `evm block ${blockNumber}`,
        observedAt: null,
      });
    } else {
      // owner() — absent on many legitimate contracts; absence is not a finding.
      const owner = await rpc(url, "eth_call", [{ to: address, data: "0x8da5cb5b" }, "latest"]).catch(() => null);
      if (owner && owner.length > 2) {
        const addr = addressFromSlot(owner);
        out.push({
          type: "OWNERSHIP_PRIVILEGE",
          raw: { source: "owner()", value: owner },
          normalized: isRenounced(addr) ? "RENOUNCED" : addr,
          provenance: `evm block ${blockNumber}`,
          observedAt: null,
        });
      }
    }
    return out;
  }

  private async assessSolana(mint: string): Promise<SecurityObservation[]> {
    // Mint address is base58 and case-sensitive — passed through unchanged.
    const res = await rpc(SOLANA_RPC, "getAccountInfo", [mint, { encoding: "jsonParsed" }]);
    const value = res?.value;
    if (!value) return [];

    // Slot is the Solana analogue of a block: the state is true AS OF this slot.
    const slot = res?.context?.slot ?? null;

    const info = value?.data?.parsed?.info ?? {};
    return [
      {
        type: "MINT_AUTHORITY",
        raw: { mintAuthority: info.mintAuthority ?? null, owner: value.owner },
        // null authority means minting is permanently disabled.
        normalized: info.mintAuthority ?? null,
        provenance: `solana slot ${slot}`,
        observedAt: null,
      },
      {
        type: "FREEZE_AUTHORITY",
        raw: { freezeAuthority: info.freezeAuthority ?? null },
        normalized: info.freezeAuthority ?? null,
        provenance: `solana slot ${slot}`,
        observedAt: null,
      },
    ];
  }

  async health(): Promise<{ healthy: boolean; detail?: string }> {
    try {
      await rpc(EVM_RPC[1], "eth_blockNumber", []);
      return { healthy: true };
    } catch (e: any) {
      return { healthy: false, detail: String(e?.message ?? e) };
    }
  }
}
