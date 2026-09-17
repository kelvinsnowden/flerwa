"use client";

import { useState, useTransition } from "react";
import {
  setActivePaymentProvider,
  setActivePayoutProvider,
  setActiveVerificationProvider,
  setActiveNotificationChannel,
  testPaymentProvider,
  testVerificationProvider,
  testNotificationChannel,
} from "./actions";

export interface IntegrationCardRow {
  key: string;
  display_name: string;
  is_active: boolean;
  connected_at: string | null;
  /** true for a row with no real vendor adapter behind it (e.g. "manual") — no env vars, no test-connection concept. */
  isManual: boolean;
  /** Whether this row's env vars are all present. Meaningless (and unused) when isManual. */
  envConfigured: boolean;
  /** Whether the underlying adapter implements testConnection() at all. */
  hasTestConnection: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestError: string | null;
}

type Kind = "payment" | "payout" | "verification" | "notification";

function statusBadge(row: IntegrationCardRow): { label: string; tone: "trust" | "warn" | "danger" | "muted" } {
  if (row.isManual) return row.is_active ? { label: "Active", tone: "trust" } : { label: "Available", tone: "muted" };
  if (!row.envConfigured) return { label: "Not configured", tone: "warn" };
  if (row.lastTestedAt == null) return { label: "Configured — not tested", tone: "muted" };
  if (row.lastTestOk) return { label: "Connected", tone: "trust" };
  return { label: "Connection error", tone: "danger" };
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
            {row.is_active && !row.isManual && <span className="badge-trust">Active</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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
    </div>
  );
}
