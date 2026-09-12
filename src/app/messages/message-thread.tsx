"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";
import type { Message } from "@/lib/types";
import { sendMessage, markThreadRead } from "./actions";

type ThreadRef = { transactionId: string } | { conversationId: string };

// How many messages the server page loads up front (see the two
// [transactionId]/[conversationId] page.tsx files) — kept here so both
// sides of the "how many messages is a full page" contract stay in sync,
// and reused below as the page size for "load earlier" too.
export const THREAD_PAGE_SIZE = 60;

export function MessageThread({
  thread,
  currentUserId,
  initialMessages,
  initialHasMoreOlder,
}: {
  thread: ThreadRef;
  currentUserId: string;
  initialMessages: Message[];
  initialHasMoreOlder: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [hasMoreOlder, setHasMoreOlder] = useState(initialHasMoreOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const column = "transactionId" in thread ? "transaction_id" : "conversation_id";
  const id = "transactionId" in thread ? thread.transactionId : thread.conversationId;

  // Cursor pagination for history older than what the server page loaded —
  // the same RLS policy that scoped the server-side fetch scopes this
  // client-side one, so this can only ever reach messages the signed-in
  // user was already allowed to read.
  async function loadOlder() {
    if (messages.length === 0 || loadingOlder) return;
    setLoadingOlder(true);
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("messages")
      .select("*")
      .eq(column, id)
      .lt("created_at", messages[0].created_at)
      .order("created_at", { ascending: false })
      .limit(THREAD_PAGE_SIZE)
      .returns<Message[]>();
    setLoadingOlder(false);
    if (fetchError || !data) return;
    setHasMoreOlder(data.length === THREAD_PAGE_SIZE);
    setMessages((prev) => {
      const existing = new Set(prev.map((m) => m.id));
      const older = data.filter((m) => !existing.has(m.id)).reverse();
      return [...older, ...prev];
    });
  }

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

  // Scroll to the newest message only when one actually arrives at the
  // end (a send, or a realtime insert) — not when "Load earlier" prepends
  // older history, which should keep the reader's place instead of
  // yanking them back down to the bottom.
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId]);

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
        {hasMoreOlder && (
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingOlder}
            className="self-center text-xs font-semibold py-1.5 px-3 rounded-full"
            style={{ color: "var(--trust)", background: "var(--surface)" }}
          >
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
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
