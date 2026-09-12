import "server-only";
import type { PaymentProviderAdapter } from "./provider";
import { intasendAdapter } from "./adapters/intasend";

/**
 * Every aggregator this codebase knows how to speak to, keyed exactly like
 * `payment_providers.key` in the database. The webhook route looks up
 * whichever key the DB says is currently active and dispatches here — add
 * a new vendor by writing one adapter file and adding one line below,
 * never by touching the route or the RPCs.
 */
export const paymentAdapters: Record<string, PaymentProviderAdapter> = {
  intasend: intasendAdapter,
};
