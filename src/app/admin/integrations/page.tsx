import { createClient } from "@/lib/supabase/server";
import { ProviderToggleList } from "./provider-toggle";
import { ErrorNotice } from "@/components/error-notice";
import type { PaymentProvider, VerificationProvider, PaymentProviderEvent } from "@/lib/types";

interface NotificationChannel {
  key: string;
  kind: "email" | "sms";
  display_name: string;
  is_active: boolean;
  connected_at: string | null;
}

export default async function AdminIntegrationsPage() {
  const supabase = await createClient();

  const [
    { data: paymentProviders, error: ppError },
    { data: verificationProviders, error: vpError },
    { data: recentEvents },
    { count: unprocessedCount },
    { data: notificationChannels, error: ncError },
  ] = await Promise.all([
    supabase.from("payment_providers").select("*").order("created_at").returns<PaymentProvider[]>(),
    supabase.from("verification_providers").select("*").order("created_at").returns<VerificationProvider[]>(),
    supabase
      .from("payment_provider_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<PaymentProviderEvent[]>(),
    supabase.from("payment_provider_events").select("id", { count: "exact", head: true }).eq("processed", false),
    supabase.from("notification_channels").select("*").order("created_at").returns<NotificationChannel[]>(),
  ]);

  const emailChannels = notificationChannels?.filter((c) => c.kind === "email") ?? [];
  const smsChannels = notificationChannels?.filter((c) => c.kind === "sms") ?? [];

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Integrations</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Which payment aggregator and identity/KYC vendor are authoritative right now — a
        registry flip here, not a code deploy. Adding a brand-new vendor still means writing
        one adapter file first (see <code>src/lib/payments/registry.ts</code> and{" "}
        <code>src/lib/verification/registry.ts</code>); this page only controls which
        already-coded adapter is live. See <code>docs/16-payment-verification-integrations.md</code>.
      </p>

      {(ppError || vpError) && (
        <ErrorNotice message="Couldn't load the provider registry. Please refresh." />
      )}

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Payment providers</h2>
        {paymentProviders && <ProviderToggleList kind="payment" rows={paymentProviders} />}
        {paymentProviders?.find((p) => p.is_active)?.key !== "manual" && (
          <p className="text-xs text-[var(--muted)] mt-2">
            Point the active aggregator&apos;s webhook dashboard at{" "}
            <code>/api/webhooks/payments</code> on this domain.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Verification providers</h2>
        {verificationProviders && <ProviderToggleList kind="verification" rows={verificationProviders} />}
        {verificationProviders?.find((p) => p.is_active)?.key !== "manual" && (
          <p className="text-xs text-[var(--muted)] mt-2">
            Point the active vendor&apos;s webhook dashboard (if it has one — see{" "}
            <code>src/lib/verification/adapters/kora.ts</code>) at{" "}
            <code>/api/webhooks/verification</code> on this domain.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Support channels</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Provider-agnostic by design (MARKETPLACE_SUPPORT_SYSTEM_PLAN.md §4) — the support
          system never calls a vendor directly, only whichever channel is active here. Adding
          a new vendor means one adapter file in <code>src/lib/notifications/adapters/</code>{" "}
          plus one registry line, never touching a route, RPC, or UI.
        </p>
        {ncError && <ErrorNotice message="Couldn't load notification channels. Please refresh." />}

        <p className="text-xs font-semibold text-[var(--muted)] mb-1">Email</p>
        {emailChannels.length > 0 ? (
          <ProviderToggleList kind="notification" rows={emailChannels} />
        ) : (
          <p className="text-xs text-[var(--muted)]">No email channel registered.</p>
        )}
        {emailChannels.find((c) => c.is_active) && (
          <p className="text-xs text-[var(--muted)] mt-2">
            Requires a verified sending domain with the active provider and{" "}
            <code>SUPPORT_EMAIL_FROM</code>/<code>RESEND_WEBHOOK_SECRET</code> set (see{" "}
            <code>.env.example</code>). Point the provider&apos;s inbound webhook at{" "}
            <code>/api/webhooks/support-inbound</code> on this domain.
          </p>
        )}

        <p className="text-xs font-semibold text-[var(--muted)] mt-4 mb-1">SMS</p>
        {smsChannels.length > 0 ? (
          <ProviderToggleList kind="notification" rows={smsChannels} />
        ) : (
          <p className="text-xs text-[var(--muted)]">
            No SMS vendor connected — <code>SmsProviderAdapter</code> ships with zero adapters
            registered by design (see <code>src/lib/notifications/registry.ts</code>). Support
            stays email-only until a vendor is chosen.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">
          Recent payment events
          {!!unprocessedCount && (
            <span className="ml-2 text-xs text-[var(--danger)] font-normal">
              {unprocessedCount} awaiting reconciliation
            </span>
          )}
        </h2>
        {!recentEvents?.length && <p className="text-xs text-[var(--muted)]">No webhook events received yet.</p>}
        <div className="flex flex-col gap-2">
          {recentEvents?.map((event) => (
            <div key={event.id} className="card p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono">{event.provider_key}</span>
                <span>{new Date(event.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1">
                {event.event_type} · {event.external_reference || "no reference"}
                {event.amount_minor != null && ` · ${event.amount_minor / 100} ${event.currency}`}
              </p>
              {event.processed ? (
                <span className="badge-trust mt-1 inline-block">Processed</span>
              ) : (
                <p className="text-[var(--danger)] mt-1">{event.processing_error}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
