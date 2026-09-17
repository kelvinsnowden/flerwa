import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { IntegrationCardList, type IntegrationCardRow, type CredentialFieldMeta } from "./integration-card";
import { ErrorNotice } from "@/components/error-notice";
import { paymentAdapters } from "@/lib/payments/registry";
import { verificationAdapters } from "@/lib/verification/registry";
import { emailAdapters, smsAdapters } from "@/lib/notifications/registry";
import { getProviderDefinition, getProviderDefinitions, type IntegrationCapability } from "@/lib/integrations/provider-schemas";
import type { PaymentProvider, PayoutProvider, VerificationProvider, PaymentProviderEvent } from "@/lib/types";

interface NotificationChannel {
  key: string;
  kind: "email" | "sms";
  display_name: string;
  is_active: boolean;
  connected_at: string | null;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
}

interface IntegrationCredentialRow {
  id: string;
  capability: IntegrationCapability;
  provider_key: string;
  enabled: boolean;
  metadata: { fields?: Record<string, CredentialFieldMeta> } | null;
}

function envConfigured(vars: string[]): boolean {
  return vars.length > 0 && vars.every((v) => !!process.env[v]);
}

/** Builds one IntegrationCardRow per known provider (from PROVIDER_DEFINITIONS)
 * for a capability, joined against whatever DB row(s) already exist for
 * activation status and saved credentials — so every provider this
 * codebase actually has an adapter for shows a Configure card, even one
 * nobody has touched yet, not just whatever happens to have a
 * payment_providers/verification_providers/notification_channels row. */
function buildRows<T extends { key: string; display_name: string; is_active: boolean; connected_at: string | null; last_tested_at: string | null; last_test_ok: boolean | null; last_test_error: string | null }>(
  capability: IntegrationCapability,
  dbRows: T[],
  adapters: Record<string, { testConnection?: unknown }>,
  credentialsByKey: Map<string, IntegrationCredentialRow>
): IntegrationCardRow[] {
  return dbRows.map((dbRow) => {
    const definition = getProviderDefinition(capability, dbRow.key) ?? null;
    const isManual = dbRow.key === "manual";
    const credential = credentialsByKey.get(dbRow.key);
    const credentialFields = credential?.metadata?.fields ?? {};

    const requiredVars = (definition?.configurationSchema ?? []).filter((f) => f.required).map((f) => f.key);
    const envFallbackConfigured = isManual ? true : envConfigured(requiredVars);

    const envPresence: Record<string, boolean> = {};
    const envFallbackValues: Record<string, string> = {};
    for (const field of definition?.configurationSchema ?? []) {
      envPresence[field.key] = !!process.env[field.key];
      if (!field.secret && process.env[field.key]) envFallbackValues[field.key] = process.env[field.key]!;
    }
    for (const f of definition?.deploymentManagedFields ?? []) {
      envPresence[f.key] = !!process.env[f.key];
    }

    return {
      key: dbRow.key,
      display_name: dbRow.display_name,
      is_active: dbRow.is_active,
      connected_at: dbRow.connected_at,
      isManual,
      hasTestConnection: !isManual && !!adapters[dbRow.key]?.testConnection,
      lastTestedAt: dbRow.last_tested_at,
      lastTestOk: dbRow.last_test_ok,
      lastTestError: dbRow.last_test_error,
      capability,
      definition,
      credentialId: credential?.id ?? null,
      credentialEnabled: credential ? credential.enabled : null,
      credentialFields,
      envFallbackConfigured,
      envPresence,
      envFallbackValues,
    } satisfies IntegrationCardRow;
  });
}

export default async function AdminIntegrationsPage() {
  const supabase = await createClient();

  const [
    { data: paymentProviders, error: ppError },
    { data: payoutProviders, error: poError },
    { data: verificationProviders, error: vpError },
    { data: recentEvents },
    { count: unprocessedCount },
    { count: failedPayoutCount },
    { data: notificationChannels, error: ncError },
    // Deliberately selects everything EXCEPT ciphertext — the encrypted
    // secret blob never needs to reach this Server Component, let alone
    // any client component it renders. RLS ("admin can read integration
    // credentials") gates this to admins regardless.
    { data: integrationCredentials, error: icError },
  ] = await Promise.all([
    supabase.from("payment_providers").select("*").order("created_at").returns<PaymentProvider[]>(),
    supabase.from("payout_providers").select("*").order("created_at").returns<PayoutProvider[]>(),
    supabase.from("verification_providers").select("*").order("created_at").returns<VerificationProvider[]>(),
    supabase
      .from("payment_provider_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<PaymentProviderEvent[]>(),
    supabase.from("payment_provider_events").select("id", { count: "exact", head: true }).eq("processed", false),
    supabase.from("payouts").select("id", { count: "exact", head: true }).eq("state", "failed"),
    supabase.from("notification_channels").select("*").order("created_at").returns<NotificationChannel[]>(),
    supabase
      .from("integration_credentials")
      .select("id, capability, provider_key, enabled, metadata")
      .returns<IntegrationCredentialRow[]>(),
  ]);

  const emailChannels = notificationChannels?.filter((c) => c.kind === "email") ?? [];
  const smsChannels = notificationChannels?.filter((c) => c.kind === "sms") ?? [];

  const credentialsByCapability: Record<IntegrationCapability, Map<string, IntegrationCredentialRow>> = {
    payment: new Map(),
    verification: new Map(),
    email: new Map(),
    sms: new Map(),
  };
  for (const row of integrationCredentials ?? []) {
    credentialsByCapability[row.capability]?.set(row.provider_key, row);
  }

  // payout_providers/payouts (migration_proposals/PROPOSED_automated_
  // provider_payouts.sql) haven't been applied to production — see
  // /admin/payouts's own audit note. Handled as its own honest "not live
  // yet" state below instead of one blanket error banner that used to
  // hide the working Payment/Verification provider sections underneath it
  // whenever only the payout query failed. Payout credentials are out of
  // scope for this pass for the same reason — nothing to configure yet.
  const payoutProvidersMissing = !!poError;

  const paymentRows = buildRows("payment", paymentProviders ?? [], paymentAdapters, credentialsByCapability.payment);
  const verificationRows = buildRows("verification", verificationProviders ?? [], verificationAdapters, credentialsByCapability.verification);
  const emailRows = buildRows("email", emailChannels, emailAdapters, credentialsByCapability.email);
  const smsRows = buildRows("sms", smsChannels, smsAdapters, credentialsByCapability.sms);
  const smsDefinitions = getProviderDefinitions("sms");

  const payoutRows: IntegrationCardRow[] = (payoutProviders ?? []).map((p) => ({
    key: p.key,
    display_name: p.display_name,
    is_active: p.is_active,
    connected_at: p.connected_at,
    isManual: false,
    hasTestConnection: false,
    lastTestedAt: null,
    lastTestOk: null,
    lastTestError: null,
    capability: "payment",
    definition: null,
    credentialId: null,
    credentialEnabled: null,
    credentialFields: {},
    envFallbackConfigured: !!process.env.INTASEND_PAYOUT_SECRET_KEY || !!process.env.INTASEND_SECRET_KEY,
    envPresence: {},
    envFallbackValues: {},
  }));

  const ENV_GROUPS: { label: string; vars: string[] }[] = [
    { label: "Payments (collections)", vars: ["PESAPAL_CONSUMER_KEY", "PESAPAL_CONSUMER_SECRET", "PESAPAL_IPN_ID", "INTASEND_SECRET_KEY", "INTASEND_PUBLIC_KEY"] },
    { label: "Payouts", vars: ["INTASEND_PAYOUT_SECRET_KEY"] },
    { label: "Identity verification", vars: ["KORA_SECRET_KEY"] },
    { label: "Email", vars: ["RESEND_API_KEY", "RESEND_WEBHOOK_SECRET", "SUPPORT_EMAIL_FROM"] },
    { label: "Ops alerting", vars: ["ALERT_EMAIL_TO", "ALERT_EMAIL_FROM"] },
    { label: "Core platform", vars: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET", "INTEGRATION_CREDENTIALS_ENCRYPTION_KEY"] },
  ];
  const envPresence: Record<string, boolean> = {};
  for (const g of ENV_GROUPS) for (const v of g.vars) envPresence[v] = !!process.env[v];

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Integrations</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        What Trusted Service connects to, what&apos;s actually working, and what each one is used
        for. Click <strong>Configure</strong> on any provider to enter its credentials — they&apos;re
        encrypted before they&apos;re stored and never shown again in full. Configuring a provider
        doesn&apos;t make it live: use <strong>Test connection</strong> to prove the saved credentials
        work, then <strong>Make active</strong> when you&apos;re ready to route real traffic to it.
        Adding a brand-new vendor still means writing one adapter file first (see{" "}
        <code>src/lib/payments/registry.ts</code> and <code>src/lib/verification/registry.ts</code>
        ). See <code>docs/16-payment-verification-integrations.md</code>.
      </p>

      {(ppError || vpError || icError) && <ErrorNotice message="Couldn't load the provider registry. Please refresh." />}

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-1">Payments</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Used by: <strong>customer checkout</strong> — collecting payment when a customer funds a
          booking (<code>/account/bookings/[id]</code>). Disconnecting the active aggregator falls
          back to manual M-Pesa Till/Paybill confirmation, not a broken checkout.
        </p>
        {paymentRows.length > 0 && <IntegrationCardList kind="payment" rows={paymentRows} />}
        {paymentProviders?.find((p) => p.is_active)?.key !== "manual" && (
          <p className="text-xs text-[var(--muted)] mt-2">
            Point the active aggregator&apos;s webhook dashboard at{" "}
            <code>/api/webhooks/payments</code> on this domain.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-1">
          Payouts
          {!!failedPayoutCount && (
            <span className="ml-2 text-xs text-[var(--danger)] font-normal">
              {failedPayoutCount} failed — see <Link href="/admin/payouts" className="underline">Payouts</Link>
            </span>
          )}
        </h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Used by: <strong>paying providers out</strong> of escrow after a job settles. Separate
          from payment providers above — collections (customer → escrow) and payouts (escrow →
          provider) are independent choices. Activating an aggregator here requires legal sign-off
          first, same gate as payment providers (<code>rpc_confirm_payout_provider_legal_signoff</code>
          — a deliberate no-UI, direct-SQL step; see the migration proposal for why).
        </p>
        {payoutProvidersMissing ? (
          <p className="text-xs text-[var(--muted)] bg-[var(--warn-tint)] rounded-[var(--radius-sm)] p-2.5">
            Not live in production yet — the wallet-model payout schema hasn&apos;t been applied. See{" "}
            <Link href="/admin/payouts" className="underline">Payouts</Link>. Credential configuration for
            payouts is out of scope until that schema exists.
          </p>
        ) : (
          <>
            {payoutRows.length > 0 && <IntegrationCardList kind="payout" rows={payoutRows} />}
            {payoutProviders?.find((p) => p.is_active) && (
              <p className="text-xs text-[var(--muted)] mt-2">
                Point the active payout vendor&apos;s webhook dashboard at{" "}
                <code>/api/webhooks/payouts</code> on this domain.
              </p>
            )}
          </>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-1">Identity verification</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Used by: <strong>provider onboarding</strong> — a National ID check surfaced to the admin
          verification queue during <code>/provider/apply</code>. A vendor result never flips a
          provider&apos;s <code>verification_status</code> by itself; an admin still makes that call
          at <Link href="/admin/verifications" className="underline">Verifications</Link> (see{" "}
          <code>docs/06-trust-architecture.md</code>) — this is a decision aid, not an
          auto-approval path.
        </p>
        {verificationRows.length > 0 && <IntegrationCardList kind="verification" rows={verificationRows} />}
        {verificationProviders?.find((p) => p.is_active)?.key !== "manual" && (
          <p className="text-xs text-[var(--muted)] mt-2">
            Point the active vendor&apos;s webhook dashboard (if it has one — see{" "}
            <code>src/lib/verification/adapters/kora.ts</code>) at{" "}
            <code>/api/webhooks/verification</code> on this domain.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-1">Email</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Used by: <strong>customer support</strong> only — the automatic acknowledgement sent when
          someone opens a support request, and agent replies sent by email
          (<code>src/lib/notifications/send-support-email.ts</code>). It is <strong>not</strong> used
          for account confirmation, password reset, or login emails — those are sent by Supabase
          Auth&apos;s own email settings (Supabase Dashboard → Authentication → Emails / SMTP
          provider), a completely separate system this page doesn&apos;t control. Ops alerts
          (<code>src/lib/alerts.ts</code>) also send via Resend directly through{" "}
          <code>RESEND_API_KEY</code>, bypassing this registry — a hardcoded safety valve, not
          switchable here.
        </p>
        {ncError && <ErrorNotice message="Couldn't load notification channels. Please refresh." />}
        {emailRows.length > 0 ? (
          <IntegrationCardList kind="notification" notificationKind="email" rows={emailRows} />
        ) : (
          <p className="text-xs text-[var(--muted)]">No email channel registered.</p>
        )}
        {emailChannels.find((c) => c.is_active) && (
          <p className="text-xs text-[var(--muted)] mt-2">
            Requires a verified sending domain with the active provider and its inbound webhook
            secret / support from-address set (see the Deployment-managed section of that
            provider&apos;s Configure panel). Point the provider&apos;s inbound webhook at{" "}
            <code>/api/webhooks/support-inbound</code> on this domain.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-1">SMS</h2>
        {smsDefinitions.length > 0 && smsRows.length > 0 ? (
          <>
            <p className="text-xs text-[var(--muted)] mb-3">
              Used by: customer support alerts, once a vendor is connected.
            </p>
            <IntegrationCardList kind="notification" notificationKind="sms" rows={smsRows} />
          </>
        ) : (
          <div className="card p-3">
            <span className="badge-muted">No SMS provider configured</span>
            <p className="text-xs text-[var(--muted)] mt-2">
              No SMS vendor is connected — <code>smsAdapters</code> in{" "}
              <code>src/lib/notifications/registry.ts</code> ships empty by design, and this page
              won&apos;t fabricate a provider that doesn&apos;t exist. Nothing in the app currently
              sends an SMS through this registry; support stays email-only until a vendor
              (Africa&apos;s Talking, Twilio, etc.) is added as a real adapter — see{" "}
              <code>docs/16-payment-verification-integrations.md</code> for how to add one, then
              register it in <code>src/lib/integrations/provider-schemas.ts</code> so this page can
              render a Configure form for it.
            </p>
            <p className="text-xs text-[var(--muted)] mt-2">
              This is separate from phone/OTP login, which already works today via{" "}
              <strong>Supabase Auth&apos;s own SMS provider</strong> (Supabase Dashboard →
              Authentication → Sign In / Providers → Phone) — a different system this page
              doesn&apos;t control, same distinction as email above.
            </p>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Storage</h2>
        <p className="text-xs text-[var(--muted)] mb-2">
          Supabase Storage buckets this app actually reads/writes — a static list of real bucket
          names referenced in code, not a live capacity/usage check (Storage usage isn&apos;t
          exposed via this app&apos;s Supabase role).
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["provider-documents", "support-attachments", "avatars", "provider-portfolio", "transaction-evidence"].map((b) => (
            <span key={b} className="badge-muted font-mono">
              {b}
            </span>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Database / system status</h2>
        <p className="text-xs text-[var(--muted)]">
          Scheduled job run history (cron health) and the live ledger balance check live on{" "}
          <Link href="/admin/system" className="underline">System</Link> and{" "}
          <Link href="/admin/ledger" className="underline">Ledger</Link> — not duplicated here.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-2">Environment variables — still required</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          Whether each Deployment-managed credential is set — presence only, never the value
          itself. These stay Vercel environment variables even after every provider above is fully
          configured from this page (see each provider&apos;s Configure panel → Deployment-managed
          for why). Read from real <code>process.env</code> at request time.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ENV_GROUPS.map((g) => (
            <div key={g.label} className="card p-3">
              <p className="text-xs font-semibold mb-1.5">{g.label}</p>
              <div className="space-y-1">
                {g.vars.map((v) => (
                  <div key={v} className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-[var(--muted)] truncate">{v}</span>
                    {envPresence[v] ? <span className="badge-trust flex-shrink-0">Set</span> : <span className="badge-danger flex-shrink-0">Missing</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
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
