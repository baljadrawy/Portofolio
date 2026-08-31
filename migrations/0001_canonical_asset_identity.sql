-- Phase 0B — Canonical Asset Identity
-- ADDITIVE ONLY. Creates new tables and adds nullable columns.
-- Drops nothing, renames nothing, rewrites no row, changes no balance.
-- Target: database `portfolio` only.

BEGIN;

-- Guard: refuse to run anywhere except the portfolio database.
DO $$
BEGIN
  IF current_database() <> 'portfolio' THEN
    RAISE EXCEPTION 'Refusing to run: expected database "portfolio", got "%"', current_database();
  END IF;
END $$;

-- ── 1. Canonical asset ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_symbol   text NOT NULL,
  canonical_name     text NOT NULL,
  asset_type         text NOT NULL DEFAULT 'UNKNOWN',
  status             text NOT NULL DEFAULT 'CANONICAL',
  canonical_asset_id varchar REFERENCES assets(id) ON DELETE SET NULL,
  native_chain_id    integer,
  economic_group     text,
  created_at         timestamp DEFAULT now(),
  updated_at         timestamp DEFAULT now(),
  CONSTRAINT assets_type_chk   CHECK (asset_type IN ('NATIVE','TOKEN','WRAPPED','BRIDGED','LP','SYNTHETIC','UNKNOWN')),
  CONSTRAINT assets_status_chk CHECK (status     IN ('CANONICAL','ALIAS','UNRESOLVED','DISPUTED','BLOCKED'))
);

-- ── 2. Per-network identity ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_network_identities (
  id               varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id         varchar NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  network_family   text NOT NULL,
  chain_id         integer,
  network_key      text,
  contract_address text,
  address_key      text NOT NULL,
  is_native        boolean NOT NULL DEFAULT false,
  is_wrapped       boolean NOT NULL DEFAULT false,
  is_bridged       boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'ACTIVE',
  created_at       timestamp DEFAULT now(),
  updated_at       timestamp DEFAULT now(),
  CONSTRAINT ani_family_chk CHECK (network_family IN ('evm','solana')),
  CONSTRAINT ani_status_chk CHECK (status IN ('ACTIVE','DEPRECATED')),
  -- A native asset has no contract; a token must have one.
  CONSTRAINT ani_native_chk CHECK (
    (is_native AND contract_address IS NULL AND address_key = 'NATIVE')
    OR (NOT is_native AND contract_address IS NOT NULL)
  ),
  -- EVM identity is chain-scoped and requires a chain id.
  CONSTRAINT ani_evm_chain_chk CHECK (network_family <> 'evm' OR chain_id IS NOT NULL)
);

-- NULLS NOT DISTINCT is required: Solana rows carry chain_id = NULL, and under
-- the default NULLS DISTINCT two identical Solana mints would both be allowed.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_network_address
  ON asset_network_identities (network_family, chain_id, address_key) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS idx_ani_asset  ON asset_network_identities (asset_id);
CREATE INDEX IF NOT EXISTS idx_ani_lookup ON asset_network_identities (network_family, address_key);

-- ── 3. Provider mappings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_provider_mappings (
  id                varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          varchar NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  provider          text NOT NULL,
  provider_asset_id text NOT NULL,
  provider_symbol   text,
  status            text NOT NULL DEFAULT 'ACTIVE',
  metadata          text,
  created_at        timestamp DEFAULT now(),
  updated_at        timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_provider_asset ON asset_provider_mappings (provider, provider_asset_id);
CREATE INDEX IF NOT EXISTS idx_apm_asset ON asset_provider_mappings (asset_id);

-- ── 4. Aliases / rebrands ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_aliases (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    varchar NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  alias_type  text NOT NULL,
  alias_value text NOT NULL,
  valid_from  timestamp,
  valid_to    timestamp,
  note        text,
  created_at  timestamp DEFAULT now(),
  CONSTRAINT alias_type_chk CHECK (alias_type IN ('SYMBOL','NAME','PROVIDER_SYMBOL','MIGRATION_SYMBOL'))
);
CREATE INDEX IF NOT EXISTS idx_alias_lookup ON asset_aliases (alias_type, alias_value);
CREATE INDEX IF NOT EXISTS idx_alias_asset  ON asset_aliases (asset_id);

-- ── 5. Link holdings (additive, nullable) ──────────────────────────────────
ALTER TABLE holdings
  ADD COLUMN IF NOT EXISTS asset_id                varchar REFERENCES assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS identity_status         text NOT NULL DEFAULT 'UNRESOLVED',
  ADD COLUMN IF NOT EXISTS resolution_method       text,
  ADD COLUMN IF NOT EXISTS manual_override         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_contract_address text,
  ADD COLUMN IF NOT EXISTS source_chain_id         integer,
  ADD COLUMN IF NOT EXISTS source_network_family   text;

-- ── 6. Link transactions (additive, nullable) ──────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS asset_id                varchar REFERENCES assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS identity_status         text NOT NULL DEFAULT 'UNRESOLVED',
  ADD COLUMN IF NOT EXISTS source_contract_address text,
  ADD COLUMN IF NOT EXISTS source_chain_id         integer;

CREATE INDEX IF NOT EXISTS idx_holdings_asset     ON holdings (asset_id);
CREATE INDEX IF NOT EXISTS idx_transactions_asset ON transactions (asset_id);

COMMIT;
