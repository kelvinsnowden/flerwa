import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { PAYMENT_STATE_LABELS, TXN_STATE_LABELS, type PaymentState, type TxnState } from "@/lib/types";
import { Icon } from "@/components/ui/icon";

/**
 * Mobile: this 3-pane layout only has room for one pane at a time below
 * the md breakpoint. AdminMessageList already hides itself once a thread
 * is open; the context aside below does the same (hidden below lg) rather
 * than squeezing three columns onto a phone — a "Back to conversations"
 * link replaces it. The desktop 3-pane view is unaffected.
 */

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default async function AdminMessageThreadPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  if (type !== "t" && type !== "c") notFound();

  const supabase = await createClient();

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq(type === "t" ? "transaction_id" : "conversation_id", id)
    .order("created_at", { ascending: true });

  if (messagesError || !messages?.length) notFound();

  // sender_id references auth.users directly, not profiles — same reason
  // the Reviews page can't embed profiles via reviewer_id. Batched lookup.
  const senderIds = Array.from(new Set(messages.map((m) => m.sender_id)));
  const { data: senders } = await supabase.from("profiles").select("id, full_name, avatar_url, role").in("id", senderIds);
  const senderById = new Map((senders ?? []).map((s) => [s.id, s]));

  let customerId: string;
  let providerId: string;
  let serviceName: string | null = null;
  let transactionId: string | null = null;
  let conversationState: string | null = null;

  if (type === "t") {
    const { data: txn } = await supabase
      .from("service_transactions")
      .select("id, customer_id, provider_id, services(name)")
      .eq("id", id)
      .maybeSingle<{ id: string; customer_id: string; provider_id: string | null; services: { name: string } | null }>();
    if (!txn || !txn.provider_id) notFound();
    customerId = txn.customer_id;
    providerId = txn.provider_id;
    serviceName = txn.services?.name ?? null;
    transactionId = txn.id;
  } else {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, customer_id, provider_id, state, transaction_id, services(name)")
      .eq("id", id)
      .maybeSingle<{ id: string; customer_id: string; provider_id: string; state: string; transaction_id: string | null; services: { name: string } | null }>();
    if (!conv) notFound();
    customerId = conv.customer_id;
    providerId = conv.provider_id;
    serviceName = conv.services?.name ?? null;
    transactionId = conv.transaction_id;
    conversationState = conv.state;
  }

  const [{ data: customer }, { data: provider }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, phone").eq("id", customerId).maybeSingle(),
    supabase.from("providers").select("id, display_name, verification_status, profiles:user_id(avatar_url)").eq("id", providerId).maybeSingle<{
      id: string;
      display_name: string;
      verification_status: string;
      profiles: { avatar_url: string | null } | null;
    }>(),
  ]);

  let booking: { id: string; state: TxnState; total_amount_minor: number; currency: string } | null = null;
  let paymentState: PaymentState | null = null;
  let dispute: { id: string; state: string } | null = null;

  if (transactionId) {
    const [{ data: txnDetail }, { data: payment }, { data: disputeRow }] = await Promise.all([
      supabase.from("service_transactions").select("id, state, total_amount_minor, currency").eq("id", transactionId).maybeSingle(),
      supabase.from("payments").select("state, created_at").eq("transaction_id", transactionId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("disputes").select("id, state").eq("transaction_id", transactionId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    booking = txnDetail;
    paymentState = payment?.state ?? null;
    dispute = disputeRow;
  }

  return (
    <>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
          <Link href="/admin/messages" className="md:hidden p-1 -ml-1 rounded hover:bg-[var(--surface)]">
            <Icon name="chevron-right" size={16} className="rotate-180" />
          </Link>
          <p className="text-sm font-semibold">
            {customer?.full_name ?? "Customer"} <span className="text-[var(--muted)] font-normal">↔</span>{" "}
            {provider?.display_name ?? "Professional"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.map((m) => {
            const sender = senderById.get(m.sender_id);
            const isCustomer = m.sender_id === customerId;
            return (
              <div key={m.id} className={`flex gap-2 max-w-[80%] ${isCustomer ? "self-start" : "self-end flex-row-reverse"}`}>
                {sender?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sender.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <span className="avatar h-6 w-6 text-[10px] flex-shrink-0">{initialsOf(sender?.full_name ?? "?")}</span>
                )}
                <div>
                  <div className={`rounded-[var(--radius-md)] px-3 py-2 text-sm ${isCustomer ? "bg-[var(--surface)]" : "bg-[var(--trust-tint)]"}`}>
                    {m.body}
                  </div>
                  <p className="text-[10px] text-[var(--muted-2)] mt-0.5">
                    {sender?.full_name ?? "Unknown"} · {new Date(m.created_at).toLocaleString("en-KE")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
          <p className="text-xs text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="lock" size={12} />
            Admins can view this conversation for context but can&apos;t post into it — only the customer and
            professional can send messages here.
          </p>
        </div>
      </div>

      <aside className="hidden lg:block w-72 flex-shrink-0 border-l border-[var(--border)] overflow-y-auto p-4 text-sm space-y-4">
        <div>
          <p className="text-xs font-semibold text-[var(--muted)] mb-1.5">Customer</p>
          <Link href={`/admin/customers/${customerId}`} className="flex items-center gap-2 hover:underline">
            {customer?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={customer.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="avatar h-7 w-7 text-xs">{initialsOf(customer?.full_name ?? "?")}</span>
            )}
            <span>{customer?.full_name ?? "Unknown"}</span>
          </Link>
        </div>

        <div>
          <p className="text-xs font-semibold text-[var(--muted)] mb-1.5">Professional</p>
          <Link href={`/admin/providers/${providerId}`} className="flex items-center gap-2 hover:underline">
            {provider?.profiles?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={provider.profiles.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="avatar h-7 w-7 text-xs">{initialsOf(provider?.display_name ?? "?")}</span>
            )}
            <span>{provider?.display_name ?? "Unknown"}</span>
          </Link>
        </div>

        {serviceName && (
          <div>
            <p className="text-xs font-semibold text-[var(--muted)] mb-1">Service</p>
            <p>{serviceName}</p>
          </div>
        )}

        {conversationState && (
          <div>
            <p className="text-xs font-semibold text-[var(--muted)] mb-1">Conversation status</p>
            <span className="badge-info capitalize">{conversationState}</span>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-[var(--muted)] mb-1">Booking</p>
          {booking ? (
            <Link href={`/admin/bookings/${booking.id}`} className="block hover:underline">
              <span className="badge-info">{TXN_STATE_LABELS[booking.state]}</span>
              <span className="block text-xs text-[var(--muted)] mt-1">{formatMoney(booking.total_amount_minor, booking.currency)}</span>
            </Link>
          ) : (
            <p className="text-xs text-[var(--muted)]">No booking yet — this is a pre-booking inquiry.</p>
          )}
        </div>

        {booking && (
          <div>
            <p className="text-xs font-semibold text-[var(--muted)] mb-1">Payment</p>
            {paymentState ? <span className="badge-muted">{PAYMENT_STATE_LABELS[paymentState]}</span> : <span className="text-xs text-[var(--muted)]">Not funded</span>}
          </div>
        )}

        {dispute && (
          <div>
            <p className="text-xs font-semibold text-[var(--muted)] mb-1">Dispute</p>
            <Link href={`/admin/disputes?state=${dispute.state}`} className="badge-danger inline-flex hover:underline">
              {dispute.state.replace(/_/g, " ")}
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
