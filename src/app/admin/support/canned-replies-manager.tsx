"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertCannedReply, deleteCannedReply } from "./actions";

type CannedReply = { id: string; title: string; body: string };

export function CannedRepliesManager({ replies }: { replies: CannedReply[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <details className="card mb-6 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Manage canned replies ({replies.length})</summary>

      <div className="mt-3 flex flex-col gap-2">
        {replies.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-2 border-b border-[var(--border)] pb-2 text-sm">
            <div>
              <p className="font-medium">{r.title}</p>
              <p className="text-xs text-[var(--muted)] line-clamp-2">{r.body}</p>
            </div>
            <button
              type="button"
              className="shrink-0 text-xs text-[var(--danger)]"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await deleteCannedReply(r.id);
                  router.refresh();
                })
              }
            >
              Delete
            </button>
          </div>
        ))}

        <div className="mt-2 flex flex-col gap-2">
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
          <textarea placeholder="Reply text" rows={3} value={body} onChange={(e) => setBody(e.target.value)} className="text-sm" />
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          <button
            type="button"
            className="btn-secondary self-start text-xs"
            disabled={isPending || !title.trim() || !body.trim()}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await upsertCannedReply({ title, body });
                if (res?.error) setError(res.error);
                else {
                  setTitle("");
                  setBody("");
                  router.refresh();
                }
              })
            }
          >
            Add canned reply
          </button>
        </div>
      </div>
    </details>
  );
}
