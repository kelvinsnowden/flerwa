"use client";

import { useState, useTransition } from "react";
import type { Provider } from "@/lib/types";
import { setVerificationStatus, setCategoryClearance, publishProvider } from "./actions";

interface Props {
  provider: Provider & {
    docs: { id: string; kind: string; url: string | null; status: string }[];
    provider_categories: { category_id: string; is_cleared: boolean; categories: { name: string } }[];
  };
  categories: { id: string; name: string }[];
}

export function VerificationCard({ provider, categories }: Props) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const clearedIds = new Set(provider.provider_categories.filter((c) => c.is_cleared).map((c) => c.category_id));

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{provider.display_name}</p>
          <p className="text-xs text-[var(--muted)]">{provider.headline}</p>
        </div>
        <span className="badge-warn">{provider.verification_status}</span>
      </div>

      {provider.bio && <p className="text-sm mt-2">{provider.bio}</p>}

      {provider.docs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {provider.docs.map((doc) =>
            doc.url ? (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs badge-trust"
              >
                View {doc.kind}
              </a>
            ) : (
              <span key={doc.id} className="text-xs text-[var(--muted)]">
                {doc.kind} (no file)
              </span>
            )
          )}
        </div>
      )}
      {provider.docs.length === 0 && (
        <p className="text-xs text-[var(--muted)] mt-2">No documents submitted yet.</p>
      )}

      <div className="mt-3">
        <p className="text-xs font-medium mb-1">Category clearance</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const cleared = clearedIds.has(cat.id);
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
        </div>
      </div>

      <textarea
        className="mt-3"
        rows={2}
        placeholder="Notes (recorded either way)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {error && <p className="text-sm text-[var(--danger)] mt-1">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          className="btn-primary text-sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await setVerificationStatus(provider.id, "verified", notes);
              if (res?.error) setError(res.error);
            })
          }
        >
          Approve
        </button>
        <button
          className="btn-secondary text-sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await setVerificationStatus(provider.id, "rejected", notes);
              if (res?.error) setError(res.error);
            })
          }
        >
          Reject
        </button>
        {provider.verification_status === "verified" && (
          <button
            className="btn-secondary text-sm ml-auto"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await publishProvider(provider.id, !provider.is_published);
                if (res?.error) setError(res.error);
              })
            }
          >
            {provider.is_published ? "Unpublish" : "Publish storefront"}
          </button>
        )}
      </div>
    </div>
  );
}
