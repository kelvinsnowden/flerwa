import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import type { Message } from "@/lib/types";

interface TxnRow {
  id: string;
  customer_id: string;
  last_message_at: string | null;
  services: { name: string } | null;
  providers: { display_name: string; user_id: string; profiles: { avatar_url: string | null } | null } | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  messages: Message[];
}

interface ConvRow {
  id: string;
  customer_id: string;
  last_message_at: string | null;
  services: { name: string } | null;
  providers: { display_name: string; user_id: string; profiles: { avatar_url: string | null } | null } | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  messages: Message[];
}

interface ThreadEntry {
  key: string;
  href: string;
  otherName: string;
  otherPhotoUrl: string | null;
  serviceLabel: string;
  latest: Message;
  unread: number;
}

// How many threads to show per type (transaction-scoped, conversation-
// scoped) on the first load. "Load older conversations" grows this by the
// same amount. Capped (see MAX_LIMIT below) so the URL itself can never be
// used to force this back into an unbounded query.
const PAGE_SIZE = 40;
const MAX_LIMIT = 400;

export default async function MessagesInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/messages");

  const { limit: limitParam } = await searchParams;
  const requested = parseInt(limitParam ?? "", 10);
  const limit = Number.isFinite(requested) && requested > PAGE_SIZE ? Math.min(requested, MAX_LIMIT) : PAGE_SIZE;

  // Bounded by thread count, not message history: each thread contributes
  // exactly one (its latest) message row, however long its history is.
  // See MARKETPLACE_SCALE_READINESS_AUDIT.md — the previous version of
  // this page fetched every message the user had ever sent or received.
  const [txnThreadsRes, convThreadsRes] = await Promise.all([
    supabase
      .from("service_transactions")
      .select(
        "id, customer_id, last_message_at, services(name), providers(display_name, user_id, profiles:user_id(avatar_url)), profiles:customer_id(full_name, avatar_url), messages(id, transaction_id, conversation_id, sender_id, body, created_at, read_at)"
      )
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false })
      .order("created_at", { foreignTable: "messages", ascending: false })
      .limit(1, { foreignTable: "messages" })
      .limit(limit)
      .returns<TxnRow[]>(),
    supabase
      .from("conversations")
      .select(
        "id, customer_id, last_message_at, services(name), providers(display_name, user_id, profiles:user_id(avatar_url)), profiles:customer_id(full_name, avatar_url), messages(id, transaction_id, conversation_id, sender_id, body, created_at, read_at)"
      )
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false })
      .order("created_at", { foreignTable: "messages", ascending: false })
      .limit(1, { foreignTable: "messages" })
      .limit(limit)
      .returns<ConvRow[]>(),
  ]);

  if (txnThreadsRes.error || convThreadsRes.error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 pb-4">
        <h1 className="text-2xl font-bold mb-6">Messages</h1>
        <ErrorNotice message="We couldn't load your conversations right now. Please refresh." />
      </div>
    );
  }

  const txnRows = txnThreadsRes.data ?? [];
  const convRows = convThreadsRes.data ?? [];
  const txnIds = txnRows.map((t) => t.id);
  const convIds = convRows.map((c) => c.id);

  // Unread counts, scoped to only the threads shown on this page — bounded
  // by (thread count on this page) x (that thread's unread backlog), never
  // by total message history.
  const [txnUnreadRes, convUnreadRes] = await Promise.all([
    txnIds.length > 0
      ? supabase
          .from("messages")
          .select("transaction_id")
          .in("transaction_id", txnIds)
          .is("read_at", null)
          .neq("sender_id", user.id)
      : Promise.resolve({ data: [] as { transaction_id: string | null }[] }),
    convIds.length > 0
      ? supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", convIds)
          .is("read_at", null)
          .neq("sender_id", user.id)
      : Promise.resolve({ data: [] as { conversation_id: string | null }[] }),
  ]);

  const txnUnreadCounts = new Map<string, number>();
  for (const row of txnUnreadRes.data ?? []) {
    if (!row.transaction_id) continue;
    txnUnreadCounts.set(row.transaction_id, (txnUnreadCounts.get(row.transaction_id) ?? 0) + 1);
  }
  const convUnreadCounts = new Map<string, number>();
  for (const row of convUnreadRes.data ?? []) {
    if (!row.conversation_id) continue;
    convUnreadCounts.set(row.conversation_id, (convUnreadCounts.get(row.conversation_id) ?? 0) + 1);
  }

  const threads: ThreadEntry[] = [];

  for (const txn of txnRows) {
    const latest = txn.messages[0];
    if (!latest) continue;
    const isCustomer = txn.customer_id === user.id;
    threads.push({
      key: `t:${txn.id}`,
      href: `/messages/${txn.id}`,
      otherName: isCustomer ? txn.providers?.display_name ?? "Professional" : txn.profiles?.full_name ?? "Customer",
      otherPhotoUrl: isCustomer ? txn.providers?.profiles?.avatar_url ?? null : txn.profiles?.avatar_url ?? null,
      serviceLabel: txn.services?.name ?? "",
      latest,
      unread: txnUnreadCounts.get(txn.id) ?? 0,
    });
  }

  for (const conv of convRows) {
    const latest = conv.messages[0];
    if (!latest) continue;
    const isCustomer = conv.customer_id === user.id;
    threads.push({
      key: `c:${conv.id}`,
      href: `/messages/c/${conv.id}`,
      otherName: isCustomer ? conv.providers?.display_name ?? "Professional" : conv.profiles?.full_name ?? "Customer",
      otherPhotoUrl: isCustomer ? conv.providers?.profiles?.avatar_url ?? null : conv.profiles?.avatar_url ?? null,
      serviceLabel: conv.services?.name ?? "General inquiry",
      latest,
      unread: convUnreadCounts.get(conv.id) ?? 0,
    });
  }

  threads.sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());

  // Only offer "load older" while at least one side actually filled its
  // page — otherwise every thread that exists is already on screen.
  const canLoadMore = limit < MAX_LIMIT && (txnRows.length === limit || convRows.length === limit);

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>

      {threads.length === 0 && (
        <EmptyState
          illustration="/images/empty-states/empty-messages.svg"
          title="No conversations yet"
          body="Message a professional from their profile, or start a booking to chat about the details."
        />
      )}

      <div className="flex flex-col gap-2">
        {threads.map(({ key, href, otherName, otherPhotoUrl, serviceLabel, latest, unread }) => (
          <Link
            key={key}
            href={href}
            className="card card-shadow p-4 flex items-center gap-3 hover:border-[var(--trust)] transition-colors"
          >
            <Avatar name={otherName} photoUrl={otherPhotoUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold truncate">{otherName}</p>
                <span className="text-xs text-[var(--muted-2)] whitespace-nowrap">
                  {new Date(latest.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                </span>
              </div>
              {serviceLabel && <p className="text-xs text-[var(--muted)] truncate">{serviceLabel}</p>}
              <p className={`text-sm truncate mt-0.5 ${unread > 0 ? "font-semibold" : "text-[var(--muted)]"}`}>
                {latest.sender_id === user.id ? "You: " : ""}
                {latest.body}
              </p>
            </div>
            {unread > 0 && (
              <span
                className="rounded-full text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--trust)", minWidth: 18, height: 18, padding: "0 4px" }}
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        ))}
      </div>

      {canLoadMore && (
        <Link
          href={`/messages?limit=${limit + PAGE_SIZE}`}
          className="mt-4 block text-center text-sm font-semibold py-2"
          style={{ color: "var(--trust)" }}
        >
          Load older conversations
        </Link>
      )}
    </div>
  );
}
