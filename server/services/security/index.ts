import { securityProviderRegistry } from "../security-provider";
import { DirectChainAdapter } from "./direct-chain";
import { GoPlusAdapter } from "./goplus";
import { InternalRulesAdapter } from "./internal-rules";

// Registration is centralised here so the rest of the application never names
// a vendor. Order is irrelevant; the registry selects by capability.
let registered = false;

export function registerSecurityProviders(): void {
  if (registered) return;
  securityProviderRegistry.register(new DirectChainAdapter());
  securityProviderRegistry.register(new GoPlusAdapter());
  securityProviderRegistry.register(new InternalRulesAdapter());
  registered = true;
}

export { securityAssessmentService } from "./assessment";
export { GOPLUS_ATTRIBUTION } from "./goplus";
