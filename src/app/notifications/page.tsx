import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { MarkReadButton } from "./mark-read-button";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  transaction_id: string | null;
  read_at: string | null;
  created_at: string;
}

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

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <h1 className="text-2xl font-bold mb-6">Updates</h1>

      {error && (
        <ErrorNotice message="We couldn't load your updates right now. Please refresh." />
      )}

      {!error && !notifications?.length && (
        <EmptyState
          icon={<Icon name="bell" size={20} />}
          title="No updates yet"
          body="You'll see updates here as your bookings and jobs move forward."
        />
      )}

      {!error && !!notifications?.length && (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className="card p-4 flex items-start justify-between gap-3"
              style={n.read_at ? undefined : { borderColor: "var(--trust)" }}
            >
              <div className="min-w-0">
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
