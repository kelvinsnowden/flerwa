import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import type { Message } from "@/lib/types";
import { MessageThread, THREAD_PAGE_SIZE } from "../message-thread";

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/messages/${transactionId}`);

  // RLS ("txn participants read") already scopes this to a transaction the
  // signed-in user is actually part of — a non-participant gets no row,
  // which we correctly render as a 404, not a permission error, so the
  // page can't be used to probe which transaction IDs exist.
  const { data: txn, error: txnError } = await supabase
    .from("service_transactions")
    .select(
      "id, customer_id, services(name), providers(display_name, user_id, profiles:user_id(avatar_url)), profiles:customer_id(full_name, avatar_url)"
    )
    .eq("id", transactionId)
    .single<{
      id: string;
      customer_id: string;
      services: { name: string } | null;
      providers: { display_name: string; user_id: string; profiles: { avatar_url: string | null } | null } | null;
      profiles: { full_name: string | null; avatar_url: string | null } | null;
    }>();

  if (txnError && txnError.code !== "PGRST116") {
    redirect("/messages");
  }
  if (!txn) notFound();

  const isCustomer = txn.customer_id === user.id;
  const otherName = isCustomer ? txn.providers?.display_name ?? "Professional" : txn.profiles?.full_name ?? "Customer";
  const otherPhotoUrl = isCustomer ? txn.providers?.profiles?.avatar_url ?? null : txn.profiles?.avatar_url ?? null;

  // Bounded to the most recent THREAD_PAGE_SIZE messages, not the thread's
  // full history — see MARKETPLACE_SCALE_READINESS_AUDIT.md. Older
  // messages are fetched on demand by MessageThread's "Load earlier"
  // control (src/app/messages/message-thread.tsx), via the same RLS-scoped
  // client query, so nothing is ever unreachable — just not loaded
  // up front.
  const { data: recentDesc } = await supabase
    .from("messages")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: false })
    .limit(THREAD_PAGE_SIZE)
    .returns<Message[]>();
  const messages = [...(recentDesc ?? [])].reverse();
  const hasMoreOlder = (recentDesc ?? []).length === THREAD_PAGE_SIZE;

  return (
    <div className="mx-auto max-w-lg flex flex-col" style={{ minHeight: "calc(100dvh - 56px)" }}>
      <div className="px-4 py-3 border-b flex items-center gap-3 sticky top-14 bg-[var(--card)] z-10">
        <Link href="/messages" className="text-[var(--muted)]">
          <Icon name="chevron-right" size={18} className="rotate-180" />
        </Link>
        <Avatar name={otherName} photoUrl={otherPhotoUrl} size="sm" />
        <div className="min-w-0">
          <p className="font-semibold truncate">{otherName}</p>
          <p className="text-xs text-[var(--muted)] truncate">{txn.services?.name}</p>
        </div>
        <Link
          href={`/${isCustomer ? "account/bookings" : "provider/jobs"}/${transactionId}`}
          className="ml-auto text-xs font-semibold whitespace-nowrap"
          style={{ color: "var(--trust)" }}
        >
          View booking
        </Link>
      </div>

      <MessageThread
        thread={{ transactionId }}
        currentUserId={user.id}
        initialMessages={messages}
        initialHasMoreOlder={hasMoreOlder}
      />
    </div>
  );
}
