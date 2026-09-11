"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";
import type { Message } from "@/lib/types";
import { sendMessage, markThreadRead } from "./actions";

type ThreadRef = { transactionId: string } | { conversationId: string };

export function MessageThread({
  thread,
  currentUserId,
  initialMessages,
}: {
  thread: ThreadRef;
  currentUserId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const column = "transactionId" in thread ? "transaction_id" : "conversation_id";
  const id = "transactionId" in thread ? thread.transactionId : thread.conversationId;

  // Real-time: any message inserted on this thread (by either side) is
  // pushed straight into the postgres_changes stream — no polling. Falls
  // back to whatever was fetched server-side if the socket never connects
  // (e.g. blocked network), so the thread still works, just without live
  // updates until the next navigation.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${column}:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `${column}=eq.${id}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [column, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (messages.some((m) => m.sender_id !== currentUserId && !m.read_at)) {
      void markThreadRead(thread);
    }
    // Only re-check when new messages arrive, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, column, id, currentUserId]);

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    setDraft("");
    startTransition(async () => {
      const res = await sendMessage(thread, body);
      if (res?.error) {
        setError(res.error);
        setDraft(body);
      }
    });
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--muted)] text-center mt-8">
            Say hello — messages here are only visible to the two of you.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm"
                style={
                  mine
                    ? { background: "var(--trust)", color: "white", borderBottomRightRadius: 4 }
                    : { background: "var(--surface)", color: "var(--foreground)", borderBottomLeftRadius: 4 }
                }
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p
                  className="text-[10px] mt-1 text-right"
                  style={{ color: mine ? "rgba(255,255,255,0.75)" : "var(--muted-2)" }}
                >
                  {new Date(m.created_at).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 sticky bottom-0 bg-[var(--card)]">
        {error && <p className="notice-error mb-2">{error}</p>}
        <div className="flex gap-2 items-end">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message…"
            rows={1}
            className="flex-1"
            style={{ minHeight: "2.75rem", maxHeight: "6rem" }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending || !draft.trim()}
            className="btn-primary flex-shrink-0"
            style={{ padding: "0.75rem", minWidth: "2.75rem" }}
            aria-label="Send message"
          >
            <Icon name="send" size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
