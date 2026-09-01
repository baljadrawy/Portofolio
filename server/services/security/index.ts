import { securityProviderRegistry } from "../security-provider";
import { DirectChainAdapter } from "./direct-chain";
import { InternalRulesAdapter } from "./internal-rules";

// Registration is centralised here so the rest of the application never names
// a vendor. Order is irrelevant; the registry selects by capability.
//
// ── GoPlus is DELIBERATELY NOT REGISTERED ───────────────────────────────────
//
// Its licence restricts commercial use without written permission, restricts
// redistribution, and is SILENT on caching and retention. Silence is not
// permission, and the Evidence Store exists precisely to cache and retain.
//
// The adapter is kept for development and evaluation only. Registering it here
// would place unresolved licence obligations into the production path, so this
// is enforced by the code that wires production rather than by a note in a
// document. See docs/13-DATA-GOVERNANCE.md.
//
// Consequence, accepted knowingly: EVM token capabilities that only GoPlus
// covered (honeypot, sell restriction, sell tax, blacklist) are now
// UNSUPPORTED. Those assets return INSUFFICIENT_EVIDENCE — never a false CLEAR.
// Tracked as TD-32.

let registered = false;

export function registerSecurityProviders(): void {
  if (registered) return;
  securityProviderRegistry.register(new DirectChainAdapter());
  securityProviderRegistry.register(new InternalRulesAdapter());
  registered = true;
}

export { PRODUCTION_PROVIDER_KEYS } from "@shared/security-rules";

export { securityAssessmentService } from "./assessment";
