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

  constructor(private incidents: CuratedIncident[] = CURATED_INCIDENTS) {}

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

    const observations: SecurityObservation[] = [
      {
        type: "KNOWN_CRITICAL_EXPLOIT",
        provenance: `${INCIDENT_REGISTRY_VERSION} (${this.incidents.length} entries)`,
        raw: {
          registryVersion: INCIDENT_REGISTRY_VERSION,
          matches: hits.map((h) => ({ title: h.title, occurredAt: h.occurredAt, reference: h.reference, unresolved: h.unresolved })),
          // Stated in the payload so a CLEAR is never read as stronger than it is.
          coverageCaveat: "manually curated registry; absence is not proof of absence",
        },
        // A historical incident stays a historical FACT. Only an UNRESOLVED one
        // asserts a present risk — this is the Event Fact vs Assessment split.
        normalized: hits.some((h) => h.unresolved && h.severity === "CRITICAL"),
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
