import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/ui/icon";
import { SupportForm } from "./support-form";

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking: relatedTransactionId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: categories }, { data: profile }, { data: conversations }] = await Promise.all([
    supabase.from("support_categories").select("id, name").eq("is_active", true).order("sort_order"),
    user ? supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("support_conversations")
          .select("id, reference_number, subject, status, last_customer_message_at")
          .order("last_customer_message_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
  ]);

  let relatedTransactionLabel: string | null = null;
  if (relatedTransactionId && user) {
    const { data: txn } = await supabase
      .from("service_transactions")
      .select("id, services(title)")
      .eq("id", relatedTransactionId)
      .eq("customer_id", user.id)
      .maybeSingle<{ id: string; services: { title: string } | null }>();
    relatedTransactionLabel = txn?.services?.title ?? null;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-24">
      <div className="mb-6 flex items-center gap-2">
        <Icon name="help-circle" size={22} className="text-[var(--trust)]" />
        <h1 className="text-xl font-bold">Get help</h1>
      </div>

      <SupportForm
        categories={categories ?? []}
        defaultEmail={profile?.email ?? null}
        defaultName={profile?.full_name ?? null}
        isLoggedIn={!!user}
        relatedTransactionId={relatedTransactionId && relatedTransactionLabel ? relatedTransactionId : null}
        relatedTransactionLabel={relatedTransactionLabel}
      />

      {user && conversations && conversations.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs font-semibold tracking-[0.1em] text-[var(--muted)]">YOUR PAST MESSAGES</h2>
          <div className="flex flex-col gap-2">
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/support/${c.id}`}
                className="card flex items-center justify-between p-4 transition-colors hover:border-[var(--trust)]"
              >
                <div>
                  <p className="font-medium">{c.subject}</p>
                  <p className="font-mono text-xs text-[var(--muted)]">{c.reference_number}</p>
                </div>
                <span className={c.status === "resolved" || c.status === "closed" ? "badge-muted" : "badge-info"}>
                  {c.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
