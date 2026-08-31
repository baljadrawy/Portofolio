import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  assets,
  assetNetworkIdentities,
  assetProviderMappings,
  assetAliases,
  type Asset,
} from "@shared/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Asset Identity Resolution — deterministic. No AI, no heuristics that guess.
//
// Resolution precedence (highest first):
//   1. MANUAL          operator-verified mapping — never overridden automatically
//   2. CONTRACT_EXACT  (evm, chain_id, lowercased address)
//   3. MINT_EXACT      (solana, exact-case mint)
//   4. NATIVE_CHAIN    native asset of a known chain
//   5. PROVIDER_ID     stable provider identifier
//   6. LEGACY_SYMBOL   symbol/alias — NEVER auto-resolves; at best AMBIGUOUS
//
// A symbol alone is not an identity. If the only signal is a symbol, the result
// is AMBIGUOUS (symbol known to >=1 asset) or UNRESOLVED (unknown) — never a
// silent pick. Guessing is how a scam token inherits a real asset's history.
// ─────────────────────────────────────────────────────────────────────────────

import {
  normalizeAddressKey,
  type IdentityStatus,
  type ResolutionMethod,
  type NetworkFamily,
} from "@shared/asset-identity-rules";

export { normalizeAddressKey };
export type { IdentityStatus, ResolutionMethod, NetworkFamily };

export interface ResolutionInput {
  symbol?: string | null;
  name?: string | null;
  networkFamily?: NetworkFamily | null;
  chainId?: number | null;
  contractAddress?: string | null;
  provider?: string | null;
  providerAssetId?: string | null;
}

export interface ResolutionResult {
  assetId: string | null;
  status: IdentityStatus;
  method: ResolutionMethod | null;
  /** Populated when status = AMBIGUOUS, so a human can disambiguate. */
  candidates?: string[];
  reason: string;
}

export class AssetIdentityService {
  /** Deterministic resolution. Returns UNRESOLVED rather than guessing. */
  async resolve(input: ResolutionInput): Promise<ResolutionResult> {
    const family = input.networkFamily ?? null;

    // 2/3. Exact on-chain identity — the strongest signal available.
    if (family && input.contractAddress) {
      const key = normalizeAddressKey(family, input.contractAddress);
      const rows = await db
        .select()
        .from(assetNetworkIdentities)
        .where(
          and(
            eq(assetNetworkIdentities.networkFamily, family),
            eq(assetNetworkIdentities.addressKey, key),
            family === "evm" && input.chainId != null
              ? eq(assetNetworkIdentities.chainId, input.chainId)
              : sql`true`,
          ),
        );

      if (rows.length === 1) {
        const row = rows[0];
        return {
          assetId: await this.followAlias(row.assetId),
          status: row.status === "DEPRECATED" ? "DEPRECATED" : "RESOLVED",
          method: family === "evm" ? "CONTRACT_EXACT" : "MINT_EXACT",
          reason: `exact ${family} identity match`,
        };
      }
      if (rows.length > 1) {
        return {
          assetId: null,
          status: "AMBIGUOUS",
          method: null,
          candidates: rows.map((r) => r.assetId),
          reason: "multiple network identities share this address key",
        };
      }
      // Address supplied but unknown. The same address on another chain is a
      // DIFFERENT token, so we do not widen the search.
      return {
        assetId: null,
        status: "UNRESOLVED",
        method: null,
        reason: "contract/mint not present in the asset registry",
      };
    }

    // 4. Native asset of a known chain.
    if (family && input.chainId != null && !input.contractAddress) {
      const rows = await db
        .select()
        .from(assetNetworkIdentities)
        .where(
          and(
            eq(assetNetworkIdentities.networkFamily, family),
            eq(assetNetworkIdentities.chainId, input.chainId),
            eq(assetNetworkIdentities.isNative, true),
          ),
        );
      if (rows.length === 1) {
        return {
          assetId: await this.followAlias(rows[0].assetId),
          status: "RESOLVED",
          method: "NATIVE_CHAIN",
          reason: `native asset of chain ${input.chainId}`,
        };
      }
    }

    // 5. Stable provider identifier.
    if (input.provider && input.providerAssetId) {
      const rows = await db
        .select()
        .from(assetProviderMappings)
        .where(
          and(
            eq(assetProviderMappings.provider, input.provider),
            eq(assetProviderMappings.providerAssetId, input.providerAssetId),
            eq(assetProviderMappings.status, "ACTIVE"),
          ),
        );
      if (rows.length === 1) {
        return {
          assetId: await this.followAlias(rows[0].assetId),
          status: "RESOLVED",
          method: "PROVIDER_ID",
          reason: `${input.provider} stable id`,
        };
      }
    }

    // 6. Symbol only — never sufficient for automatic resolution.
    if (input.symbol) {
      const candidates = await this.candidatesBySymbol(input.symbol);
      if (candidates.length === 0) {
        return {
          assetId: null,
          status: "UNRESOLVED",
          method: null,
          reason: "symbol unknown and no on-chain identity supplied",
        };
      }
      return {
        assetId: null,
        status: "AMBIGUOUS",
        method: null,
        candidates,
        reason:
          candidates.length === 1
            ? "symbol matches one asset, but a symbol alone is not proof of identity"
            : `symbol matches ${candidates.length} assets`,
      };
    }

    return {
      assetId: null,
      status: "UNRESOLVED",
      method: null,
      reason: "no identity signal supplied",
    };
  }

  /** Assets whose canonical symbol OR historical alias matches. */
  async candidatesBySymbol(symbol: string): Promise<string[]> {
    const direct = await db
      .select({ id: assets.id })
      .from(assets)
      .where(eq(assets.canonicalSymbol, symbol));

    const viaAlias = await db
      .select({ id: assetAliases.assetId })
      .from(assetAliases)
      .where(
        and(
          eq(assetAliases.aliasValue, symbol),
          sql`${assetAliases.aliasType} IN ('SYMBOL','MIGRATION_SYMBOL','PROVIDER_SYMBOL')`,
        ),
      );

    return Array.from(new Set([...direct.map((r) => r.id), ...viaAlias.map((r) => r.id)]));
  }

  /**
   * Follows status = ALIAS to the canonical row. This is what makes a rebrand
   * (MATIC -> POL) preserve history: the old asset_id keeps resolving, and
   * everything already pointing at it stays valid.
   */
  private async followAlias(assetId: string, depth = 0): Promise<string> {
    if (depth > 5) return assetId; // cycle guard
    const rows = await db.select().from(assets).where(eq(assets.id, assetId));
    const asset = rows[0] as Asset | undefined;
    if (asset?.status === "ALIAS" && asset.canonicalAssetId) {
      return this.followAlias(asset.canonicalAssetId, depth + 1);
    }
    return assetId;
  }
}

export const assetIdentityService = new AssetIdentityService();
