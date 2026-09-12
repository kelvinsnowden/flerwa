import "server-only";
import type { VerificationProviderAdapter } from "./provider";
import { koraAdapter } from "./adapters/kora";

/** Same pattern as src/lib/payments/registry.ts, for identity vendors. */
export const verificationAdapters: Record<string, VerificationProviderAdapter> = {
  kora: koraAdapter,
};
