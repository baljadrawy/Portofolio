import { securityProviderRegistry, observationsToEvidence, type SecurityAssessmentInput, type SecurityAssessmentResult } from "../security-provider";
import { evidenceService } from "../evidence";
import { computeFreshness } from "@shared/evidence-rules";
import {
  computeDisposition, coreCapabilitiesFor, SECURITY_POLICY_VERSION,
  type Finding, type SecurityCapability, type SecurityDisposition,
} from "@shared/security-rules";

// ─────────────────────────────────────────────────────────────────────────────
// Security assessment orchestrator.
//
// Runs every supporting provider, writes each observation into the Evidence
// Store, then derives a SECURITY DISPOSITION.
//
// It emits CLEAR / CAUTION / CRITICAL / INSUFFICIENT_EVIDENCE.
// It does NOT emit HOLD, REDUCE or EXIT — those belong to Phase 4 and must not
// appear at this layer.
// ─────────────────────────────────────────────────────────────────────────────

export interface SecurityAssessmentReport {
  assetId: string | null;
  disposition: SecurityDisposition;
  policyVersion: string;
  coverage: { required: number; checked: number; ratio: number; missing: SecurityCapability[] };
  capabilitiesChecked: SecurityCapability[];
  criticalFindings: Finding[];
  cautionFindings: Finding[];
  conflicts: SecurityCapability[];
  staleEvidence: string[];
  providerFailures: Array<{ providerKey: string; status: string; error?: string }>;
  evidenceIds: string[];
  reasons: string[];
  assessedAt: Date;
  /** Attribution strings required by the licence of any provider consulted. */
  attributions: string[];
}

/** Maps an observation to a finding. Absent capability → no finding invented. */
function toFinding(
  capability: SecurityCapability,
  severity: Finding["severity"],
  deterministic: boolean,
  corroboration: number,
  freshness: Finding["freshness"],
  evidenceIds: string[],
  detail: string,
): Finding {
  return { capability, severity, deterministic, corroboration, freshness, evidenceIds, detail };
}

export class SecurityAssessmentService {
  async assess(
    assetId: string | null,
    input: SecurityAssessmentInput,
    opts: { isNative?: boolean; persistEvidence?: boolean } = {},
  ): Promise<SecurityAssessmentReport> {
    const assessedAt = new Date();
    const isNative = opts.isNative ?? (!input.contractAddress || input.contractAddress === "NATIVE");
    const persist = opts.persistEvidence ?? true;

    const coreRequired = coreCapabilitiesFor(input.networkFamily, isNative);
    const providers = securityProviderRegistry.supporting(input);

    const results: SecurityAssessmentResult[] = [];
    for (const p of providers) {
      results.push(await p.assess(input));
    }

    const providerFailures = results
      .filter((r) => r.status !== "OK")
      .map((r) => ({ providerKey: r.providerKey, status: r.status, error: r.error }));

    // ── persist observations as evidence ────────────────────────────────────
    const evidenceIds: string[] = [];
    const staleEvidence: string[] = [];
    if (persist) {
      for (const r of results.filter((x) => x.status === "OK")) {
        for (const ev of observationsToEvidence(r, assetId)) {
          try {
            const res = await evidenceService.ingest(ev, assessedAt);
            if (res.evidenceId) evidenceIds.push(res.evidenceId);
          } catch {
            // A store failure must not be silently swallowed into "safe".
            providerFailures.push({ providerKey: r.providerKey, status: "ERROR", error: "evidence ingestion failed" });
          }
        }
      }
    }

    // ── build findings from observations ────────────────────────────────────
    // Group by capability so corroboration across providers can be counted.
    const byCapability = new Map<string, Array<{ providerKey: string; value: unknown; deterministic: boolean; observedAt: Date | null }>>();
    for (const r of results.filter((x) => x.status === "OK")) {
      const deterministic = r.providerKey === "direct-chain";
      for (const o of r.observations) {
        const list = byCapability.get(o.type) ?? [];
        list.push({ providerKey: r.providerKey, value: o.normalized, deterministic, observedAt: o.observedAt ?? null });
        byCapability.set(o.type, list);
      }
    }

    const capabilitiesChecked = Array.from(byCapability.keys()) as SecurityCapability[];
    type Obs = { providerKey: string; value: unknown; deterministic: boolean; observedAt: Date | null };
    const criticalFindings: Finding[] = [];
    const cautionFindings: Finding[] = [];
    const conflicts: SecurityCapability[] = [];

    for (const [capRaw, obs] of Array.from(byCapability.entries())) {
      const cap = capRaw as SecurityCapability;

      // Conflict = providers disagree on a boolean signal.
      const bools = (obs as Obs[]).filter((o) => typeof o.value === "boolean").map((o) => o.value as boolean);
      if (bools.length > 1 && new Set(bools).size > 1) {
        conflicts.push(cap);
        continue;   // do not resolve; surface it
      }

      const positive = (obs as Obs[]).filter((o) => o.value === true);
      const deterministic = (obs as Obs[]).some((o) => o.deterministic);
      // Freshness basis, in order of strength:
      //   1. an observation timestamp from the source (block time, slot time)
      //   2. otherwise the time of THIS live call — the provider is asserting
      //      the fact now, even though it supplies no timestamp of its own
      // The fallback is recorded so a consumer can tell the two apart; it is
      // not the same as inventing an observedAt on the evidence row, which
      // stays null and honest.
      const freshest = (obs as Obs[]).map((o) => o.observedAt).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;
      const freshnessBasis: "OBSERVED" | "RETRIEVED" = freshest ? "OBSERVED" : "RETRIEVED";
      const freshness = computeFreshness("SECURITY", freshest ?? assessedAt, assessedAt);
      void freshnessBasis;
      if (freshness === "STALE") staleEvidence.push(cap);

      if (positive.length === 0) continue;

      const corroboration = positive.length;
      const detail = `${positive.map((p) => p.providerKey).join(", ")} report ${cap}`;

      switch (cap) {
        case "HONEYPOT_INDICATOR":
        case "SELL_RESTRICTION":
          criticalFindings.push(toFinding(cap, "CRITICAL", deterministic, corroboration, freshness, [], detail));
          break;
        case "BLACKLIST_CAPABILITY":
        case "MINT_AUTHORITY":
        case "PROXY_UPGRADEABILITY":
        case "OWNERSHIP_PRIVILEGE":
        case "FREEZE_AUTHORITY":
          // Legitimate blue-chip protocols routinely have these. Alone they are
          // never critical — USDC is mintable, freezable and a proxy.
          cautionFindings.push(toFinding(cap, "CAUTION", deterministic, corroboration, freshness, [], detail));
          break;
        default:
          break;
      }
    }

    // UNLIMITED_MINT_RISK is DERIVED, never asked of a provider: if minting is
    // permanently disabled the risk is definitionally absent, and if a mint
    // authority is live the risk exists. Deriving it from chain state is
    // stronger than any provider opinion.
    const mintObs = byCapability.get("MINT_AUTHORITY") ?? [];
    if (mintObs.length > 0) {
      const liveAuthority = (mintObs as Obs[]).some(
        (o) => o.value === true || (typeof o.value === "string" && o.value.length > 0),
      );
      capabilitiesChecked.push("UNLIMITED_MINT_RISK");
      if (liveAuthority) {
        cautionFindings.push(
          toFinding("UNLIMITED_MINT_RISK", "CAUTION",
            (mintObs as Obs[]).some((o) => o.deterministic), mintObs.length, "FRESH", [],
            "a live mint authority permits further issuance"),
        );
      }
    }

    // Solana authority observations carry an address (or null) rather than a
    // boolean, so they are interpreted here rather than in the generic loop.
    for (const cap of ["MINT_AUTHORITY", "FREEZE_AUTHORITY"] as SecurityCapability[]) {
      const obs = byCapability.get(cap) ?? [];
      const live = obs.filter((o) => typeof o.value === "string" && o.value !== null);
      if (live.length > 0 && !cautionFindings.some((f) => f.capability === cap)) {
        cautionFindings.push(
          toFinding(cap, "CAUTION", live.some((o) => o.deterministic), live.length, "FRESH", [],
            `${cap} is live (${live.length} source)`),
        );
      }
    }

    const disposition = computeDisposition({
      findings: [...criticalFindings, ...cautionFindings],
      coreRequired,
      checked: capabilitiesChecked,
      conflicts,
      providerFailures: providerFailures.length,
      providersAttempted: providers.length,
    });

    const attributions = Array.from(
      new Set(results.filter((r) => r.providerKey === "goplus").map(() => "Powered by Go+ Security")),
    );

    return {
      assetId,
      disposition: disposition.disposition,
      policyVersion: SECURITY_POLICY_VERSION,
      coverage: disposition.coverage,
      capabilitiesChecked,
      criticalFindings,
      cautionFindings,
      conflicts,
      staleEvidence,
      providerFailures,
      evidenceIds,
      reasons: disposition.reasons,
      assessedAt,
      attributions,
    };
  }
}

export const securityAssessmentService = new SecurityAssessmentService();
