"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startConversation } from "@/app/messages/actions";
import { Icon } from "./icon";

export function MessageButton({
  providerId,
  serviceId,
  isSignedIn,
  size = "md",
}: {
  providerId: string;
  serviceId?: string;
  isSignedIn: boolean;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dims = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isSignedIn) {
            router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
            return;
          }
          setOpen(true);
        }}
        className={`${dims} flex-shrink-0 rounded-full flex items-center justify-center gap-1.5 border border-[var(--border)] bg-[var(--card)] font-semibold transition-colors hover:border-[var(--trust)]`}
      >
        <Icon name="message-circle" size={size === "sm" ? 14 : 16} />
        Message
      </button>
    );
  }

  return (
    <div
      className="card p-3 w-full"
      onClick={(e) => e.stopPropagation()}
    >
      {error && <p className="notice-error mb-2 text-xs">{error}</p>}
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Ask about availability, pricing, or details…"
        rows={2}
        className="w-full text-sm"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          className="btn-ghost text-xs px-3 py-1.5"
          onClick={(e) => {
            e.preventDefault();
            setOpen(false);
            setDraft("");
            setError(null);
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending || !draft.trim()}
          className="btn-primary text-xs px-3 py-1.5"
          onClick={(e) => {
            e.preventDefault();
            const body = draft.trim();
            if (!body) return;
            setError(null);
            startTransition(async () => {
              const res = await startConversation(providerId, body, serviceId);
              if (res.error) {
                setError(res.error);
                return;
              }
              router.push(`/messages/c/${res.conversationId}`);
            });
          }}
        >
          {isPending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
