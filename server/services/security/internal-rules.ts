import { incidentCoverageFrom } from "@shared/security-rules";
import type {
  SecurityProvider, SecurityAssessmentInput, SecurityAssessmentResult,
  ProviderCapabilities, SecurityObservation,
} from "../security-provider";

// ─────────────────────────────────────────────────────────────────────────────
// InternalRulesAdapter — a manually curated, versioned incident registry.
//
// Why this exists: KNOWN_CRITICAL_EXPLOIT is a CORE capability, and no
// configured external provider answers it. Without a source for it, no asset
// could ever reach CLEAR, which would make the disposition unable to
// discriminate at all.
//
// HONEST LIMITATION — read this before trusting a CLEAR:
//   This registry is manually maintained and currently EMPTY. A "no incident"
//   result means "not present in OUR registry", NOT "no incident exists".
//   Its coverage is exactly what a human has entered. This limitation is
//   recorded as technical debt and is surfaced in the observation payload so a
//   consumer can weigh it rather than mistake it for a comprehensive feed.
// ─────────────────────────────────────────────────────────────────────────────

export const INCIDENT_REGISTRY_VERSION = "incident-registry-v1";

/**
 * Declared coverage scope. EMPTY means this registry claims authority over
 * nothing, so it can only ever answer COVERAGE_UNKNOWN.
 *
 * To assert VERIFIED_NO_KNOWN_CRITICAL_INCIDENT for an asset, that asset must
 * fall inside a declared scope AND the registry must be non-empty. Until a real
 * advisory source is integrated, this list stays empty deliberately — an empty
 * registry claiming "no incidents" is a false assurance, which is exactly the
 * failure this remediation removes.
 */
export interface CoverageScope {
  networkFamily: "evm" | "solana";
  chainId?: number;
  /** Human description of what the scope actually covers. */
  description: string;
}

export const DECLARED_COVERAGE_SCOPES: CoverageScope[] = [];

export interface CuratedIncident {
  networkFamily: "evm" | "solana";
  chainId?: number;
  /** Lowercased for EVM, exact-case for Solana — matching identity rules. */
  addressKey: string;
  title: string;
  occurredAt: string;
  severity: "CAUTION" | "CRITICAL";
  reference: string;
  /** Whether the issue is still live, as opposed to a historical fact. */
  unresolved: boolean;
}

/**
 * Empty by design at launch. Entries are added only with a verifiable public
 * reference — an unsourced entry would be exactly the kind of manufactured
 * evidence the architecture forbids.
 */
export const CURATED_INCIDENTS: CuratedIncident[] = [];

export class InternalRulesAdapter implements SecurityProvider {
  readonly providerKey = "internal-rules";

  constructor(
    private incidents: CuratedIncident[] = CURATED_INCIDENTS,
    private scopes: CoverageScope[] = DECLARED_COVERAGE_SCOPES,
  ) {}

  capabilities(): ProviderCapabilities {
    return {
      providerKey: this.providerKey,
      supportedFamilies: ["evm", "solana"],
      supportedChainIds: [],   // chain-agnostic lookup
      observationTypes: ["KNOWN_CRITICAL_EXPLOIT"],
      requiresApiKey: false,
      readOnly: true,
    };
  }

  // Applies to native assets too — a chain-level incident has no contract.
  supports(_i: SecurityAssessmentInput): boolean {
    return true;
  }

  async assess(i: SecurityAssessmentInput): Promise<SecurityAssessmentResult> {
    const started = Date.now();
    const key = i.networkFamily === "evm"
      ? (i.contractAddress ?? "NATIVE").toLowerCase()
      : (i.contractAddress ?? "NATIVE");

    const hits = this.incidents.filter(
      (x) => x.networkFamily === i.networkFamily &&
        (x.chainId === undefined || x.chainId === i.chainId) &&
        x.addressKey === key,
    );

    const assetInScope = this.scopes.some(
      (s) => s.networkFamily === i.networkFamily && (s.chainId === undefined || s.chainId === i.chainId),
    );

    const coverage = incidentCoverageFrom({
      registrySize: this.incidents.length,
      coverageScopeDeclared: this.scopes.length > 0,
      assetInScope,
      hasUnresolvedCritical: hits.some((h) => h.unresolved && h.severity === "CRITICAL"),
    });

    const observations: SecurityObservation[] = [
      {
        type: "KNOWN_CRITICAL_EXPLOIT",
        provenance: `${INCIDENT_REGISTRY_VERSION} (${this.incidents.length} entries, ${this.scopes.length} scopes)`,
        raw: {
          registryVersion: INCIDENT_REGISTRY_VERSION,
          coverage,
          // Historical facts are always reported, even when coverage is unknown.
          matches: hits.map((h) => ({ title: h.title, occurredAt: h.occurredAt, reference: h.reference, unresolved: h.unresolved })),
          coverageCaveat:
            coverage === "COVERAGE_UNKNOWN"
              ? "registry declares no authority over this asset; absence proves nothing"
              : "curated registry with declared scope",
        },
        // The coverage verdict IS the normalized value. COVERAGE_UNKNOWN is not
        // a completed check and therefore cannot contribute to CLEAR.
        // A resolved historical incident stays a fact but asserts no present risk.
        normalized: coverage,
        // The registry version IS the temporal anchor. Wall-clock time here
        // would make an unchanged registry look like a new fact on every read.
        observedAt: null,
      },
    ];

    return { providerKey: this.providerKey, status: "OK", observations, latencyMs: Date.now() - started };
  }

  async health() {
    return { healthy: true, detail: `${this.incidents.length} curated incidents` };
  }
}
