"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import {
  setActivePaymentProvider,
  setActivePayoutProvider,
  setActiveVerificationProvider,
  setActiveNotificationChannel,
  testPaymentProvider,
  testVerificationProvider,
  testNotificationChannel,
  saveIntegrationCredential,
  setIntegrationCredentialEnabled,
  deleteIntegrationCredential,
} from "./actions";
import type { IntegrationCapability, ProviderDefinition } from "@/lib/integrations/provider-schemas";

export interface CredentialFieldMeta {
  label: string;
  secret: boolean;
  masked?: string;
  value?: string;
}

export interface IntegrationCardRow {
  key: string;
  display_name: string;
  is_active: boolean;
  connected_at: string | null;
  /** true for a row with no real vendor adapter behind it (e.g. "manual") — no credentials, no test-connection concept. */
  isManual: boolean;
  /** Whether the underlying adapter implements testConnection() at all. */
  hasTestConnection: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
  capability: IntegrationCapability;
  /** The schema this provider's Configure form renders from — null only for a provider not in PROVIDER_DEFINITIONS (shouldn't happen for a real row). */
  definition: ProviderDefinition | null;
  /** integration_credentials.id once something has been saved, else null. */
  credentialId: string | null;
  /** null = nothing saved yet; true/false once a row exists. */
  credentialEnabled: boolean | null;
  /** From integration_credentials.metadata.fields — masked previews / non-secret values, never a real secret. */
  credentialFields: Record<string, CredentialFieldMeta>;
  /** Whether this deployment's env vars alone (no saved credential) satisfy every required schema field. */
  envFallbackConfigured: boolean;
  /** Presence (never the value) of every configurationSchema + deploymentManagedFields env var this provider can use. */
  envPresence: Record<string, boolean>;
  /** Actual values of this deployment's env vars for non-secret fields only (e.g. INTASEND_ENV="sandbox") — safe to render client-side since the schema itself marks these non-secret. */
  envFallbackValues: Record<string, string>;
}

type Kind = "payment" | "payout" | "verification" | "notification";

function statusBadge(row: IntegrationCardRow): { label: string; tone: "trust" | "warn" | "danger" | "muted" } {
  if (row.isManual) return row.is_active ? { label: "Active", tone: "trust" } : { label: "Available", tone: "muted" };
  if (row.credentialEnabled === false) return { label: "Disabled", tone: "muted" };
  const configured = row.credentialEnabled === true || row.envFallbackConfigured;
  if (!configured) return { label: "Not configured", tone: "warn" };
  if (row.lastTestedAt == null) return { label: "Configured — not tested", tone: "muted" };
  if (row.lastTestOk) return { label: "Connected", tone: "trust" };
  return { label: "Connection error", tone: "danger" };
}

/** Any *_ENV select field (INTASEND_ENV, PESAPAL_ENV) doubles as the Sandbox/Production badge. */
function environmentBadge(row: IntegrationCardRow): string | null {
  const envFieldKey = row.definition?.configurationSchema.find((f) => f.key.endsWith("_ENV"))?.key;
  if (!envFieldKey) return null;
  const value = row.credentialFields[envFieldKey]?.value ?? row.envFallbackValues[envFieldKey];
  if (value === "production") return "Production";
  if (value === "sandbox") return "Sandbox";
  return null;
}

const badgeClass: Record<"trust" | "warn" | "danger" | "muted", string> = {
  trust: "badge-trust",
  warn: "badge-warn",
  danger: "badge-danger",
  muted: "badge-muted",
};

export function IntegrationCardList({
  kind,
  rows,
  notificationKind,
}: {
  kind: Kind;
  rows: IntegrationCardRow[];
  notificationKind?: "email" | "sms";
}) {
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {rows.map((row) => (
        <IntegrationCard key={row.key} kind={kind} row={row} notificationKind={notificationKind} />
      ))}
    </div>
  );
}

function IntegrationCard({ kind, row, notificationKind }: { kind: Kind; row: IntegrationCardRow; notificationKind?: "email" | "sms" }) {
  const [activateError, setActivateError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [isActivating, startActivating] = useTransition();
  const [isTesting, startTesting] = useTransition();

  const activateAction =
    kind === "payment"
      ? setActivePaymentProvider
      : kind === "payout"
        ? setActivePayoutProvider
        : kind === "verification"
          ? setActiveVerificationProvider
          : setActiveNotificationChannel;

  const status = statusBadge(row);
  const envBadge = environmentBadge(row);

  function handleActivate() {
    setActivateError(null);
    startActivating(async () => {
      const res = await activateAction(row.key);
      if (res?.error) setActivateError(res.error);
    });
  }

  function handleTest() {
    setTestResult(null);
    startTesting(async () => {
      const res =
        kind === "payment"
          ? await testPaymentProvider(row.key)
          : kind === "verification"
            ? await testVerificationProvider(row.key)
            : kind === "notification" && notificationKind
              ? await testNotificationChannel(row.key, notificationKind)
              : { error: "Connection testing isn't available for this category yet." };
      if ("error" in res && res.error) {
        setTestResult({ ok: false, message: res.error });
      } else {
        setTestResult({ ok: true, message: "Connection succeeded." });
      }
    });
  }

  return (
    <div className="card p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{row.display_name}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className={badgeClass[status.tone]}>{status.label}</span>
            {envBadge && <span className="badge-muted">{envBadge}</span>}
            {row.is_active && !row.isManual && <span className="badge-trust">Active</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!row.isManual && row.definition && row.definition.configurationSchema.length > 0 && (
            <button type="button" className="btn-secondary text-xs" onClick={() => setConfigureOpen(true)}>
              Configure
            </button>
          )}
          {!row.is_active && (
            <button type="button" className="btn-secondary text-xs" disabled={isActivating} onClick={handleActivate}>
              {isActivating ? "Activating…" : "Make active"}
            </button>
          )}
          {row.hasTestConnection && (
            <button type="button" className="btn-secondary text-xs" disabled={isTesting} onClick={handleTest}>
              {isTesting ? "Testing…" : "Test connection"}
            </button>
          )}
        </div>
      </div>

      {!row.isManual && !row.hasTestConnection && (
        <p className="text-xs text-[var(--muted)]">No automated connectivity check for this provider — verify manually against its dashboard.</p>
      )}

      {row.lastTestedAt && (
        <p className={`text-xs ${row.lastTestOk ? "text-[var(--muted)]" : "text-[var(--danger)]"}`}>
          Last tested {new Date(row.lastTestedAt).toLocaleString()}
          {!row.lastTestOk && row.lastTestError ? ` — ${row.lastTestError}` : ""}
        </p>
      )}

      {testResult && (
        <p className={`text-xs ${testResult.ok ? "text-[var(--trust)]" : "text-[var(--danger)]"}`}>{testResult.message}</p>
      )}
      {activateError && <p className="text-xs text-[var(--danger)]">{activateError}</p>}

      {configureOpen && row.definition && <ConfigurePanel row={row} definition={row.definition} onClose={() => setConfigureOpen(false)} />}
    </div>
  );
}

function ConfigurePanel({
  row,
  definition,
  onClose,
}: {
  row: IntegrationCardRow;
  definition: ProviderDefinition;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of definition.configurationSchema) {
      if (!field.secret) initial[field.key] = row.credentialFields[field.key]?.value ?? row.envFallbackValues[field.key] ?? field.defaultValue ?? "";
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isToggling, startToggling] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);
    startSaving(async () => {
      const res = await saveIntegrationCredential(row.capability, row.key, values);
      if (res?.error) setError(res.error);
      else setSaved(true);
    });
  }

  function handleToggleEnabled() {
    if (!row.credentialId) return;
    setError(null);
    startToggling(async () => {
      const res = await setIntegrationCredentialEnabled(row.credentialId!, row.credentialEnabled === false);
      if (res?.error) setError(res.error);
    });
  }

  function handleDelete() {
    if (!row.credentialId) return;
    if (!window.confirm(`Remove the saved ${definition.name} credentials? This can't be undone — you'll need to re-enter them to reconnect.`)) return;
    setError(null);
    startDeleting(async () => {
      const res = await deleteIntegrationCredential(row.credentialId!);
      if (res?.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <>
      <div className="admin-drawer-overlay" onClick={onClose} />
      <div className="admin-drawer-panel" role="dialog" aria-modal="true" aria-label={`Configure ${definition.name}`}>
        <div className="p-4 flex items-start justify-between gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <p className="font-bold">{definition.name}</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">{definition.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--foreground)] flex-shrink-0">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {definition.configurationSchema.map((field) => {
              const existingMasked = row.credentialFields[field.key]?.masked;
              return (
                <label key={field.key} className="text-xs font-medium flex flex-col gap-1">
                  <span>
                    {field.label}
                    {field.required && <span className="text-[var(--danger)]"> *</span>}
                  </span>
                  {field.type === "select" ? (
                    <select
                      value={values[field.key] ?? field.defaultValue ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === "password" ? "password" : field.type === "url" ? "url" : "text"}
                      value={values[field.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      placeholder={existingMasked ? `Currently ${existingMasked} — leave blank to keep it` : field.placeholder}
                      autoComplete="off"
                    />
                  )}
                  {field.helpText && <span className="text-[var(--muted)] font-normal">{field.helpText}</span>}
                </label>
              );
            })}
          </div>

          {definition.deploymentManagedFields && definition.deploymentManagedFields.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5">Deployment-managed</p>
              <p className="text-xs text-[var(--muted)] mb-2">
                Set once as a Vercel environment variable, not from this page — checked on every inbound webhook, so it can&apos;t safely wait on a database read.
              </p>
              <div className="space-y-1.5">
                {definition.deploymentManagedFields.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--muted)]">{f.label}</span>
                    {row.envPresence[f.key] ? <span className="badge-trust">Set</span> : <span className="badge-danger">Missing</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          {saved && !error && <p className="text-xs text-[var(--trust)]">Saved. Use Test connection on the card to verify it, then Make active when ready.</p>}
        </div>

        <div className="p-4 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button type="button" className="btn-primary text-sm" disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Saving…" : "Save"}
          </button>
          {row.credentialId && (
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-xs flex-1" disabled={isToggling} onClick={handleToggleEnabled}>
                {isToggling ? "Working…" : row.credentialEnabled === false ? "Enable" : "Disable"}
              </button>
              <button type="button" className="btn-secondary text-xs flex-1 text-[var(--danger)]" disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? "Removing…" : "Remove"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
