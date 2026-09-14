"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  replyToConversation,
  addInternalNote,
  assignConversation,
  setConversationStatus,
  setConversationPriority,
  setConversationCategory,
  setConversationTags,
} from "../actions";

type Message = {
  id: string;
  sender_type: "customer" | "agent" | "system";
  author_name: string | null;
  author_email: string | null;
  body: string;
  is_internal_note: boolean;
  created_at: string;
};

type Option = { id: string; name: string };
type CannedReply = { id: string; title: string; body: string };

export function ConversationWorkspace({
  conversationId,
  messages,
  status,
  priority,
  categoryId,
  assignedTo,
  tagIds,
  categories,
  tags,
  admins,
  cannedReplies,
}: {
  conversationId: string;
  messages: Message[];
  status: string;
  priority: string;
  categoryId: string | null;
  assignedTo: string | null;
  tagIds: string[];
  categories: Option[];
  tags: Option[];
  admins: Option[];
  cannedReplies: CannedReply[];
}) {
  const router = useRouter();
  const [replyBody, setReplyBody] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_260px]">
      <div>
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`card p-3 ${m.is_internal_note ? "" : m.sender_type === "customer" ? "mr-6" : "ml-6"}`}
              style={
                m.is_internal_note
                  ? { background: "var(--warn-tint)", borderColor: "var(--warn)" }
                  : m.sender_type === "agent"
                    ? { background: "var(--trust-tint)", borderColor: "var(--trust-tint-strong)" }
                    : undefined
              }
            >
              <p className="mb-1 text-xs font-semibold text-[var(--muted)]">
                {m.is_internal_note ? "🔒 Internal note — " : ""}
                {m.sender_type === "customer" ? m.author_name || m.author_email || "Customer" : m.author_name || "Agent"}
                <span className="ml-2 font-normal">{new Date(m.created_at).toLocaleString()}</span>
              </p>
              <p className="whitespace-pre-wrap text-sm">{m.body}</p>
            </div>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
        {notice && <p className="mt-3 text-sm text-[var(--muted)]">{notice}</p>}

        <div className="card mt-4 flex flex-col gap-2 p-4">
          <p className="text-sm font-semibold">Reply to customer</p>
          {cannedReplies.length > 0 && (
            <select
              className="text-sm"
              defaultValue=""
              onChange={(e) => {
                const canned = cannedReplies.find((c) => c.id === e.target.value);
                if (canned) setReplyBody(canned.body);
                e.target.value = "";
              }}
            >
              <option value="">Insert canned reply…</option>
              {cannedReplies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
          <textarea
            rows={4}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write a reply — this sends as a real email to the customer."
          />
          <button
            className="btn-primary self-start"
            disabled={isPending || !replyBody.trim()}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                setNotice(null);
                const res = await replyToConversation(conversationId, replyBody);
                if (res?.error) setError(res.error);
                else {
                  setReplyBody("");
                  if (res?.emailWarning) setNotice(`Reply saved, but the email did not send: ${res.emailWarning}`);
                  refresh();
                }
              })
            }
          >
            {isPending ? "Sending…" : "Send reply"}
          </button>
        </div>

        <div className="card mt-4 flex flex-col gap-2 p-4">
          <p className="text-sm font-semibold">Internal note (never sent to the customer)</p>
          <textarea rows={2} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Note for the next agent…" />
          <button
            className="btn-secondary self-start"
            disabled={isPending || !noteBody.trim()}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await addInternalNote(conversationId, noteBody);
                if (res?.error) setError(res.error);
                else {
                  setNoteBody("");
                  refresh();
                }
              })
            }
          >
            {isPending ? "Saving…" : "Add note"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold text-[var(--muted)]">
          Status
          <select
            className="mt-1 text-sm"
            defaultValue={status}
            disabled={isPending}
            onChange={(e) => startTransition(async () => { await setConversationStatus(conversationId, e.target.value); refresh(); })}
          >
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className="text-xs font-semibold text-[var(--muted)]">
          Priority
          <select
            className="mt-1 text-sm"
            defaultValue={priority}
            disabled={isPending}
            onChange={(e) => startTransition(async () => { await setConversationPriority(conversationId, e.target.value); refresh(); })}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>

        <label className="text-xs font-semibold text-[var(--muted)]">
          Category
          <select
            className="mt-1 text-sm"
            defaultValue={categoryId ?? ""}
            disabled={isPending}
            onChange={(e) => startTransition(async () => { await setConversationCategory(conversationId, e.target.value || null); refresh(); })}
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-[var(--muted)]">
          Assigned to
          <select
            className="mt-1 text-sm"
            defaultValue={assignedTo ?? ""}
            disabled={isPending}
            onChange={(e) => startTransition(async () => { await assignConversation(conversationId, e.target.value || null); refresh(); })}
          >
            <option value="">Unassigned</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <div className="text-xs font-semibold text-[var(--muted)]">
          Tags
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((t) => {
              const active = tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={isPending}
                  className={active ? "badge-trust" : "badge-muted"}
                  onClick={() =>
                    startTransition(async () => {
                      const next = active ? tagIds.filter((id) => id !== t.id) : [...tagIds, t.id];
                      await setConversationTags(conversationId, next);
                      refresh();
                    })
                  }
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
