import { securityProviderRegistry, observationsToEvidence, type SecurityAssessmentInput, type SecurityAssessmentResult } from "../security-provider";
import { evidenceService } from "../evidence";
import { computeFreshness } from "@shared/evidence-rules";
import {
  computeDisposition, coreCapabilitiesFor, SECURITY_POLICY_VERSION,
  type IncidentIntelligenceReport, type IncidentIntelligenceStatus,
  NO_INCIDENT_LOOKUP,
} from "@shared/security-rules";
import {
  countsAsChecked, isPositiveDetection,
} from "@shared/sell-path-rules";
import {
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
  /**
   * DETERMINISTIC CORE checks only. Read this as "how much of what we can
   * verify did we verify" — never as confidence, and never as a probability
   * that the asset is safe.
   */
  coverage: { required: number; checked: number; ratio: number; missing: SecurityCapability[] };
  /** External incident intelligence, reported beside coverage and never inside it. */
  incidentIntelligence: IncidentIntelligenceReport;
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

/**
 * Turns incident observations into a status. The critical property is what
 * happens with an EMPTY input: NOT_AVAILABLE, zero assurance, non-blocking.
 * No lookup happened, so there is nothing to report and nothing to credit.
 */
function summarizeIncidentIntelligence(obs: Array<{ providerKey: string; value: unknown }>): IncidentIntelligenceReport {
  if (obs.length === 0) return NO_INCIDENT_LOOKUP;

  const sourcesQueried = Array.from(new Set(obs.map((o) => o.providerKey)));
  const values = obs.map((o) => o.value).filter((v): v is IncidentIntelligenceStatus => typeof v === "string");

  if (values.includes("SOURCE_FAILED")) {
    return { status: "SOURCE_FAILED", sourcesQueried, positiveFindings: 0, assuranceCredit: 0,
      detail: "an incident source failed; failure is not an absence of incidents" };
  }
  if (values.includes("ACTIVE_CRITICAL_INCIDENT_FOUND")) {
    return { status: "ACTIVE_CRITICAL_INCIDENT_FOUND", sourcesQueried,
      positiveFindings: values.filter((v) => v === "ACTIVE_CRITICAL_INCIDENT_FOUND").length, assuranceCredit: 0,
      detail: `unresolved critical incident reported by ${sourcesQueried.join(", ")}` };
  }
  // Sources disagreeing about whether a critical incident is live is itself a
  // reason to withhold CLEAR — surfaced, never resolved to the calmer side.
  if (values.includes("INCIDENT_CONFLICT_UNRESOLVED")) {
    return { status: "INCIDENT_CONFLICT_UNRESOLVED", sourcesQueried, positiveFindings: 0, assuranceCredit: 0,
      detail: "sources disagree on whether a critical incident remains unresolved" };
  }
  // A real lookup ran and found nothing active. Informational ONLY: it says
  // the queried sources are silent, not that the world is.
  return {
    status: "NO_ACTIVE_CRITICAL_INCIDENT_FOUND_IN_QUERIED_SOURCES",
    sourcesQueried,
    positiveFindings: 0,
    assuranceCredit: 0,
    detail: `queried ${sourcesQueried.join(", ")}; no active critical incident in those sources — this is not verified absence`,
  };
}

/** Maps an observation to a finding. Absent capability → no finding invented. */
function toFinding(
  capability: SecurityCapability,
  severity: Finding["severity"],
  deterministic: boolean,
  corroboration: number,
  freshness: Finding["freshness"],
  freshnessBasis: Finding["freshnessBasis"],
  evidenceIds: string[],
  detail: string,
): Finding {
  return { capability, severity, deterministic, corroboration, freshness, freshnessBasis, evidenceIds, detail };
}

export class SecurityAssessmentService {
  /**
   * A deduction is CRITICAL when it destroys at least half the value. At 100%
   * the transfer "succeeds" while the recipient receives nothing — economically
   * unsellable, which is what a honeypot achieves without ever reverting.
   */
  private deductionIsCritical(obs: Array<{ value: unknown; raw?: unknown }>): boolean {
    return obs.some((o) => {
      const r = (o as any).rawDetail;
      return r?.severity === "CRITICAL";
    });
  }

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
    type Obs = { providerKey: string; value: unknown; deterministic: boolean; observedAt: Date | null; rawDetail?: any };
    const byCapability = new Map<string, Obs[]>();
    for (const r of results.filter((x) => x.status === "OK")) {
      const deterministic = r.providerKey === "direct-chain";
      for (const o of r.observations) {
        const list = byCapability.get(o.type) ?? [];
        list.push({
          providerKey: r.providerKey, value: o.normalized, deterministic,
          observedAt: o.observedAt ?? null,
          // Carried through so severity thresholds can be applied without
          // re-parsing the raw payload.
          rawDetail: o.raw as any,
        });
        byCapability.set(o.type, list);
      }
    }

    // COVERAGE_UNKNOWN means the source disclaims authority over this asset.
    // It is an answered CALL but not a completed CHECK, so it is excluded here
    // and the capability falls into `missing` — which forces
    // INSUFFICIENT_EVIDENCE rather than a false CLEAR.
    // Sell-path verdicts are strings, not booleans. COVERAGE_INCOMPLETE and
    // TEST_FAILED are answered calls but NOT completed checks, so they must not
    // count toward coverage — otherwise a probe that could not run would look
    // like a passed check.
    for (const cap of ["HONEYPOT_INDICATOR", "SELL_RESTRICTION", "SELL_TAX", "BLACKLIST_CAPABILITY"]) {
      const o = byCapability.get(cap) ?? [];
      if (o.length > 0 && !(o as Obs[]).some((x) => typeof x.value === "string" && countsAsChecked(x.value))) {
        byCapability.delete(cap);
      }
    }

    // External incident intelligence is lifted OUT of the capability map before
    // coverage is counted. It is a different kind of knowledge (Phase 2E): its
    // presence must not inflate a deterministic ratio and its silence must not
    // deflate one. Silence is the common case and produces no observation at
    // all, so the map usually has no entry to lift.
    const incidentObs = (byCapability.get("KNOWN_CRITICAL_EXPLOIT") ?? []) as Obs[];
    byCapability.delete("KNOWN_CRITICAL_EXPLOIT");
    const incidentIntelligence = summarizeIncidentIntelligence(incidentObs);

    const capabilitiesChecked = Array.from(byCapability.keys()) as SecurityCapability[];
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
      const freshnessBasis: Finding["freshnessBasis"] = freshest ? "OBSERVED" : "RETRIEVED";
      const freshness = computeFreshness("SECURITY", freshest ?? assessedAt, assessedAt);
      if (freshness === "STALE") staleEvidence.push(cap);

      if (positive.length === 0) continue;

      const corroboration = positive.length;
      const detail = `${positive.map((p) => p.providerKey).join(", ")} report ${cap}`;

      switch (cap) {
        case "HONEYPOT_INDICATOR":
        case "SELL_RESTRICTION":
        case "BLACKLIST_CAPABILITY":
        case "MINT_AUTHORITY":
        case "SELL_TAX": {
          const verdicts = (obs as Obs[]).map((o) => o.value).filter((v): v is string => typeof v === "string");
          if (verdicts.some(isPositiveDetection)) {
            // Honeypot and sell restriction are deterministic simulation
            // results, so a single observation establishes them. A blacklist
            // INTERFACE is only an interface — legitimate stablecoins have one —
            // so it is CAUTION, never CRITICAL.
            //
            // A deduction escalates by SIZE, not by presence: a transfer can
            // succeed while the recipient receives nothing, which is
            // economically identical to a honeypot even though nothing
            // reverted. That case must reach CRITICAL.
            const deductionSeverity = (obs as Obs[])
              .map((o) => (o as any).severity)
              .find((x) => x === "CRITICAL" || x === "CAUTION");
            const rawSeverity = (obs as Obs[])
              .map((o) => (o.value === "EFFECTIVE_DEDUCTION_OBSERVED_ON_TESTED_PATH" ? (o as any).deductionSeverity : undefined))
              .find(Boolean);
            void deductionSeverity; void rawSeverity;
            // A mint INTERFACE is never critical: most legitimate tokens mint.
            const critical = verdicts.some((v) =>
              v === "CONFIRMED_HONEYPOT_BEHAVIOR" ||
              v === "SELL_RESTRICTION_DETECTED" ||
              v === "TRANSFER_REVERTED") ||
              (cap === "SELL_TAX" && this.deductionIsCritical(obs as Obs[]));
            (critical ? criticalFindings : cautionFindings).push(
              toFinding(cap, critical ? "CRITICAL" : "CAUTION", true, corroboration, freshness, freshnessBasis, [],
                `${cap}: ${verdicts.join(", ")}`),
            );
          }
          break;
        }
        case "BLACKLIST_CAPABILITY":
        case "MINT_AUTHORITY":
        case "PROXY_UPGRADEABILITY":
        case "OWNERSHIP_PRIVILEGE":
        case "FREEZE_AUTHORITY":
          // Legitimate blue-chip protocols routinely have these. Alone they are
          // never critical — USDC is mintable, freezable and a proxy.
          cautionFindings.push(toFinding(cap, "CAUTION", deterministic, corroboration, freshness, freshnessBasis, [], detail));
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
            (mintObs as Obs[]).some((o) => o.deterministic), mintObs.length, "FRESH", "RETRIEVED", [],
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
          toFinding(cap, "CAUTION", live.some((o) => o.deterministic), live.length, "FRESH", "RETRIEVED", [],
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
      incidentIntelligence,
    });

    const attributions = Array.from(
      new Set(results.filter((r) => r.providerKey === "goplus").map(() => "Powered by Go+ Security")),
    );

    return {
      assetId,
      disposition: disposition.disposition,
      policyVersion: SECURITY_POLICY_VERSION,
      coverage: disposition.coverage,
      incidentIntelligence: disposition.incidentIntelligence,
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
