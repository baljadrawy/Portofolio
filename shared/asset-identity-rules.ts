// Pure asset-identity rules. Deliberately imports nothing — no database, no
// services — so the rules are unit-testable in isolation and reusable on both
// sides of the wire.

export type NetworkFamily = "evm" | "solana";

export type IdentityStatus = "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED" | "DEPRECATED";

export type ResolutionMethod =
  | "MANUAL"
  | "CONTRACT_EXACT"
  | "MINT_EXACT"
  | "NATIVE_CHAIN"
  | "PROVIDER_ID"
  | "LEGACY_SYMBOL";

/** Highest first. A symbol is last and never sufficient on its own. */
export const RESOLUTION_PRECEDENCE: ResolutionMethod[] = [
  "MANUAL",
  "CONTRACT_EXACT",
  "MINT_EXACT",
  "NATIVE_CHAIN",
  "PROVIDER_ID",
  "LEGACY_SYMBOL",
];

/**
 * Address normalisation is per-family and deliberately NOT universal.
 *
 * EVM   : hex addresses are case-insensitive. EIP-55 casing is a checksum, not
 *         identity, so the comparison key is lowercased.
 * Solana: mint addresses are base58 and CASE-SENSITIVE. Lowercasing one yields
 *         a different, wrong address. Left exactly as provided.
 *
 * A single universal lowercase rule would silently corrupt Solana identity.
 */
export function normalizeAddressKey(
  networkFamily: NetworkFamily,
  contractAddress: string | null | undefined,
  isNative = false,
): string {
  if (isNative || !contractAddress) return "NATIVE";
  const trimmed = contractAddress.trim();
  return networkFamily === "evm" ? trimmed.toLowerCase() : trimmed;
}

/** A symbol alone can never produce RESOLVED. */
export function statusFromSymbolCandidates(count: number): IdentityStatus {
  return count === 0 ? "UNRESOLVED" : "AMBIGUOUS";
}

/** Manual, operator-verified mappings are never replaced by a heuristic. */
export function shouldApplyAutomaticResolution(existingManualOverride: boolean): boolean {
  return !existingManualOverride;
}
