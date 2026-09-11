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
  services: { name: string } | null;
  providers: { display_name: string; user_id: string; profiles: { avatar_url: string | null } | null } | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface ConvRow {
  id: string;
  customer_id: string;
  services: { name: string } | null;
  providers: { display_name: string; user_id: string; profiles: { avatar_url: string | null } | null } | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
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

export default async function MessagesInboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/messages");

  const [txnMessagesRes, convMessagesRes] = await Promise.all([
    supabase
      .from("messages")
      .select(
        "*, service_transactions(id, customer_id, services(name), providers(display_name, user_id, profiles:user_id(avatar_url)), profiles:customer_id(full_name, avatar_url))"
      )
      .not("transaction_id", "is", null)
      .order("created_at", { ascending: false })
      .returns<(Message & { service_transactions: TxnRow | null })[]>(),
    supabase
      .from("messages")
      .select(
        "*, conversations(id, customer_id, services(name), providers(display_name, user_id, profiles:user_id(avatar_url)), profiles:customer_id(full_name, avatar_url))"
      )
      .not("conversation_id", "is", null)
      .order("created_at", { ascending: false })
      .returns<(Message & { conversations: ConvRow | null })[]>(),
  ]);

  if (txnMessagesRes.error || convMessagesRes.error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 pb-4">
        <h1 className="text-2xl font-bold mb-6">Messages</h1>
        <ErrorNotice message="We couldn't load your conversations right now. Please refresh." />
      </div>
    );
  }

  // Latest message + unread count per thread — RLS already scoped
  // `messages` to only threads this user participates in, so grouping in
  // application code (rather than a SQL aggregate) is fine at this scale.
  const threads = new Map<string, ThreadEntry>();

  for (const m of txnMessagesRes.data ?? []) {
    const txn = m.service_transactions;
    if (!txn) continue;
    const key = `t:${txn.id}`;
    const isUnread = m.read_at === null && m.sender_id !== user.id;
    const existing = threads.get(key);
    if (!existing) {
      const isCustomer = txn.customer_id === user.id;
      threads.set(key, {
        key,
        href: `/messages/${txn.id}`,
        otherName: isCustomer ? txn.providers?.display_name ?? "Professional" : txn.profiles?.full_name ?? "Customer",
        otherPhotoUrl: isCustomer ? txn.providers?.profiles?.avatar_url ?? null : txn.profiles?.avatar_url ?? null,
        serviceLabel: txn.services?.name ?? "",
        latest: m,
        unread: isUnread ? 1 : 0,
      });
    } else if (isUnread) {
      existing.unread += 1;
    }
  }

  for (const m of convMessagesRes.data ?? []) {
    const conv = m.conversations;
    if (!conv) continue;
    const key = `c:${conv.id}`;
    const isUnread = m.read_at === null && m.sender_id !== user.id;
    const existing = threads.get(key);
    if (!existing) {
      const isCustomer = conv.customer_id === user.id;
      threads.set(key, {
        key,
        href: `/messages/c/${conv.id}`,
        otherName: isCustomer ? conv.providers?.display_name ?? "Professional" : conv.profiles?.full_name ?? "Customer",
        otherPhotoUrl: isCustomer ? conv.providers?.profiles?.avatar_url ?? null : conv.profiles?.avatar_url ?? null,
        serviceLabel: conv.services?.name ?? "General inquiry",
        latest: m,
        unread: isUnread ? 1 : 0,
      });
    } else if (isUnread) {
      existing.unread += 1;
    }
  }

  const threadList = Array.from(threads.values()).sort(
    (a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime()
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>

      {threadList.length === 0 && (
        <EmptyState
          illustration="/images/empty-states/empty-messages.svg"
          title="No conversations yet"
          body="Message a professional from their profile, or start a booking to chat about the details."
        />
      )}

      <div className="flex flex-col gap-2">
        {threadList.map(({ key, href, otherName, otherPhotoUrl, serviceLabel, latest, unread }) => (
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
    </div>
  );
}
