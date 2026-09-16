"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { formatRelativeTime } from "@/lib/relative-time";
import { StatusBadge } from "./status-badge";
import { setVerificationStatus, setCategoryClearance, publishProvider } from "./actions";
import { getVerificationDrawerDetail, type DrawerDetail } from "./drawer-actions";
import type { VerificationRow } from "./page";

type DrawerTab = "overview" | "documents" | "notes";

const ACTION_LABEL: Record<string, (payload: Record<string, unknown>) => string> = {
  set_verification_status: (p) => `Status set to "${p.status}"`,
  set_category_clearance: (p) => `Category clearance ${p.cleared ? "granted" : "removed"}`,
  set_provider_published: (p) => (p.publish ? "Storefront published" : "Storefront unpublished"),
};

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function VerificationDrawer({
  provider,
  categories,
  onClose,
}: {
  provider: VerificationRow;
  categories: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [detail, setDetail] = useState<DrawerDetail | { error: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getVerificationDrawerDetail(provider.id).then((result) => {
      if (!cancelled) setDetail(result);
    });
    return () => {
      cancelled = true;
    };
  }, [provider.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (previewUrl) setPreviewUrl(null);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, previewUrl]);

  const clearedIds = new Set(provider.provider_categories.filter((c) => c.is_cleared).map((c) => c.category_id));
  const activity = detail && !("error" in detail) ? detail.activity : [];
  const priorNotes = activity.filter((a) => a.action === "set_verification_status" && a.payload.notes);

  function decide(status: "verified" | "rejected") {
    startTransition(async () => {
      setError(null);
      const res = await setVerificationStatus(provider.id, status, notes);
      if (res?.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <>
      <div className="admin-drawer-overlay" onClick={onClose} />
      <div className="admin-drawer-panel" role="dialog" aria-modal="true" aria-label={provider.display_name}>
        <div className="p-4 flex items-start gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          {provider.profiles?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={provider.profiles.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
          ) : (
            <span className="avatar h-12 w-12 text-sm flex-shrink-0">{initialsOf(provider.display_name)}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold truncate">{provider.display_name}</p>
            <p className="text-xs text-[var(--muted)] truncate">{provider.headline}</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {provider.locations ? `${provider.locations.town}, ${provider.locations.county}` : "No location on file"}
            </p>
            {provider.profiles?.email && <p className="text-xs text-[var(--muted)] truncate">{provider.profiles.email}</p>}
            {provider.profiles?.phone && <p className="text-xs text-[var(--muted)]">{provider.profiles.phone}</p>}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--foreground)]">
              <Icon name="x" size={18} />
            </button>
            <StatusBadge status={provider.verification_status} />
          </div>
        </div>

        <div className="flex gap-1 px-4 pt-2" style={{ borderBottom: "1px solid var(--border)" }}>
          {(["overview", "documents", "notes"] as DrawerTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className="text-sm font-medium px-3 py-2 capitalize"
              style={{
                color: tab === t ? "var(--trust-dark)" : "var(--muted)",
                borderBottom: tab === t ? "2px solid var(--trust)" : "2px solid transparent",
              }}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "overview" && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] mb-1">About</p>
              <p className="text-sm mb-4">{provider.bio || "No bio provided."}</p>

              <p className="text-xs font-semibold text-[var(--muted)] mb-1.5">Categories</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {categories.map((cat) => {
                  const cleared = clearedIds.has(cat.id);
                  const hasCategory = provider.provider_categories.some((c) => c.category_id === cat.id);
                  if (!hasCategory) return null;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={isPending}
                      className={cleared ? "badge-trust" : "badge-warn"}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await setCategoryClearance(provider.id, cat.id, !cleared);
                          if (res?.error) setError(res.error);
                        })
                      }
                    >
                      {cat.name} {cleared ? "✓" : "— clear"}
                    </button>
                  );
                })}
                {provider.provider_categories.length === 0 && <p className="text-xs text-[var(--muted)]">No categories selected.</p>}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="stat-tile">
                  <p className="text-sm font-bold">{provider.is_published ? "Live" : "Not live"}</p>
                  <p className="text-[10px] text-[var(--muted)]">Storefront</p>
                </div>
                <div className="stat-tile">
                  <p className="text-sm font-bold">{provider.is_suspended ? "Suspended" : "Active"}</p>
                  <p className="text-[10px] text-[var(--muted)]">Account</p>
                </div>
                <div className="stat-tile">
                  <p className="text-sm font-bold">{new Date(provider.created_at).toLocaleDateString("en-KE")}</p>
                  <p className="text-[10px] text-[var(--muted)]">Joined</p>
                </div>
              </div>

              <p className="text-xs font-semibold text-[var(--muted)] mb-1.5">Recent activity</p>
              {!detail ? (
                <p className="text-xs text-[var(--muted)]">Loading…</p>
              ) : "error" in detail ? (
                <p className="text-xs text-[var(--danger)]">Couldn&apos;t load activity: {detail.error}</p>
              ) : activity.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">No recorded activity yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {activity.map((a) => (
                    <li key={a.id} className="text-xs">
                      <span className="font-medium">{ACTION_LABEL[a.action]?.(a.payload) ?? a.action}</span>
                      <span className="text-[var(--muted)]"> · {a.admin_name ?? "Admin"} · {formatRelativeTime(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "documents" && (
            <div>
              {!detail ? (
                <p className="text-sm text-[var(--muted)]">Loading…</p>
              ) : "error" in detail ? (
                <p className="text-sm text-[var(--danger)]">Couldn&apos;t load documents: {detail.error}</p>
              ) : detail.documents.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No documents submitted yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {detail.documents.map((doc) => (
                    <div key={doc.id} className="card p-3 flex items-center gap-3">
                      <span className="h-9 w-9 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0" style={{ background: "var(--surface)" }}>
                        <Icon name="file-text" size={16} className="text-[var(--muted)]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize truncate">{doc.kind.replace(/_/g, " ")}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {doc.status === "verified" ? (
                            <span className="text-[var(--trust-dark)]">✓ Verified</span>
                          ) : (
                            doc.status
                          )}
                        </p>
                      </div>
                      {doc.url ? (
                        <button type="button" className="btn-secondary text-xs px-2.5 py-1.5 flex-shrink-0" onClick={() => setPreviewUrl(doc.url)}>
                          Preview
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--muted)] flex-shrink-0">No file</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {detail && !("error" in detail) && detail.checks.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-[var(--muted)] mb-1.5">Automated checks</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.checks.map((c, i) => (
                      <span key={i} className={c.status === "passed" ? "badge-trust" : "badge-warn"} title={new Date(c.created_at).toLocaleString()}>
                        {c.provider_key}: {c.check_type} — {c.status}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--muted)] mt-1">Informational only — never changes verification status automatically.</p>
                </div>
              )}
            </div>
          )}

          {tab === "notes" && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] mb-1.5">Add a note</p>
              <textarea
                rows={3}
                placeholder="Add notes about this application..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm"
              />
              <p className="text-[10px] text-[var(--muted)] mt-1 mb-4">Saved together with your Approve or Reject decision below.</p>

              <p className="text-xs font-semibold text-[var(--muted)] mb-1.5">Previous notes</p>
              {!detail ? (
                <p className="text-xs text-[var(--muted)]">Loading…</p>
              ) : "error" in detail ? (
                <p className="text-xs text-[var(--danger)]">{detail.error}</p>
              ) : priorNotes.length === 0 ? (
                <p className="text-xs text-[var(--muted)]">No notes recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {priorNotes.map((a) => (
                    <li key={a.id} className="card p-2.5 text-xs">
                      <p>{String(a.payload.notes)}</p>
                      <p className="text-[var(--muted)] mt-1">
                        {a.admin_name ?? "Admin"} · {formatRelativeTime(a.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-[var(--danger)] px-4">{error}</p>}

        <div className="p-4 flex gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button type="button" className="btn-danger flex-1" disabled={isPending} onClick={() => decide("rejected")}>
            {isPending ? "Working…" : "Reject"}
          </button>
          <button type="button" className="btn-primary flex-1" disabled={isPending} onClick={() => decide("verified")}>
            {isPending ? "Working…" : "Approve Provider"}
          </button>
        </div>
        {provider.verification_status === "verified" && (
          <div className="px-4 pb-4">
            <button
              type="button"
              className="btn-secondary w-full text-sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const res = await publishProvider(provider.id, !provider.is_published);
                  if (res?.error) setError(res.error);
                })
              }
            >
              {provider.is_published ? "Unpublish storefront" : "Publish storefront"}
            </button>
          </div>
        )}
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <button type="button" className="absolute top-4 right-4 text-white" onClick={() => setPreviewUrl(null)} aria-label="Close preview">
            <Icon name="x" size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Document preview" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
