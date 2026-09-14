import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { CannedRepliesManager } from "./canned-replies-manager";

type ConversationRow = {
  id: string;
  reference_number: string;
  subject: string;
  status: string;
  priority: string;
  customer_email: string;
  customer_name: string | null;
  assigned_to: string | null;
  last_customer_message_at: string;
  support_categories: { name: string } | null;
};

const STATUS_FILTERS = ["open", "pending", "resolved", "closed", "all"] as const;

export default async function AdminSupportInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assigned?: string; q?: string }>;
}) {
  const { status = "open", assigned, q } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("support_conversations")
    .select("id, reference_number, subject, status, priority, customer_email, customer_name, assigned_to, last_customer_message_at, support_categories(name)");

  if (status !== "all") query = query.eq("status", status);
  if (assigned === "me" && user) query = query.eq("assigned_to", user.id);
  if (assigned === "unassigned") query = query.is("assigned_to", null);
  if (q) query = query.or(`subject.ilike.%${q}%,reference_number.ilike.%${q}%,customer_email.ilike.%${q}%`);

  const { data: conversations, error } = await query
    .order("last_customer_message_at", { ascending: false })
    .limit(50)
    .returns<ConversationRow[]>();

  const { data: cannedReplies } = await supabase.from("support_canned_replies").select("id, title, body").order("title");

  if (error) {
    return <ErrorNotice message="We couldn't load the support inbox. Please refresh." />;
  }

  const priorityBadge: Record<string, string> = {
    urgent: "badge-danger",
    high: "badge-warn",
    normal: "badge-muted",
    low: "badge-muted",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Support inbox</h1>
      </div>

      <CannedRepliesManager replies={cannedReplies ?? []} />

      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <select name="status" defaultValue={status} className="text-sm">
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select name="assigned" defaultValue={assigned ?? ""} className="text-sm">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </select>
        <input name="q" defaultValue={q ?? ""} placeholder="Search subject, reference, email…" className="min-w-[220px] text-sm" />
        <button type="submit" className="btn-secondary">
          Filter
        </button>
      </form>

      {!conversations?.length && <p className="text-sm text-[var(--muted)]">Nothing here.</p>}

      <div className="flex flex-col gap-2">
        {conversations?.map((c) => (
          <Link
            key={c.id}
            href={`/admin/support/${c.id}`}
            className="card flex items-center justify-between gap-3 p-4 transition-colors hover:border-[var(--trust)]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{c.subject}</p>
                {c.priority !== "normal" && <span className={priorityBadge[c.priority] ?? "badge-muted"}>{c.priority}</span>}
              </div>
              <p className="text-xs text-[var(--muted)]">
                {c.reference_number} · {c.customer_name || c.customer_email}
                {c.support_categories?.name ? ` · ${c.support_categories.name}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={c.status === "resolved" || c.status === "closed" ? "badge-muted" : "badge-info"}>{c.status}</span>
              {!c.assigned_to && <span className="badge-warn">Unassigned</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
