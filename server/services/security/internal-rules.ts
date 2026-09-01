import type { IncidentIntelligenceStatus } from "@shared/security-rules";
import type {
  SecurityProvider, SecurityAssessmentInput, SecurityAssessmentResult,
  ProviderCapabilities, SecurityObservation,
} from "../security-provider";

// ─────────────────────────────────────────────────────────────────────────────
// InternalRulesAdapter — supplemental curated incident evidence.
//
// ROLE, corrected in Phase 2E: this is a source of POSITIVE incident findings
// only. It is not a proof-of-absence provider and it no longer gates CLEAR.
//
// The asymmetry is the whole design. If a curated entry matches the asset,
// that is a real observation and it can veto CLEAR. If nothing matches, the
// adapter emits NOTHING — not an observation saying "clean", not a coverage
// verdict, not a zero. There is no observation to make, because a human not
// having written something down is not a fact about the token.
//
// Before Phase 2E this adapter answered a mandatory CORE capability, so its
// silence had to be encoded as COVERAGE_UNKNOWN and that value then blocked
// CLEAR for every asset forever. Phase 2D established why no source can fix
// that: exhaustive negative incident coverage is an open-world problem. The
// requirement moved to Phase 3 (TD-40); it was not dropped.
// ─────────────────────────────────────────────────────────────────────────────

export const INCIDENT_REGISTRY_VERSION = "incident-registry-v1";

/**
 * Retained for provenance and for Phase 3, which will attach real source
 * scopes. It no longer gates anything: after Phase 2E an empty scope list
 * cannot produce a negative assurance, because no code path produces one.
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
    // EVM address keys are case-insensitive; Solana mints are not. Lowercasing
    // a base58 mint would silently stop it matching itself.
    const key = i.networkFamily === "evm"
      ? (i.contractAddress ?? "NATIVE").toLowerCase()
      : (i.contractAddress ?? "NATIVE");

    const hits = this.incidents.filter(
      (x) => x.networkFamily === i.networkFamily &&
        (x.chainId === undefined || x.chainId === i.chainId) &&
        x.addressKey === key,
    );

    // No match → no observation. This is the Phase 2E correction in one line:
    // an empty result set produces silence, not a claim of cleanliness.
    if (hits.length === 0) {
      return { providerKey: this.providerKey, status: "OK", observations: [], latencyMs: Date.now() - started };
    }

    const unresolvedCritical = hits.some((h) => h.unresolved && h.severity === "CRITICAL");
    const status: IncidentIntelligenceStatus = unresolvedCritical
      ? "ACTIVE_CRITICAL_INCIDENT_FOUND"
      : "NO_ACTIVE_CRITICAL_INCIDENT_FOUND_IN_QUERIED_SOURCES";

    const observations: SecurityObservation[] = [
      {
        type: "KNOWN_CRITICAL_EXPLOIT",
        provenance: `${INCIDENT_REGISTRY_VERSION} (${this.incidents.length} entries, ${this.scopes.length} scopes)`,
        raw: {
          registryVersion: INCIDENT_REGISTRY_VERSION,
          status,
          // Historical facts are reported whether or not they are still live.
          // An incident does not stop having happened once it is remediated.
          matches: hits.map((h) => ({
            title: h.title, occurredAt: h.occurredAt, reference: h.reference,
            severity: h.severity, unresolved: h.unresolved,
          })),
          note: unresolvedCritical
            ? "unresolved critical incident on record for this asset"
            : "incident on record; not currently assessed as an unresolved critical",
        },
        normalized: status,
        // The registry version IS the temporal anchor. Wall-clock time here
        // would make an unchanged registry look like a new fact on every read.
        observedAt: null,
      },
    ];

    return { providerKey: this.providerKey, status: "OK", observations, latencyMs: Date.now() - started };
  }

  async health() {
    return { healthy: true, detail: `${this.incidents.length} curated incidents (supplemental, positive findings only)` };
  }
}
