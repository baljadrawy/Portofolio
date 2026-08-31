-- Phase 1 — Intelligence Foundations: Evidence Core
-- ADDITIVE ONLY. Creates new tables. Touches no existing table, no existing
-- row, no balance, no identity mapping.
-- Target: database `portfolio` only.

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'portfolio' THEN
    RAISE EXCEPTION 'Refusing to run: expected database "portfolio", got "%"', current_database();
  END IF;
END $$;

-- ── Source registry ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence_sources (
  id                       varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  key                      text NOT NULL,
  name                     text NOT NULL,
  source_type              text NOT NULL,
  tier                     integer NOT NULL,
  authority                text,
  status                   text NOT NULL DEFAULT 'ACTIVE',
  default_freshness_policy text,
  metadata                 text,
  created_at               timestamp DEFAULT now(),
  updated_at               timestamp DEFAULT now(),
  CONSTRAINT es_tier_chk   CHECK (tier BETWEEN 1 AND 5),
  CONSTRAINT es_status_chk CHECK (status IN ('ACTIVE','DISABLED','DEPRECATED')),
  CONSTRAINT es_type_chk   CHECK (source_type IN
    ('API','ONCHAIN','DOCUMENT','ARTICLE','SOCIAL','FILING','SECURITY_PROVIDER'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_evidence_source_key ON evidence_sources (key);

-- ── Evidence ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence (
  id                       varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id                 varchar REFERENCES assets(id) ON DELETE SET NULL,

  category                 text NOT NULL,
  evidence_type            text NOT NULL,

  source_id                varchar NOT NULL REFERENCES evidence_sources(id),
  source_key               text NOT NULL,
  source_type              text NOT NULL,
  source_tier              integer NOT NULL,

  observed_at              timestamp,
  effective_at             timestamp,
  retrieved_at             timestamp NOT NULL DEFAULT now(),

  freshness_status         text,
  freshness_calculated_at  timestamp,
  freshness_policy_version text,

  reliability              integer,
  reliability_basis        text,

  raw_value                text,
  normalized_value         text,
  normalized_unit          text,
  normalizer_version       text,

  evidence_hash            text NOT NULL,
  hash_version             text NOT NULL,

  status                   text NOT NULL DEFAULT 'ACTIVE',
  superseded_by_id         varchar REFERENCES evidence(id) ON DELETE SET NULL,
  parent_evidence_id       varchar REFERENCES evidence(id) ON DELETE SET NULL,
  conflicts_with_id        varchar REFERENCES evidence(id) ON DELETE SET NULL,
  status_reason            text,

  created_at               timestamp DEFAULT now(),

  CONSTRAINT ev_tier_chk     CHECK (source_tier BETWEEN 1 AND 5),
  CONSTRAINT ev_status_chk   CHECK (status IN ('ACTIVE','SUPERSEDED','RETRACTED','INVALID','CONFLICTING')),
  CONSTRAINT ev_fresh_chk    CHECK (freshness_status IS NULL OR freshness_status IN ('FRESH','AGING','STALE','UNKNOWN')),
  CONSTRAINT ev_category_chk CHECK (category IN
    ('PRICE','MARKET','ONCHAIN','SECURITY','NEWS','TOKEN_UNLOCK','TOKENOMICS',
     'DEVELOPMENT','FUNDAMENTALS','COMPETITION','REGULATORY','GEOPOLITICAL')),
  -- Raw must survive normalization; a normalized value with no raw origin is
  -- unauditable by construction.
  CONSTRAINT ev_raw_chk      CHECK (normalized_value IS NULL OR raw_value IS NOT NULL),
  CONSTRAINT ev_reliab_chk   CHECK (reliability IS NULL OR reliability BETWEEN 0 AND 100)
);

-- Dedup is scoped to (source_key, hash). A DIFFERENT source asserting the same
-- hash is corroboration and is deliberately allowed through.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_evidence_source_hash ON evidence (source_key, evidence_hash);
CREATE INDEX IF NOT EXISTS idx_evidence_asset          ON evidence (asset_id);
CREATE INDEX IF NOT EXISTS idx_evidence_asset_category ON evidence (asset_id, category);
CREATE INDEX IF NOT EXISTS idx_evidence_retrieved      ON evidence (retrieved_at);
CREATE INDEX IF NOT EXISTS idx_evidence_status         ON evidence (status);

-- ── Snapshots ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence_snapshots (
  id                       varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id                 varchar REFERENCES assets(id) ON DELETE SET NULL,
  as_of                    timestamp NOT NULL,
  spec_version             text NOT NULL,
  freshness_policy_version text NOT NULL,
  status                   text NOT NULL DEFAULT 'DRAFT',
  coverage_report          text,
  finalized_at             timestamp,
  created_at               timestamp DEFAULT now(),
  CONSTRAINT evsnap_status_chk CHECK (status IN ('DRAFT','FINALIZED')),
  -- A finalized snapshot must record when it was frozen.
  CONSTRAINT evsnap_final_chk  CHECK (status <> 'FINALIZED' OR finalized_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_evsnap_asset ON evidence_snapshots (asset_id);

CREATE TABLE IF NOT EXISTS evidence_snapshot_items (
  id                    varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id           varchar NOT NULL REFERENCES evidence_snapshots(id) ON DELETE CASCADE,
  -- RESTRICT: evidence referenced by a snapshot cannot be deleted, or the
  -- snapshot stops being reproducible.
  evidence_id           varchar NOT NULL REFERENCES evidence(id) ON DELETE RESTRICT,
  freshness_at_snapshot text NOT NULL,
  included_reason       text,
  created_at            timestamp DEFAULT now(),
  CONSTRAINT evsnapitem_fresh_chk CHECK (freshness_at_snapshot IN ('FRESH','AGING','STALE','UNKNOWN'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_snapshot_evidence ON evidence_snapshot_items (snapshot_id, evidence_id);
CREATE INDEX IF NOT EXISTS idx_evsnapitem_snapshot ON evidence_snapshot_items (snapshot_id);

-- ── Immutability guard ─────────────────────────────────────────────────────
-- Enforced in the database, not left to application discipline: once a snapshot
-- is FINALIZED neither it nor its item set may change.
CREATE OR REPLACE FUNCTION evsnap_block_finalized() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'evidence_snapshots' THEN
    IF OLD.status = 'FINALIZED' THEN
      RAISE EXCEPTION 'Snapshot % is FINALIZED and immutable', OLD.id;
    END IF;
    RETURN NEW;
  ELSE
    IF EXISTS (SELECT 1 FROM evidence_snapshots s
               WHERE s.id = COALESCE(NEW.snapshot_id, OLD.snapshot_id)
                 AND s.status = 'FINALIZED') THEN
      RAISE EXCEPTION 'Cannot modify items of a FINALIZED snapshot';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evsnap_immutable ON evidence_snapshots;
CREATE TRIGGER trg_evsnap_immutable BEFORE UPDATE OR DELETE ON evidence_snapshots
  FOR EACH ROW EXECUTE FUNCTION evsnap_block_finalized();

DROP TRIGGER IF EXISTS trg_evsnapitem_immutable ON evidence_snapshot_items;
CREATE TRIGGER trg_evsnapitem_immutable BEFORE INSERT OR UPDATE OR DELETE ON evidence_snapshot_items
  FOR EACH ROW EXECUTE FUNCTION evsnap_block_finalized();

COMMIT;
