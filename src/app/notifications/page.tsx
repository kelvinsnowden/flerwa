import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";
import { MarkReadButton, MarkAllReadButton } from "./mark-read-button";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  transaction_id: string | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_ICON: Record<string, IconName> = {
  new_message: "message-circle",
  evidence_ready: "camera",
  payment_released: "wallet",
  dispute_resolved: "shield-check",
  deal_desk_converted: "briefcase",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notifications");

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<NotificationRow[]>();

  const unreadCount = notifications?.filter((n) => !n.read_at).length ?? 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Updates</h1>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      {error && (
        <ErrorNotice message="We couldn't load your updates right now. Please refresh." />
      )}

      {!error && !notifications?.length && (
        <EmptyState
          illustration="/images/empty-states/empty-notifications.svg"
          title="No updates yet"
          body="You'll see updates here as your bookings and jobs move forward."
        />
      )}

      {!error && !!notifications?.length && (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className="card p-4 flex items-start gap-3"
              style={n.read_at ? undefined : { borderColor: "var(--trust)" }}
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--trust-tint)", color: "var(--trust)" }}
              >
                <Icon name={TYPE_ICON[n.type] ?? "bell"} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                {n.transaction_id ? (
                  <Link href={`/account/bookings/${n.transaction_id}`} className="font-semibold hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  <p className="font-semibold">{n.title}</p>
                )}
                {n.body && <p className="text-sm text-[var(--muted)] mt-0.5">{n.body}</p>}
                <p className="text-xs text-[var(--muted-2)] mt-1">
                  {new Date(n.created_at).toLocaleString("en-KE")}
                </p>
              </div>
              {!n.read_at && <MarkReadButton notificationId={n.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
