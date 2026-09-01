import type { EvidenceInput } from "./evidence";
import type { EvidenceCategory } from "@shared/evidence-rules";

// ─────────────────────────────────────────────────────────────────────────────
// SecurityProvider — provider-neutral contract.
//
// Two rules govern this file:
//
//   1. Security findings ARE evidence. A provider returns OBSERVATIONS which
//      are normalised into the Evidence Core. There is no security-only
//      datastore and no parallel source of truth.
//
//   2. A provider never returns a verdict the system treats as fact. Its own
//      opinion may be recorded as ONE piece of evidence among many; the Scam
//      Gate that weighs them is Phase 2 and does not exist yet.
//
// Nothing here is named after any vendor. Adding a provider must not require a
// migration.
// ─────────────────────────────────────────────────────────────────────────────

export type SecurityObservationType =
  | "HONEYPOT_INDICATOR"
  | "MINT_AUTHORITY"
  | "BLACKLIST_CAPABILITY"
  | "PROXY_UPGRADEABILITY"
  | "SELL_RESTRICTION"
  | "LIQUIDITY_LOCK"
  | "HOLDER_CONCENTRATION"
  | "DEPLOYER_RISK"
  | "OWNERSHIP_PRIVILEGE"
  | "CONTRACT_CODE_PRESENT"
  // Added in Phase 2. Solana's freeze authority has no EVM equivalent and is a
  // CORE check: a live freeze authority can render a holding untradeable.
  | "FREEZE_AUTHORITY"
  | "BUY_TAX"
  | "SELL_TAX"
  | "KNOWN_CRITICAL_EXPLOIT"
  | "TAX_PARAMETERS"
  | "CLONE_INDICATOR"
  | "PROVIDER_VERDICT";

export interface SecurityObservation {
  type: SecurityObservationType;
  /** The FACT itself, kept verbatim. This is what gets hashed. */
  raw: unknown;
  /**
   * Volatile provenance — block number, slot, registry version. Deliberately
   * OUTSIDE `raw` and therefore outside the hash: re-reading an unchanged
   * chain state at a later block is the same fact, and hashing the block
   * number would create a fresh row on every poll.
   */
  provenance?: string;
  /** Typed value where one exists (boolean flag, percentage, ...). */
  normalized?: unknown;
  unit?: string;
  observedAt?: Date | null;
}

/**
 * Minimum-necessary input. Deliberately carries NO portfolio data.
 *
 * A contract-security question needs a chain and an address. It does not need
 * the user's balance, portfolio value, identity, or unrelated wallets, and this
 * type makes sending them impossible rather than merely discouraged.
 */
export interface SecurityAssessmentInput {
  networkFamily: "evm" | "solana";
  chainId?: number | null;
  contractAddress: string;
}

export type ProviderStatus = "OK" | "UNSUPPORTED" | "TIMEOUT" | "RATE_LIMITED" | "ERROR" | "MALFORMED";

export interface SecurityAssessmentResult {
  providerKey: string;
  status: ProviderStatus;
  observations: SecurityObservation[];
  latencyMs: number;
  error?: string;
}

export interface ProviderCapabilities {
  providerKey: string;
  supportedFamilies: Array<"evm" | "solana">;
  supportedChainIds: number[];
  observationTypes: SecurityObservationType[];
  requiresApiKey: boolean;
  readOnly: true;   // a provider that is not read-only cannot be used here
}

export interface SecurityProvider {
  readonly providerKey: string;
  capabilities(): ProviderCapabilities;
  supports(input: SecurityAssessmentInput): boolean;
  assess(input: SecurityAssessmentInput): Promise<SecurityAssessmentResult>;
  health(): Promise<{ healthy: boolean; detail?: string }>;
}

/**
 * Normalises provider observations into Evidence inputs.
 *
 * `source` is `security:<providerKey>` so the store never gains a
 * vendor-specific column such as `palisade_score`.
 */
export function observationsToEvidence(
  result: SecurityAssessmentResult,
  assetId: string | null,
): EvidenceInput[] {
  const category: EvidenceCategory = "SECURITY";
  return result.observations.map((o) => ({
    assetId,
    category,
    evidenceType: o.type,
    sourceKey: `security:${result.providerKey}`,
    observedAt: o.observedAt ?? null,
    effectiveAt: null,
    rawValue: o.raw,
    normalizedValue: o.normalized,
    normalizedUnit: o.unit ?? null,
    normalizerVersion: "security-normalizer-v1",
    reliabilityBasis: o.provenance ?? null,
  }));
}

/**
 * A failed provider yields NO observations — never a clean bill of health.
 *
 * "We could not check" and "we checked and found nothing" are different facts.
 * Collapsing them is how a system reports an asset as safe when it never
 * examined it.
 */
export function failureReducesCoverage(result: SecurityAssessmentResult): boolean {
  return result.status !== "OK";
}

/** In-memory registry. Multiple providers may cover the same asset. */
export class SecurityProviderRegistry {
  private providers = new Map<string, SecurityProvider>();

  register(p: SecurityProvider): void {
    this.providers.set(p.providerKey, p);
  }

  get(key: string): SecurityProvider | undefined {
    return this.providers.get(key);
  }

  supporting(input: SecurityAssessmentInput): SecurityProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.supports(input));
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const securityProviderRegistry = new SecurityProviderRegistry();
