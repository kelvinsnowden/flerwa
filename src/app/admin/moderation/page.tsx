import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { ReportCard } from "./report-card";

interface ReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

/**
 * TSF-007's minimal moderation queue — open/reviewing reports with
 * dismiss/actioned resolution. Deliberately minimal: no reason-code
 * taxonomy, no warn/suspend/ban shortcut actions wired in here (an admin
 * who marks something "actioned" still has to go suspend the provider,
 * hide the review, etc. from their respective admin pages). That gap is
 * TSF-008's scope, not re-solved here — see MARKETPLACE_REMEDIATION_REGISTER.md.
 */
export default async function AdminModerationPage() {
  const supabase = await createClient();

  const { data: reports, error } = await supabase
    .from("reports")
    .select("*, profiles:reporter_id(full_name)")
    .in("state", ["open", "reviewing"])
    .order("created_at")
    .returns<ReportRow[]>();

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">Moderation Queue</h1>
        <ErrorNotice message="We couldn't load the report queue. Please refresh — this is not the same as there being no open reports." />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Moderation Queue</h1>
      {!reports?.length && <p className="text-sm text-[var(--muted)]">No open reports.</p>}
      <div className="flex flex-col gap-4">
        {reports?.map((r) => (
          <ReportCard
            key={r.id}
            report={{
              id: r.id,
              targetType: r.target_type,
              targetId: r.target_id,
              reason: r.reason,
              description: r.description,
              reporterName: r.profiles?.full_name ?? "A user",
              createdAt: r.created_at,
            }}
          />
        ))}
      </div>
    </div>
  );
}
