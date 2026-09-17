/**
 * Same shape as email-provider.ts. Ships with zero registered adapters —
 * see registry.ts. No SMS vendor is connected in this environment; any
 * code path that would send an SMS must call through this interface and
 * handle { ok: false, error: "not configured" } exactly like
 * createIntasendCollection does when INTASEND_SECRET_KEY is unset —
 * never a silent no-op that pretends to have sent something.
 */

export interface OutboundSms {
  to: string;
  body: string;
}

export interface SmsProviderAdapter {
  key: string;
  sendSms(msg: OutboundSms): Promise<{ ok: boolean; providerMessageId?: string; error?: string }>;
  /** Optional: same contract as EmailProviderAdapter.testConnection. */
  testConnection?(): Promise<{ ok: boolean; error?: string }>;
}
