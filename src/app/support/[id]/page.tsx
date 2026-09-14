import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/ui/icon";

type Message = {
  id: string;
  sender_type: "customer" | "agent" | "system";
  author_name: string | null;
  body: string;
  created_at: string;
};

type Attachment = { id: string; message_id: string; file_path: string; file_name: string };

export default async function SupportConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/support/${id}`);

  // RLS ("support conversations owner or admin read") is what actually
  // enforces ownership — this returns null for anyone else's conversation
  // rather than the app having to check customer_profile_id itself.
  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("id, reference_number, subject, status")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) notFound();

  // RLS ("support messages owner or admin read") already excludes
  // internal notes from a non-admin read — no is_internal_note filter
  // needed here.
  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, sender_type, author_name, body, created_at")
    .eq("conversation_id", id)
    .order("created_at");

  const messageIds = (messages ?? []).map((m) => m.id);
  const { data: attachmentRows } = messageIds.length
    ? await supabase.from("support_attachments").select("id, message_id, file_path, file_name").in("message_id", messageIds)
    : { data: [] as Attachment[] };

  const attachmentsByMessage = new Map<string, Array<Attachment & { url: string | null }>>();
  for (const att of attachmentRows ?? []) {
    const { data: signed } = await supabase.storage.from("support-attachments").createSignedUrl(att.file_path, 60 * 10);
    const list = attachmentsByMessage.get(att.message_id) ?? [];
    list.push({ ...att, url: signed?.signedUrl ?? null });
    attachmentsByMessage.set(att.message_id, list);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-24">
      <Link href="/support" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted)]">
        <Icon name="chevron-right" size={16} className="rotate-180" />
        Back
      </Link>

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">{conversation.subject}</h1>
          <p className="font-mono text-xs text-[var(--muted)]">{conversation.reference_number}</p>
        </div>
        <span className={conversation.status === "resolved" || conversation.status === "closed" ? "badge-muted" : "badge-info"}>
          {conversation.status}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {(messages as Message[] | null)?.map((m) => (
          <div
            key={m.id}
            className={`card p-3 ${m.sender_type === "customer" ? "ml-6" : "mr-6"}`}
            style={m.sender_type === "agent" ? { background: "var(--trust-tint)", borderColor: "var(--trust-tint-strong)" } : undefined}
          >
            <p className="mb-1 text-xs font-semibold text-[var(--muted)]">
              {m.sender_type === "agent" ? m.author_name || "Support agent" : m.sender_type === "system" ? "System" : "You"}
              <span className="ml-2 font-normal">{new Date(m.created_at).toLocaleString()}</span>
            </p>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
            {(attachmentsByMessage.get(m.id) ?? []).map((att) =>
              att.url ? (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--trust)] underline"
                >
                  <Icon name="paperclip" size={14} />
                  {att.file_name}
                </a>
              ) : null
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        Reply by email to add more detail — this page is read-only.
      </p>
    </div>
  );
}
