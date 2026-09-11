import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import type { Message } from "@/lib/types";
import { MessageThread } from "../../message-thread";

export default async function ConversationThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/messages/c/${conversationId}`);

  // RLS ("conversations participants read") already scopes this to a
  // conversation the signed-in user is actually part of — a
  // non-participant gets no row, rendered as a 404 rather than a
  // permission error so the route can't be used to probe existing IDs.
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .select(
      "id, customer_id, services(name), providers(display_name, user_id, profiles:user_id(avatar_url)), profiles:customer_id(full_name, avatar_url)"
    )
    .eq("id", conversationId)
    .single<{
      id: string;
      customer_id: string;
      services: { name: string } | null;
      providers: { display_name: string; user_id: string; profiles: { avatar_url: string | null } | null } | null;
      profiles: { full_name: string | null; avatar_url: string | null } | null;
    }>();

  if (convError && convError.code !== "PGRST116") {
    redirect("/messages");
  }
  if (!conv) notFound();

  const isCustomer = conv.customer_id === user.id;
  const otherName = isCustomer ? conv.providers?.display_name ?? "Professional" : conv.profiles?.full_name ?? "Customer";
  const otherPhotoUrl = isCustomer ? conv.providers?.profiles?.avatar_url ?? null : conv.profiles?.avatar_url ?? null;

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .returns<Message[]>();

  return (
    <div className="mx-auto max-w-lg flex flex-col" style={{ minHeight: "calc(100dvh - 56px)" }}>
      <div className="px-4 py-3 border-b flex items-center gap-3 sticky top-14 bg-[var(--card)] z-10">
        <Link href="/messages" className="text-[var(--muted)]">
          <Icon name="chevron-right" size={18} className="rotate-180" />
        </Link>
        <Avatar name={otherName} photoUrl={otherPhotoUrl} size="sm" />
        <div className="min-w-0">
          <p className="font-semibold truncate">{otherName}</p>
          <p className="text-xs text-[var(--muted)] truncate">
            {conv.services?.name ?? "General inquiry"}
          </p>
        </div>
      </div>

      <MessageThread
        thread={{ conversationId }}
        currentUserId={user.id}
        initialMessages={messages ?? []}
      />
    </div>
  );
}
