import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { ConversationWorkspace } from "./conversation-workspace";

export default async function AdminSupportConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversation, error } = await supabase
    .from("support_conversations")
    .select(
      "id, reference_number, subject, status, priority, category_id, customer_profile_id, customer_email, customer_name, related_transaction_id, assigned_to"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return <ErrorNotice message="We couldn't load this conversation. Please refresh." />;
  if (!conversation) notFound();

  const [
    { data: messages },
    { data: categories },
    { data: tags },
    { data: conversationTags },
    { data: admins },
    { data: cannedReplies },
  ] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, sender_type, author_name, author_email, body, is_internal_note, created_at")
      .eq("conversation_id", id)
      .order("created_at"),
    supabase.from("support_categories").select("id, name").order("sort_order"),
    supabase.from("support_tags").select("id, name").order("name"),
    supabase.from("support_conversation_tags").select("tag_id").eq("conversation_id", id),
    supabase.from("profiles").select("id, full_name, email").eq("role", "admin"),
    supabase.from("support_canned_replies").select("id, title, body").order("title"),
  ]);

  let customerBookingCount: number | null = null;
  let relatedBooking: { id: string; service_title: string | null } | null = null;

  if (conversation.customer_profile_id) {
    const { count } = await supabase
      .from("service_transactions")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", conversation.customer_profile_id);
    customerBookingCount = count ?? 0;
  }
  if (conversation.related_transaction_id) {
    const { data: txn } = await supabase
      .from("service_transactions")
      .select("id, services(title)")
      .eq("id", conversation.related_transaction_id)
      .maybeSingle<{ id: string; services: { title: string } | null }>();
    if (txn) relatedBooking = { id: txn.id, service_title: txn.services?.title ?? null };
  }

  return (
    <div>
      <Link href="/admin/support" className="mb-4 inline-block text-sm text-[var(--muted)]">
        ← Back to inbox
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{conversation.subject}</h1>
          <p className="font-mono text-xs text-[var(--muted)]">{conversation.reference_number}</p>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-medium">{conversation.customer_name || conversation.customer_email}</p>
          <p className="text-sm text-[var(--muted)]">{conversation.customer_email}</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
          {conversation.customer_profile_id ? (
            <Link href={`/admin/customers/${conversation.customer_profile_id}`} className="text-[var(--trust)] underline">
              View customer profile{customerBookingCount !== null ? ` (${customerBookingCount} bookings)` : ""}
            </Link>
          ) : (
            <span>Not a registered account</span>
          )}
          {relatedBooking && (
            <Link href={`/admin/bookings/${relatedBooking.id}`} className="text-[var(--trust)] underline">
              View related booking{relatedBooking.service_title ? `: ${relatedBooking.service_title}` : ""}
            </Link>
          )}
        </div>
      </div>

      <ConversationWorkspace
        conversationId={id}
        messages={messages ?? []}
        status={conversation.status}
        priority={conversation.priority}
        categoryId={conversation.category_id}
        assignedTo={conversation.assigned_to}
        tagIds={(conversationTags ?? []).map((t) => t.tag_id)}
        categories={categories ?? []}
        tags={tags ?? []}
        admins={(admins ?? []).map((a) => ({ id: a.id, name: a.full_name || a.email || a.id.slice(0, 8) }))}
        cannedReplies={cannedReplies ?? []}
      />
    </div>
  );
}
