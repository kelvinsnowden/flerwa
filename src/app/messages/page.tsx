import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import type { Message } from "@/lib/types";

interface ThreadRow {
  id: string;
  customer_id: string;
  services: { name: string } | null;
  providers: { display_name: string; user_id: string; profiles: { avatar_url: string | null } | null } | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

export default async function MessagesInboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/messages");

  const { data: messages, error } = await supabase
    .from("messages")
    .select(
      "*, service_transactions(id, customer_id, services(name), providers(display_name, user_id, profiles:user_id(avatar_url)), profiles:customer_id(full_name, avatar_url))"
    )
    .order("created_at", { ascending: false })
    .returns<(Message & { service_transactions: ThreadRow | null })[]>();

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 pb-4">
        <h1 className="text-2xl font-bold mb-6">Messages</h1>
        <ErrorNotice message="We couldn't load your conversations right now. Please refresh." />
      </div>
    );
  }

  // Latest message + unread count per transaction — RLS already scoped
  // `messages` to only threads this user participates in, so grouping in
  // application code (rather than a SQL aggregate) is fine at this scale.
  const threads = new Map<
    string,
    { latest: Message; txn: ThreadRow; unread: number }
  >();
  for (const m of messages ?? []) {
    if (!m.service_transactions) continue;
    const existing = threads.get(m.transaction_id);
    const isUnread = m.read_at === null && m.sender_id !== user.id;
    if (!existing) {
      threads.set(m.transaction_id, { latest: m, txn: m.service_transactions, unread: isUnread ? 1 : 0 });
    } else if (isUnread) {
      existing.unread += 1;
    }
  }
  const threadList = Array.from(threads.values());

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>

      {threadList.length === 0 && (
        <EmptyState
          illustration="/images/empty-states/empty-messages.svg"
          title="No conversations yet"
          body="Once you have an active booking, you can message your Pro or customer here."
        />
      )}

      <div className="flex flex-col gap-2">
        {threadList.map(({ latest, txn, unread }) => {
          const isCustomer = txn.customer_id === user.id;
          const otherName = isCustomer
            ? txn.providers?.display_name ?? "Pro"
            : txn.profiles?.full_name ?? "Customer";
          const otherPhotoUrl = isCustomer ? txn.providers?.profiles?.avatar_url ?? null : txn.profiles?.avatar_url ?? null;
          return (
            <Link
              key={txn.id}
              href={`/messages/${txn.id}`}
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
                <p className="text-xs text-[var(--muted)] truncate">{txn.services?.name}</p>
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
          );
        })}
      </div>
    </div>
  );
}
