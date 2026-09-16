import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { AdminMessageList, type AdminThreadEntry } from "./admin-message-list";
import type { Message } from "@/lib/types";

/**
 * There was NO admin visibility into marketplace conversations (booking
 * chat + pre-booking inquiries) before this — /admin/support is a
 * different, separate helpdesk-ticket system (support_conversations),
 * not this. RLS on `conversations`/`messages` already grants admins
 * unconditional SELECT (`is_admin()` in both policies, confirmed via
 * pg_policies), so this is a pure new read surface, no schema change.
 *
 * There is NO admin bypass on the `messages` INSERT policy — it requires
 * the sender to be an actual transaction/conversation participant. So an
 * admin can see every conversation here but cannot post into one; the
 * thread view says so explicitly rather than shipping a reply box that
 * would just fail RLS.
 *
 * Same bounded-thread-list pattern as /messages/page.tsx: one row per
 * thread (transaction- or conversation-scoped), each contributing only
 * its single latest message, not full history — see that file's own
 * comment on MARKETPLACE_SCALE_READINESS_AUDIT.md for why.
 */
const LIST_LIMIT = 100;

interface TxnRow {
  id: string;
  last_message_at: string | null;
  services: { name: string } | null;
  providers: { display_name: string } | null;
  profiles: { full_name: string | null } | null;
  messages: Message[];
}
interface ConvRow {
  id: string;
  state: string;
  last_message_at: string | null;
  services: { name: string } | null;
  providers: { display_name: string } | null;
  profiles: { full_name: string | null } | null;
  messages: Message[];
}

export default async function AdminMessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const [txnRes, convRes] = await Promise.all([
    supabase
      .from("service_transactions")
      .select(
        "id, last_message_at, services(name), providers(display_name), profiles:customer_id(full_name), messages(id, transaction_id, conversation_id, sender_id, body, created_at, read_at)"
      )
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false })
      .order("created_at", { foreignTable: "messages", ascending: false })
      .limit(1, { foreignTable: "messages" })
      .limit(LIST_LIMIT)
      .returns<TxnRow[]>(),
    supabase
      .from("conversations")
      .select(
        "id, state, last_message_at, services(name), providers(display_name), profiles:customer_id(full_name), messages(id, transaction_id, conversation_id, sender_id, body, created_at, read_at)"
      )
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false })
      .order("created_at", { foreignTable: "messages", ascending: false })
      .limit(1, { foreignTable: "messages" })
      .limit(LIST_LIMIT)
      .returns<ConvRow[]>(),
  ]);

  if (txnRes.error || convRes.error) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-4">Messages</h1>
        <ErrorNotice message="We couldn't load conversations. Please refresh." />
      </div>
    );
  }

  const threads: AdminThreadEntry[] = [
    ...(txnRes.data ?? [])
      .filter((t) => t.messages[0])
      .map((t): AdminThreadEntry => ({
        type: "t",
        id: t.id,
        customerName: t.profiles?.full_name ?? "Customer",
        providerName: t.providers?.display_name ?? "Professional",
        serviceLabel: t.services?.name ?? "",
        statusLabel: "Booking chat",
        latest: t.messages[0],
      })),
    ...(convRes.data ?? [])
      .filter((c) => c.messages[0])
      .map((c): AdminThreadEntry => ({
        type: "c",
        id: c.id,
        customerName: c.profiles?.full_name ?? "Customer",
        providerName: c.providers?.display_name ?? "Professional",
        serviceLabel: c.services?.name ?? "General inquiry",
        statusLabel: c.state === "open" ? "Inquiry" : c.state === "converted" ? "Converted to booking" : "Closed",
        latest: c.messages[0],
      })),
  ].sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Messages</h1>
      <div className="card flex h-[75vh] overflow-hidden">
        <AdminMessageList threads={threads} />
        <div className="flex-1 min-w-0 flex overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
