import { createHash } from "crypto";
import { eq, and, sql, lte, isNull, or } from "drizzle-orm";
import { db } from "../db";
import { evidence, evidenceSources, evidenceSnapshots, evidenceSnapshotItems } from "@shared/schema";
import {
  buildHashInput,
  classifyIngestion,
  computeFreshness,
  isVisibleAt,
  EVIDENCE_HASH_VERSION,
  FRESHNESS_POLICY_VERSION,
  type EvidenceCategory,
  type IngestionOutcome,
} from "@shared/evidence-rules";

// ─────────────────────────────────────────────────────────────────────────────
// Evidence ingestion and retrieval.
//
// Append-oriented by design: a new observation is a new row. Nothing here
// rewrites a historical fact. Corrections mark the old row SUPERSEDED or
// RETRACTED and insert a new one.
// ─────────────────────────────────────────────────────────────────────────────

export interface EvidenceInput {
  assetId: string | null;
  category: EvidenceCategory;
  evidenceType: string;
  sourceKey: string;
  observedAt?: Date | null;
  effectiveAt?: Date | null;
  rawValue: unknown;
  normalizedValue?: unknown;
  normalizedUnit?: string | null;
  normalizerVersion?: string | null;
  reliability?: number | null;
  reliabilityBasis?: string | null;
}

export interface IngestResult {
  outcome: IngestionOutcome;
  evidenceId: string | null;
  hash: string;
}

export function hashEvidence(input: EvidenceInput): string {
  const payload = buildHashInput({
    assetId: input.assetId,
    category: input.category,
    evidenceType: input.evidenceType,
    sourceKey: input.sourceKey,
    observedAt: input.observedAt ? input.observedAt.toISOString() : null,
    effectiveAt: input.effectiveAt ? input.effectiveAt.toISOString() : null,
    rawValue: input.rawValue,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export class EvidenceService {
  /**
   * Idempotent. The same observation from the same source does not create a
   * second row; a different source asserting the same thing DOES, because
   * independent corroboration is the only thing that raises confidence.
   */
  async ingest(input: EvidenceInput, now = new Date()): Promise<IngestResult> {
    const hash = hashEvidence(input);

    const src = (
      await db.select().from(evidenceSources).where(eq(evidenceSources.key, input.sourceKey))
    )[0];
    if (!src) throw new Error(`Unknown evidence source: ${input.sourceKey}`);
    if (src.status !== "ACTIVE") {
      // A disabled source may not write new evidence. Its existing rows stay.
      return { outcome: "DUPLICATE", evidenceId: null, hash };
    }

    const existing = await db
      .select()
      .from(evidence)
      .where(
        and(
          input.assetId ? eq(evidence.assetId, input.assetId) : isNull(evidence.assetId),
          eq(evidence.category, input.category),
          eq(evidence.evidenceType, input.evidenceType),
        ),
      );

    const outcome = classifyIngestion(
      { sourceKey: input.sourceKey, hash, observedAt: input.observedAt ?? null },
      existing.map((e) => ({
        sourceKey: e.sourceKey,
        hash: e.evidenceHash,
        observedAt: e.observedAt,
      })),
    );

    if (outcome === "DUPLICATE") {
      const row = existing.find((e) => e.sourceKey === input.sourceKey && e.evidenceHash === hash)!;
      return { outcome, evidenceId: row.id, hash };
    }

    const freshness = computeFreshness(
      input.category,
      input.observedAt ?? null,
      now,
    );

    const [row] = await db
      .insert(evidence)
      .values({
        assetId: input.assetId,
        category: input.category,
        evidenceType: input.evidenceType,
        sourceId: src.id,
        sourceKey: input.sourceKey,
        sourceType: src.sourceType,
        sourceTier: src.tier,
        observedAt: input.observedAt ?? null,
        effectiveAt: input.effectiveAt ?? null,
        retrievedAt: now,
        freshnessStatus: freshness,
        freshnessCalculatedAt: now,
        freshnessPolicyVersion: FRESHNESS_POLICY_VERSION,
        reliability: input.reliability ?? null,
        reliabilityBasis: input.reliabilityBasis ?? null,
        rawValue: JSON.stringify(input.rawValue),
        normalizedValue:
          input.normalizedValue === undefined ? null : JSON.stringify(input.normalizedValue),
        normalizedUnit: input.normalizedUnit ?? null,
        normalizerVersion: input.normalizerVersion ?? null,
        evidenceHash: hash,
        hashVersion: EVIDENCE_HASH_VERSION,
        status: "ACTIVE",
      })
      .returning();

    // Supersede the previous observation from the SAME source. The old row is
    // kept and marked, never deleted.
    if (outcome === "SUPERSEDES") {
      const prior = existing.filter((e) => e.sourceKey === input.sourceKey && e.status === "ACTIVE");
      for (const p of prior) {
        await db
          .update(evidence)
          .set({ status: "SUPERSEDED", supersededById: row.id, statusReason: "newer observation from same source" })
          .where(eq(evidence.id, p.id));
      }
    }

    return { outcome, evidenceId: row.id, hash };
  }

  /** Mark evidence retracted. The row survives so the audit trail is intact. */
  async retract(evidenceId: string, reason: string): Promise<void> {
    await db
      .update(evidence)
      .set({ status: "RETRACTED", statusReason: reason })
      .where(eq(evidence.id, evidenceId));
  }

  /** Record a disagreement without choosing a winner or averaging. */
  async markConflict(aId: string, bId: string, reason: string): Promise<void> {
    await db.update(evidence).set({ status: "CONFLICTING", conflictsWithId: bId, statusReason: reason }).where(eq(evidence.id, aId));
    await db.update(evidence).set({ status: "CONFLICTING", conflictsWithId: aId, statusReason: reason }).where(eq(evidence.id, bId));
  }

  async forAsset(assetId: string) {
    return db.select().from(evidence).where(eq(evidence.assetId, assetId));
  }

  /**
   * Historical view. Returns only evidence we had actually retrieved by the
   * cutoff and that was already in force — this is what prevents future-data
   * leakage in any later replay.
   */
  async visibleAt(assetId: string, cutoff: Date) {
    const rows = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.assetId, assetId), lte(evidence.retrievedAt, cutoff)));
    return rows.filter((r) => isVisibleAt({ retrievedAt: r.retrievedAt, effectiveAt: r.effectiveAt }, cutoff));
  }
}

export class EvidenceSnapshotService {
  async create(assetId: string | null, asOf: Date, specVersion: string) {
    const [snap] = await db
      .insert(evidenceSnapshots)
      .values({ assetId, asOf, specVersion, freshnessPolicyVersion: FRESHNESS_POLICY_VERSION, status: "DRAFT" })
      .returning();
    return snap;
  }

  async addItem(snapshotId: string, evidenceId: string, freshnessAtSnapshot: string, reason?: string) {
    const [item] = await db
      .insert(evidenceSnapshotItems)
      .values({ snapshotId, evidenceId, freshnessAtSnapshot, includedReason: reason ?? null })
      .returning();
    return item;
  }

  /** After this the set is frozen. Newer evidence requires a NEW snapshot. */
  async finalize(snapshotId: string, coverageReport?: unknown) {
    const [snap] = await db
      .update(evidenceSnapshots)
      .set({
        status: "FINALIZED",
        finalizedAt: new Date(),
        coverageReport: coverageReport === undefined ? null : JSON.stringify(coverageReport),
      })
      .where(eq(evidenceSnapshots.id, snapshotId))
      .returning();
    return snap;
  }

  async items(snapshotId: string) {
    return db.select().from(evidenceSnapshotItems).where(eq(evidenceSnapshotItems.snapshotId, snapshotId));
  }
}

export const evidenceService = new EvidenceService();
export const evidenceSnapshotService = new EvidenceSnapshotService();
